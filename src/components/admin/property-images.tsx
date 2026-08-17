"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { GripVertical, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/admin/actions";

export type AdminImage = {
  id: string;
  url: string;
  alt_text: string | null;
  is_cover: boolean;
  sort_order: number;
};

// El orden de la grilla es el orden de la galería pública y la primera es la portada,
// así que no hay un botón de portada aparte: se arrastra al primer lugar y listo.
export function PropertyImagesManager({
  images,
  reorderAction,
  deleteAction,
}: {
  images: AdminImage[];
  reorderAction: (imageIds: string[]) => Promise<ActionResult>;
  deleteAction: (imageId: string) => Promise<ActionResult>;
}) {
  const [items, setItems] = useState(images);
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Se reordena en pantalla al instante y se guarda solo. Si el servidor rechaza,
  // se vuelve al orden anterior para no mostrar algo distinto de lo que hay guardado.
  function persist(next: AdminImage[]) {
    const previous = items;
    setItems(next);
    setError(null);
    startTransition(async () => {
      const result = await reorderAction(next.map((image) => image.id));
      if (!result.ok) {
        setItems(previous);
        setError(result.error ?? "No se pudo guardar el orden.");
      }
    });
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persist(next);
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    move(
      items.findIndex((image) => image.id === dragId),
      items.findIndex((image) => image.id === targetId),
    );
    setDragId(null);
  }

  function handleDelete(image: AdminImage) {
    if (!window.confirm("¿Eliminar esta imagen? No se puede deshacer.")) return;
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== image.id));
    setError(null);
    startTransition(async () => {
      const result = await deleteAction(image.id);
      if (!result.ok) {
        setItems(previous);
        setError(result.error ?? "No se pudo eliminar la imagen.");
      }
    });
  }

  if (!items.length) {
    return (
      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        Esta propiedad todavía no tiene imágenes. Subí la primera con el formulario de arriba.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Arrastrá las imágenes para cambiar el orden en que se ven en la web. La número 1 es la
          portada.
        </p>
        <span className="text-sm text-slate-500">{pending ? "Guardando…" : null}</span>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((image, index) => (
          <li
            key={image.id}
            draggable
            onDragStart={() => setDragId(image.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(image.id)}
            className={`cursor-grab overflow-hidden rounded-xl border bg-white shadow-sm active:cursor-grabbing ${
              dragId === image.id ? "border-cyan-600 opacity-60" : "border-slate-200"
            }`}
          >
            <div className="relative aspect-[4/3] bg-slate-100">
              <Image
                src={image.url}
                alt={image.alt_text || `Imagen ${index + 1}`}
                fill
                sizes="(max-width: 640px) 100vw, 320px"
                className="object-cover"
              />
              <span className="absolute left-2 top-2 rounded-full bg-deep px-2.5 py-1 text-xs font-bold text-cream">
                {index === 0 ? "1 · Portada" : index + 1}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 p-2">
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <GripVertical size={16} /> Arrastrar
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Mover antes"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Mover después"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold disabled:opacity-40"
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label="Eliminar imagen"
                  onClick={() => handleDelete(image)}
                  className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
