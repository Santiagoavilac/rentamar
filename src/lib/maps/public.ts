import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import type { PublishedMapItem } from "@/lib/maps/snapshot";

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
};

export async function getPublishedMap(slug: string): Promise<PublishedMap | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maps")
    .select(
      "slug, name, image_url, image_width, image_height, version, published_at, published_data",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!data) return null;

  const items = Array.isArray(data.published_data)
    ? (data.published_data as unknown as PublishedMapItem[])
    : [];

  return {
    slug: data.slug,
    name: data.name,
    image_url: data.image_url,
    image_width: data.image_width,
    image_height: data.image_height,
    version: data.version,
    published_at: data.published_at,
    items,
  };
}
