"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublishedMap } from "@/lib/maps/public";
import type { PublishedMapItem } from "@/lib/maps/snapshot";
import { iconSrc, LABEL_BY_TYPE, type MapItemType } from "@/lib/maps/icons";
import { clampScale, clampTranslate, zoomToPoint } from "@/lib/maps/coords";

// Visor público de solo lectura. Comparte modelo de datos y sistema de coordenadas
// (normalizado 0..1) con el editor. Navegación estilo Google Maps: rueda hace zoom
// al cursor, pinch en touch, arrastre para desplazar. Los marcadores se posicionan en
// % del contenedor, así el mismo dato cae en el mismo lugar a cualquier tamaño sin
// deformar la imagen. transform-origin 0 0 para que la matemática de zoom-al-punto
// (coords.ts) sea exacta.

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DRAG_THRESHOLD = 4; // px: por debajo de esto, un pointerup cuenta como clic.
const WHEEL_ZOOM_SPEED = 0.0015; // sensibilidad de la rueda; menor = más suave.

type Pointer = { x: number; y: number };

export function MapViewer({ map }: { map: PublishedMap }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [selected, setSelected] = useState<PublishedMapItem | null>(null);
  const [dragging, setDragging] = useState(false);
  const selectedTower = selected?.linked_tower_id
    ? (map.towers.find((tower) => tower.id === selected.linked_tower_id) ?? null)
    : null;

  // Punteros activos (para distinguir 1 = pan de 2 = pinch) y estado del pinch.
  const pointers = useRef<Map<number, Pointer>>(new Map());
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(
    null,
  );
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);

  const viewportSize = useCallback(() => {
    const el = viewportRef.current;
    return { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 };
  }, []);

  // Aplica una nueva escala manteniendo fijo el punto (px, py) del viewport y recorta
  // la traslación para no despegar la imagen de los bordes.
  const applyZoom = useCallback(
    (nextScaleRaw: number, px: number, py: number) => {
      const { w, h } = viewportSize();
      setScale((s) => {
        const nextScale = clampScale(nextScaleRaw, MIN_SCALE, MAX_SCALE);
        const zoomed = zoomToPoint(s, tx, ty, nextScale, px, py);
        const clamped = clampTranslate(zoomed.tx, zoomed.ty, nextScale, w, h);
        setTx(clamped.tx);
        setTy(clamped.ty);
        return nextScale;
      });
    },
    [tx, ty, viewportSize],
  );

  // Rueda del mouse: listener nativo NO pasivo para poder preventDefault() y no
  // scrollear la página mientras se hace zoom.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      // Zoom proporcional a la magnitud real del scroll pero suave: el factor por
      // línea (deltaMode=1) se escala x16. Se acota el delta para que un golpe de
      // trackpad/rueda no dé un salto brusco.
      const unit = e.deltaMode === 1 ? 16 : 1;
      const delta = Math.max(-40, Math.min(40, e.deltaY * unit));
      const factor = Math.exp(-delta * WHEEL_ZOOM_SPEED);
      setScale((s) => {
        const nextScale = clampScale(s * factor, MIN_SCALE, MAX_SCALE);
        const zoomed = zoomToPoint(s, tx, ty, nextScale, px, py);
        const clamped = clampTranslate(zoomed.tx, zoomed.ty, nextScale, rect.width, rect.height);
        setTx(clamped.tx);
        setTy(clamped.ty);
        return nextScale;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [tx, ty]);

  const zoomByButton = useCallback(
    (factor: number) => {
      const { w, h } = viewportSize();
      applyZoom(scale * factor, w / 2, h / 2);
    },
    [applyZoom, scale, viewportSize],
  );

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  const dist = (a: Pointer, b: Pointer) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a: Pointer, b: Pointer) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const onPointerDown = (e: React.PointerEvent) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    pointers.current.set(e.pointerId, p);
    el.setPointerCapture?.(e.pointerId);

    if (pointers.current.size === 1) {
      panStart.current = { x: p.x, y: p.y, tx, ty, moved: false };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: dist(a, b), scale };
      panStart.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = viewportRef.current;
    if (!el || !pointers.current.has(e.pointerId)) return;
    const rect = el.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const center = mid(a, b);
      const ratio = dist(a, b) / (pinchStart.current.dist || 1);
      applyZoom(pinchStart.current.scale * ratio, center.x, center.y);
      return;
    }

    if (pointers.current.size === 1 && panStart.current) {
      const dx = p.x - panStart.current.x;
      const dy = p.y - panStart.current.y;
      if (!panStart.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        panStart.current.moved = true;
        setDragging(true);
      }
      if (panStart.current.moved) {
        const { w, h } = viewportSize();
        const clamped = clampTranslate(
          panStart.current.tx + dx,
          panStart.current.ty + dy,
          scale,
          w,
          h,
        );
        setTx(clamped.tx);
        setTy(clamped.ty);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    viewportRef.current?.releasePointerCapture?.(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      panStart.current = null;
      setDragging(false);
    }
  };

  const aspectRatio =
    map.image_width && map.image_height ? `${map.image_width} / ${map.image_height}` : "16 / 9";

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomByButton(1.3)}
          aria-label="Acercar"
          className="h-9 w-9 rounded-lg bg-white/90 text-lg font-bold text-night shadow"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomByButton(1 / 1.3)}
          aria-label="Alejar"
          className="h-9 w-9 rounded-lg bg-white/90 text-lg font-bold text-night shadow"
        >
          −
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Restablecer vista"
          className="h-9 w-9 rounded-lg bg-white/90 text-xs font-semibold text-night shadow"
        >
          1:1
        </button>
      </div>

      <div
        ref={viewportRef}
        className="overflow-hidden rounded-2xl bg-slate-100"
        style={{
          touchAction: "none",
          cursor: dragging ? "grabbing" : scale > 1 ? "grab" : "default",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="relative w-full"
          style={{
            aspectRatio,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {map.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={map.image_url}
              alt={`Mapa de ${map.name}`}
              className="absolute inset-0 h-full w-full select-none object-contain"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
              Mapa sin imagen base.
            </div>
          )}

          {map.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (panStart.current?.moved) return;
                setSelected(item);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-deep p-1.5 text-cream shadow-md ring-2 ring-white transition hover:scale-110"
              style={{ left: `${item.normalized_x * 100}%`, top: `${item.normalized_y * 100}%` }}
              title={
                item.linked_tower_id
                  ? (map.towers.find((tower) => tower.id === item.linked_tower_id)?.name ??
                    item.name)
                  : item.name
              }
              aria-label={
                item.linked_tower_id
                  ? (map.towers.find((tower) => tower.id === item.linked_tower_id)?.name ??
                    item.name)
                  : item.name
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={iconSrc(item.icon_key)}
                alt=""
                className="h-4 w-4"
                style={{ filter: "invert(1)" }}
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="absolute bottom-3 left-3 right-3 z-10 mx-auto max-h-[70%] max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-turquoise">
                {LABEL_BY_TYPE[selected.type as MapItemType] ?? selected.type}
              </p>
              <h3 className="mt-1 font-bold text-night">{selectedTower?.name ?? selected.name}</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Cerrar"
              className="text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
          {(selectedTower?.description ?? selected.description) ? (
            <p className="mt-2 text-sm text-slate-600">
              {selectedTower?.description ?? selected.description}
            </p>
          ) : null}
          {selectedTower ? (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Departamentos
              </p>
              {selectedTower.departments.length ? (
                <ul className="mt-2 grid gap-2">
                  {selectedTower.departments.map((department) => (
                    <li key={department.id}>
                      <Link
                        href={`/propiedades/${department.slug}`}
                        className="block rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-50 hover:underline"
                      >
                        {department.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Sin departamentos disponibles</p>
              )}
            </div>
          ) : selected.linked_property_id ? (
            <a
              href="#propiedades"
              onClick={() => setSelected(null)}
              className="mt-3 inline-block text-sm font-semibold text-turquoise hover:underline"
            >
              Ver propiedades →
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
