import type { MapItemType } from "./icons";

// Snapshot publicado: función pura, sin I/O ni server-only, para poder testearla y
// compartir el tipo entre editor, visor y capa de datos. Es lo que se congela en
// maps.published_data y lo único que consume el visor público/Flutter.

export type PublishedMapItem = {
  id: string;
  type: MapItemType;
  icon_key: string;
  name: string;
  description: string | null;
  normalized_x: number;
  normalized_y: number;
  normalized_width: number;
  normalized_height: number;
  rotation: number;
  linked_property_id: string | null;
  // Opcional para seguir leyendo snapshots publicados antes de incorporar torres.
  linked_tower_id?: string | null;
  metadata: Record<string, unknown>;
};

// Estructura mínima que necesita el builder (subconjunto de la fila map_items).
export type SnapshotSourceItem = PublishedMapItem & {
  status: "draft" | "published" | "archived";
  is_visible: boolean;
};

// Solo entran los marcadores visibles y no archivados; ocultos/archivados nunca
// llegan al visor.
export function buildPublishedData(items: SnapshotSourceItem[]): PublishedMapItem[] {
  return items
    .filter((it) => it.is_visible && it.status !== "archived")
    .map((it) => ({
      id: it.id,
      type: it.type,
      icon_key: it.icon_key,
      name: it.name,
      description: it.description,
      normalized_x: it.normalized_x,
      normalized_y: it.normalized_y,
      normalized_width: it.normalized_width,
      normalized_height: it.normalized_height,
      rotation: it.rotation,
      linked_property_id: it.linked_property_id,
      linked_tower_id: it.linked_tower_id ?? null,
      metadata: it.metadata,
    }));
}
