import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import type { PublishedMapItem } from "@/lib/maps/snapshot";
import {
  buildPublishedTowers,
  filterItemsForActiveTowers,
  type PublishedTower,
} from "@/lib/maps/towers";

// Lectura pública del mapa: usa el cliente RLS-aware, cuya política solo devuelve
// mapas con status='published'. El visor lee EXCLUSIVAMENTE el snapshot congelado
// (published_data); nunca toca map_items, así los borradores jamás se exponen.

export type PublishedMap = {
  slug: string;
  name: string;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  version: number;
  published_at: string | null;
  items: PublishedMapItem[];
  towers: PublishedTower[];
};

export async function getPublishedMap(slug: string): Promise<PublishedMap | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maps")
    .select(
      "slug, name, published_image_url, published_image_width, published_image_height, published_version, published_at, published_data",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!data) return null;

  const items = Array.isArray(data.published_data)
    ? (data.published_data as unknown as PublishedMapItem[])
    : [];

  const towerIds = [
    ...new Set(
      items
        .filter((item) => item.type === "tower" && item.linked_tower_id)
        .map((item) => item.linked_tower_id as string),
    ),
  ];
  let towers: PublishedTower[] = [];
  if (towerIds.length > 0) {
    const [towerResult, propertyResult] = await Promise.all([
      supabase
        .from("towers")
        .select("id, name, description")
        .in("id", towerIds)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("properties")
        .select("id, name, slug, tower_id, status")
        .in("tower_id", towerIds)
        .eq("status", "published")
        .order("name", { ascending: true }),
    ]);
    if (towerResult.error || propertyResult.error) {
      throw new AppError("INTERNAL_ERROR", "Error interno", 500);
    }
    towers = buildPublishedTowers(towerResult.data ?? [], propertyResult.data ?? []);
  }
  const publicItems = filterItemsForActiveTowers(items, towers);

  return {
    slug: data.slug,
    name: data.name,
    image_url: data.published_image_url,
    image_width: data.published_image_width,
    image_height: data.published_image_height,
    version: data.published_version ?? 1,
    published_at: data.published_at,
    items: publicItems,
    towers,
  };
}
