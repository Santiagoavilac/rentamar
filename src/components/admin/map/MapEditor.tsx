"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { AdminMapRow, AdminMapItemRow, LinkablePropertyOption } from "@/lib/admin/maps";
import {
  createItemAction,
  updateItemAction,
  deleteItemAction,
  publishMapAction,
} from "@/lib/admin/map-actions";
import {
  MAP_ITEM_TYPES,
  LABEL_BY_TYPE,
  iconSrc,
  iconKeyForType,
  type MapItemType,
} from "@/lib/maps/icons";
import { pixelToNormalized } from "@/lib/maps/coords";
import type { MapItemInput } from "@/lib/validation";

// Editor visual del masterplan. La imagen base nunca se altera: los marcadores viven
// en una capa overlay posicionada en % (coordenadas normalizadas 0..1). Zoom/pan por
// transform CSS. Las ediciones de posición/propiedades quedan en estado local
// ("borrador sin guardar") y se persisten con "Guardar borrador"; "Publicar" congela
// el snapshot que ve el visor público.

type EditorItem = AdminMapItemRow;

const DEFAULT_SIZE = 0.04;
const MIN_SCALE = 1;
const MAX_SCALE = 5;

function toInput(item: EditorItem): MapItemInput {
  return {
    type: item.type,
    name: item.name,
    description: item.description ?? "",
    normalizedX: item.normalized_x,
    normalizedY: item.normalized_y,
    normalizedWidth: item.normalized_width,
    normalizedHeight: item.normalized_height,
    rotation: item.rotation,
    isVisible: item.is_visible,
    linkedPropertyId: item.linked_property_id,
  };
}

export function MapEditor({
  map,
  initialItems,
  properties,
}: {
  map: AdminMapRow;
  initialItems: AdminMapItemRow[];
  properties: LinkablePropertyOption[];
}) {
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addType, setAddType] = useState<MapItemType>("house");
  const [tool, setTool] = useState<"add" | "select">("select");
  const [preview, setPreview] = useState(false);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [publishStep, setPublishStep] = useState(0);
  const [pending, startTransition] = useTransition();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<
    | { kind: "marker"; id: string; moved: boolean }
    | { kind: "pan"; startX: number; startY: number; panX: number; panY: number }
    | null
  >(null);

  const selected = useMemo(
    () => items.find((it) => it.id === selectedId) ?? null,
    [items, selectedId],
  );
  const hasUnsaved = dirtyIds.size > 0;

  const markDirty = useCallback((id: string) => {
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const patchItem = useCallback(
    (id: string, patch: Partial<EditorItem>) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
      markDirty(id);
    },
    [markDirty],
  );

  const aspectRatio =
    map.image_width && map.image_height ? `${map.image_width} / ${map.image_height}` : "16 / 9";

  // Coordenadas normalizadas a partir de un evento de puntero, usando el rect del
  // canvas renderizado (refleja el tamaño real, así el cálculo es independiente del
  // zoom y de la resolución del dispositivo).
  const normalizedFromEvent = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: pixelToNormalized((clientX - rect.left) / scaleRef.current, rect.width / scaleRef.current),
      y: pixelToNormalized((clientY - rect.top) / scaleRef.current, rect.height / scaleRef.current),
    };
  }, []);

  // scale actual accesible desde callbacks sin recrearlos.
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  const addMarkerAt = (clientX: number, clientY: number) => {
    const { x, y } = normalizedFromEvent(clientX, clientY);
    const input: MapItemInput = {
      type: addType,
      name: LABEL_BY_TYPE[addType],
      description: "",
      normalizedX: x,
      normalizedY: y,
      normalizedWidth: DEFAULT_SIZE,
      normalizedHeight: DEFAULT_SIZE,
      rotation: 0,
      isVisible: true,
      linkedPropertyId: null,
    };
    startTransition(async () => {
      const res = await createItemAction(map.id, input);
      if (!res.ok || !res.id) {
        setMessage({ kind: "error", text: res.error ?? "No se pudo agregar el elemento." });
        return;
      }
      const created: EditorItem = {
        id: res.id,
        map_id: map.id,
        type: input.type,
        icon_key: iconKeyForType(input.type),
        name: input.name,
        description: input.description || null,
        normalized_x: input.normalizedX,
        normalized_y: input.normalizedY,
        normalized_width: input.normalizedWidth,
        normalized_height: input.normalizedHeight,
        rotation: input.rotation,
        status: "draft",
        is_visible: input.isVisible,
        linked_property_id: input.linkedPropertyId,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setItems((prev) => [...prev, created]);
      setSelectedId(created.id);
      setMessage(null);
    });
  };

  // ----- Pointer handling on the canvas -----
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (preview) return;
    if (tool === "add") {
      addMarkerAt(e.clientX, e.clientY);
      return;
    }
    // Modo seleccionar: arrastrar el fondo hace pan (solo con zoom).
    if (scale > 1) {
      dragState.current = {
        kind: "pan",
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const onMarkerPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (preview) {
      setSelectedId(id);
      return;
    }
    if (tool !== "select") return;
    setSelectedId(id);
    dragState.current = { kind: "marker", id, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    if (st.kind === "pan") {
      setPan({ x: st.panX + (e.clientX - st.startX), y: st.panY + (e.clientY - st.startY) });
    } else {
      const { x, y } = normalizedFromEvent(e.clientX, e.clientY);
      st.moved = true;
      setItems((prev) =>
        prev.map((it) => (it.id === st.id ? { ...it, normalized_x: x, normalized_y: y } : it)),
      );
    }
  };

  const onCanvasPointerUp = () => {
    const st = dragState.current;
    if (st?.kind === "marker" && st.moved) markDirty(st.id);
    dragState.current = null;
  };

  // ----- Persistence -----
  const saveDraft = () => {
    if (!hasUnsaved) return;
    const toSave = items.filter((it) => dirtyIds.has(it.id));
    startTransition(async () => {
      for (const it of toSave) {
        const res = await updateItemAction(it.id, toInput(it));
        if (!res.ok) {
          setMessage({ kind: "error", text: res.error ?? "No se pudo guardar el borrador." });
          return;
        }
      }
      setDirtyIds(new Set());
      setMessage({ kind: "ok", text: "Borrador guardado." });
    });
  };

  const doPublish = () => {
    startTransition(async () => {
      if (hasUnsaved) {
        for (const it of items.filter((i) => dirtyIds.has(i.id))) {
          const res = await updateItemAction(it.id, toInput(it));
          if (!res.ok) {
            setMessage({
              kind: "error",
              text: res.error ?? "No se pudo guardar antes de publicar.",
            });
            return;
          }
        }
        setDirtyIds(new Set());
      }
      const res = await publishMapAction(map.id);
      setPublishStep(0);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error ?? "No se pudo publicar." });
        return;
      }
      setMessage({ kind: "ok", text: "Cambios publicados. Ya son visibles en el visor." });
    });
  };

  const confirmDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteItemAction(id);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error ?? "No se pudo eliminar." });
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (selectedId === id) setSelectedId(null);
      setConfirmDeleteId(null);
      setMessage(null);
    });
  };

  const visibleItems = preview ? items.filter((it) => it.is_visible) : items;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      {/* ---------- Canvas + toolbar ---------- */}
      <div className="grid gap-3">
        <div className="surface flex flex-wrap items-center gap-2 rounded-xl p-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTool("select")}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${tool === "select" ? "bg-white shadow" : "text-slate-600"}`}
              disabled={preview}
            >
              Seleccionar
            </button>
            <button
              type="button"
              onClick={() => setTool("add")}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${tool === "add" ? "bg-white shadow" : "text-slate-600"}`}
              disabled={preview}
            >
              Agregar
            </button>
          </div>

          {tool === "add" && !preview ? (
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as MapItemType)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              aria-label="Tipo de elemento a agregar"
            >
              {MAP_ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LABEL_BY_TYPE[t]}
                </option>
              ))}
            </select>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.5))}
              className="h-8 w-8 rounded bg-slate-100 font-bold"
              aria-label="Acercar"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.5))}
              className="h-8 w-8 rounded bg-slate-100 font-bold"
              aria-label="Alejar"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setScale(1);
                setPan({ x: 0, y: 0 });
              }}
              className="h-8 rounded bg-slate-100 px-2 text-xs font-semibold"
            >
              Reiniciar
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview((p) => !p);
                setSelectedId(null);
              }}
              className={`h-8 rounded px-3 text-xs font-semibold ${preview ? "bg-deep text-cream" : "bg-slate-100"}`}
            >
              {preview ? "Salir de vista previa" : "Vista previa como residente"}
            </button>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-2xl bg-slate-100"
          style={{ touchAction: "none" }}
        >
          <div
            ref={canvasRef}
            className="relative mx-auto w-full"
            style={{
              aspectRatio,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "center center",
              cursor: tool === "add" && !preview ? "crosshair" : "default",
            }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerLeave={onCanvasPointerUp}
          >
            {map.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={map.image_url}
                alt={`Masterplan de ${map.name}`}
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
                El mapa no tiene imagen base. Subila con el script de carga.
              </div>
            )}

            {visibleItems.map((item) => {
              const isSel = item.id === selectedId && !preview;
              return (
                <button
                  key={item.id}
                  type="button"
                  onPointerDown={(e) => onMarkerPointerDown(e, item.id)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 shadow-md ring-2 transition ${
                    isSel ? "bg-turquoise ring-deep" : "bg-deep ring-white"
                  } ${item.is_visible ? "" : "opacity-40"}`}
                  style={{
                    left: `${item.normalized_x * 100}%`,
                    top: `${item.normalized_y * 100}%`,
                    touchAction: "none",
                  }}
                  title={item.name}
                  aria-label={item.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={iconSrc(item.icon_key)}
                    alt=""
                    className="pointer-events-none h-4 w-4"
                    style={{ filter: "invert(1)" }}
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {tool === "add" && !preview ? (
          <p className="text-sm text-slate-600">
            Hacé clic sobre el mapa para colocar un <strong>{LABEL_BY_TYPE[addType]}</strong>.
          </p>
        ) : null}
      </div>

      {/* ---------- Side panel ---------- */}
      <div className="grid content-start gap-4">
        <div className="surface rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Publicación</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                hasUnsaved ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {hasUnsaved ? "Cambios sin guardar" : "Todo guardado"}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={saveDraft}
              disabled={!hasUnsaved || pending}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Guardar borrador
            </button>
            {publishStep === 0 ? (
              <button
                type="button"
                onClick={() => setPublishStep(1)}
                disabled={pending}
                className="rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream disabled:opacity-40"
              >
                Publicar cambios
              </button>
            ) : (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="font-semibold text-amber-900">
                  ¿Publicar? Esto reemplaza lo que ven los residentes.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={doPublish}
                    disabled={pending}
                    className="rounded bg-deep px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-40"
                  >
                    Sí, publicar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishStep(0)}
                    className="rounded bg-slate-100 px-3 py-1.5 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
          {map.published_at ? (
            <p className="mt-2 text-xs text-slate-500">
              Última publicación: {new Date(map.published_at).toLocaleString("es-BO")}
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Este mapa nunca se publicó.</p>
          )}
          {message ? (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                message.kind === "ok"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-rose-50 text-rose-800"
              }`}
            >
              {message.text}
            </p>
          ) : null}
        </div>

        {/* Properties panel */}
        <div className="surface rounded-xl p-4">
          <h2 className="mb-3 font-bold">Propiedades del elemento</h2>
          {selected ? (
            <ItemProperties
              key={selected.id}
              item={selected}
              properties={properties}
              onChange={(patch) => patchItem(selected.id, patch)}
              onDelete={() => setConfirmDeleteId(selected.id)}
            />
          ) : (
            <p className="text-sm text-slate-600">
              Seleccioná un elemento en el mapa o en la lista para editar sus datos.
            </p>
          )}
        </div>

        {/* Element list */}
        <div className="surface rounded-xl p-4">
          <h2 className="mb-3 font-bold">Elementos ({items.length})</h2>
          {items.length ? (
            <ul className="grid max-h-72 gap-1 overflow-auto">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(it.id);
                      setPreview(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                      it.id === selectedId ? "bg-turquoise/15" : "hover:bg-slate-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={iconSrc(it.icon_key)} alt="" className="h-4 w-4" />
                    <span className="flex-1 truncate">{it.name}</span>
                    {!it.is_visible ? <span className="text-xs text-slate-400">oculto</span> : null}
                    {dirtyIds.has(it.id) ? <span className="text-amber-500">●</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">
              Todavía no hay elementos. Usá la herramienta “Agregar”.
            </p>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDeleteId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h3 className="font-bold">Eliminar elemento</h3>
            <p className="mt-2 text-sm text-slate-600">
              Esta acción no se puede deshacer. El elemento se quita del borrador; los residentes
              dejarán de verlo cuando publiques.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(confirmDeleteId)}
                disabled={pending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ItemProperties({
  item,
  properties,
  onChange,
  onDelete,
}: {
  item: AdminMapItemRow;
  properties: LinkablePropertyOption[];
  onChange: (patch: Partial<AdminMapItemRow>) => void;
  onDelete: () => void;
}) {
  const pct = (n: number) => Math.round(n * 100);
  return (
    <div className="grid gap-3 text-sm">
      <label className="grid gap-1">
        <span className="font-semibold text-slate-600">Nombre</span>
        <input
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={160}
          className="rounded-lg border border-slate-300 px-2 py-1.5"
        />
      </label>

      <label className="grid gap-1">
        <span className="font-semibold text-slate-600">Tipo</span>
        <select
          value={item.type}
          onChange={(e) => {
            const type = e.target.value as MapItemType;
            onChange({ type, icon_key: iconKeyForType(type) });
          }}
          className="rounded-lg border border-slate-300 px-2 py-1.5"
        >
          {MAP_ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {LABEL_BY_TYPE[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1">
        <span className="font-semibold text-slate-600">Descripción</span>
        <textarea
          value={item.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          maxLength={2000}
          rows={3}
          className="rounded-lg border border-slate-300 px-2 py-1.5"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className="font-semibold text-slate-600">
            Ancho ({pct(item.normalized_width)}%)
          </span>
          <input
            type="range"
            min={1}
            max={40}
            value={pct(item.normalized_width)}
            onChange={(e) => onChange({ normalized_width: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-slate-600">
            Alto ({pct(item.normalized_height)}%)
          </span>
          <input
            type="range"
            min={1}
            max={40}
            value={pct(item.normalized_height)}
            onChange={(e) => onChange({ normalized_height: Number(e.target.value) / 100 })}
          />
        </label>
      </div>

      <label className="grid gap-1">
        <span className="font-semibold text-slate-600">Rotación ({item.rotation}°)</span>
        <input
          type="range"
          min={-180}
          max={180}
          value={item.rotation}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
        />
      </label>

      <label className="grid gap-1">
        <span className="font-semibold text-slate-600">Vincular a propiedad</span>
        <select
          value={item.linked_property_id ?? ""}
          onChange={(e) => onChange({ linked_property_id: e.target.value || null })}
          className="rounded-lg border border-slate-300 px-2 py-1.5"
        >
          <option value="">Sin vínculo</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={item.is_visible}
          onChange={(e) => onChange({ is_visible: e.target.checked })}
        />
        <span className="font-semibold text-slate-600">Visible para residentes</span>
      </label>

      <button
        type="button"
        onClick={onDelete}
        className="mt-1 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
      >
        Eliminar elemento
      </button>
    </div>
  );
}
