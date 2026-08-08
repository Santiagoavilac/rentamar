import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, NotFoundError, SlugTakenError } from "@/lib/errors";
import { iconKeyForType, type MapItemType } from "@/lib/maps/icons";
import { buildPublishedData, type PublishedMapItem } from "@/lib/maps/snapshot";
import { findIncompleteTowerPlacements } from "@/lib/maps/towers";
import type { MapItemInput, MapItemMoveInput, MapCreateInput } from "@/lib/validation";

export type { PublishedMapItem };

// Columnas explícitas: nunca select("*") ni campos arbitrarios del cliente.
const MAP_COLUMNS =
  "id, slug, name, image_url, image_width, image_height, version, published_image_url, published_image_width, published_image_height, published_version, status, published_at, created_at, updated_at";

const ITEM_COLUMNS =
  "id, map_id, type, icon_key, name, description, normalized_x, normalized_y, normalized_width, normalized_height, rotation, status, is_visible, linked_property_id, linked_tower_id, metadata, created_at, updated_at";

export type AdminMapRow = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  version: number;
  published_image_url: string | null;
  published_image_width: number | null;
  published_image_height: number | null;
  published_version: number | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminMapItemRow = {
  id: string;
  map_id: string;
  type: MapItemType;
  icon_key: string;
  name: string;
  description: string | null;
  normalized_x: number;
  normalized_y: number;
  normalized_width: number;
  normalized_height: number;
  rotation: number;
  status: "draft" | "published" | "archived";
  is_visible: boolean;
  linked_property_id: string | null;
  linked_tower_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ---------- Lecturas (RLS-aware: staff ve borradores) ----------

export async function listMaps(): Promise<AdminMapRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maps")
    .select(MAP_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return (data ?? []) as AdminMapRow[];
}

export async function getMapForEditor(
  slug: string,
): Promise<{ map: AdminMapRow; items: AdminMapItemRow[] }> {
  const supabase = await createClient();
  const { data: map, error } = await supabase
    .from("maps")
    .select(MAP_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!map) throw new NotFoundError("Mapa no encontrado");

  const { data: items, error: itemsError } = await supabase
    .from("map_items")
    .select(ITEM_COLUMNS)
    .eq("map_id", (map as AdminMapRow).id)
    .neq("status", "archived")
    .order("created_at", { ascending: true });
  if (itemsError) throw new AppError("INTERNAL_ERROR", "Error interno", 500);

  return { map: map as AdminMapRow, items: (items ?? []) as AdminMapItemRow[] };
}

export type LinkablePropertyOption = { id: string; name: string; slug: string };
export type MapTowerOption = {
  id: string;
  name: string;
  description: string | null;
};

// Opciones para el selector "vincular a propiedad" del editor. Solo id/name/slug:
// nunca precio, dueño ni datos privados (el mapa es contenido de marketing).
export async function listLinkableProperties(): Promise<LinkablePropertyOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, slug")
    .order("name", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return (data ?? []) as LinkablePropertyOption[];
}

export async function listTowersForMap(): Promise<MapTowerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("towers")
    .select("id, name, description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return (data ?? []) as MapTowerOption[];
}

// ---------- Escrituras (service-role, columnas explícitas) ----------

function mapWriteError(message: string | undefined): never {
  if (message && /duplicate key|unique/i.test(message)) throw new SlugTakenError();
  throw new AppError("INTERNAL_ERROR", "Error interno", 500);
}

export async function createMap(input: MapCreateInput, userId: string): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("maps")
    .insert({ slug: input.slug, name: input.name, created_by: userId })
    .select("id")
    .single();
  if (error) mapWriteError(error.message);
  return { id: data.id };
}

// Mapea el input validado a columnas explícitas (anti mass-assignment). El icon_key
// NO viene del cliente: se deriva del tipo con la tabla estable ICON_KEY_BY_TYPE.
function toItemRow(input: MapItemInput) {
  return {
    type: input.type,
    icon_key: iconKeyForType(input.type),
    name: input.name,
    description: input.description || null,
    normalized_x: input.normalizedX,
    normalized_y: input.normalizedY,
    normalized_width: input.normalizedWidth,
    normalized_height: input.normalizedHeight,
    rotation: input.rotation,
    is_visible: input.isVisible,
    linked_property_id: input.linkedPropertyId,
    linked_tower_id: input.linkedTowerId,
  };
}

export async function createItem(
  mapId: string,
  input: MapItemInput,
  userId: string,
): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("map_items")
    .insert({ map_id: mapId, created_by: userId, ...toItemRow(input) })
    .select("id")
    .single();
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      throw new AppError("TOWER_ALREADY_PLACED", "Esta torre ya está ubicada en el mapa", 409);
    }
    throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  }
  return { id: data.id };
}

export async function updateItem(itemId: string, input: MapItemInput): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("map_items").update(toItemRow(input)).eq("id", itemId);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
}

// Solo posición: se usa en el drag para no reescribir el resto del marcador.
export async function moveItem(itemId: string, move: MapItemMoveInput): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("map_items")
    .update({ normalized_x: move.normalizedX, normalized_y: move.normalizedY })
    .eq("id", itemId);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
}

export async function setItemVisibility(itemId: string, visible: boolean): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("map_items")
    .update({ is_visible: visible })
    .eq("id", itemId);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
}

export async function deleteItem(itemId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("map_items").delete().eq("id", itemId);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
}

// Congela el estado actual del editor como versión publicada: escribe el snapshot en
// maps.published_data, marca la fecha y pasa el mapa (y sus marcadores incluidos) a
// 'published'. El visor solo lee este snapshot, así los borradores nunca se exponen.
export async function publishMap(mapId: string): Promise<{ count: number }> {
  const supabase = createAdminClient();
  const [mapResult, itemResult, towerResult] = await Promise.all([
    supabase
      .from("maps")
      .select("image_url, image_width, image_height, version")
      .eq("id", mapId)
      .maybeSingle(),
    supabase.from("map_items").select(ITEM_COLUMNS).eq("map_id", mapId),
    supabase
      .from("towers")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (mapResult.error || itemResult.error || towerResult.error || !mapResult.data) {
    throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  }

  const snapshot = buildPublishedData((itemResult.data ?? []) as AdminMapItemRow[]);
  const incomplete = findIncompleteTowerPlacements(
    towerResult.data ?? [],
    (itemResult.data ?? []) as AdminMapItemRow[],
  );
  if (incomplete.length > 0) {
    throw new AppError(
      "INCOMPLETE_TOWER_PLACEMENT",
      `Ubicá exactamente una vez cada torre activa antes de publicar. Pendientes: ${incomplete
        .map((tower) => tower.name)
        .join(", ")}`,
      422,
    );
  }
  const publishedIds = snapshot.map((it) => it.id);

  const { error: mapError } = await supabase
    .from("maps")
    .update({
      published_data: snapshot as never,
      published_image_url: mapResult.data.image_url,
      published_image_width: mapResult.data.image_width,
      published_image_height: mapResult.data.image_height,
      published_version: mapResult.data.version,
      published_at: new Date().toISOString(),
      status: "published",
    })
    .eq("id", mapId);
  if (mapError) throw new AppError("INTERNAL_ERROR", "Error interno", 500);

  if (publishedIds.length > 0) {
    const { error: itemsError } = await supabase
      .from("map_items")
      .update({ status: "published" })
      .in("id", publishedIds);
    if (itemsError) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  }

  return { count: snapshot.length };
}

// Sube una nueva imagen base (WebP/PNG/JPG) al bucket público 'maps' e incrementa la
// versión del mapa. Las coordenadas son normalizadas, así que reemplazar la imagen no
// mueve ningún marcador. La subida es server-side con service-role (nunca el cliente).
export async function replaceBaseImage(params: {
  mapId: string;
  slug: string;
  file: File;
  width: number;
  height: number;
}): Promise<{ url: string; version: number }> {
  const allowed: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = allowed[params.file.type];
  if (!extension || params.file.size <= 0 || params.file.size > 25 * 1024 * 1024) {
    throw new AppError(
      "VALIDATION_ERROR",
      "La imagen base debe ser JPG, PNG o WebP y pesar hasta 25 MB",
      422,
    );
  }
  const supabase = createAdminClient();

  const { data: current } = await supabase
    .from("maps")
    .select("version")
    .eq("id", params.mapId)
    .maybeSingle();
  const nextVersion = (current?.version ?? 0) + 1;

  const path = `${params.slug}/masterplan-v${nextVersion}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("maps")
    .upload(path, params.file, { contentType: params.file.type, upsert: true });
  if (uploadError) throw new AppError("INTERNAL_ERROR", "No se pudo subir la imagen", 500);

  const { data: publicUrl } = supabase.storage.from("maps").getPublicUrl(path);
  const { error } = await supabase
    .from("maps")
    .update({
      image_url: publicUrl.publicUrl,
      image_width: params.width,
      image_height: params.height,
      version: nextVersion,
    })
    .eq("id", params.mapId);
  if (error) {
    await supabase.storage.from("maps").remove([path]);
    throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  }
  return { url: publicUrl.publicUrl, version: nextVersion };
}
