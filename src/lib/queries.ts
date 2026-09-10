import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Property } from "./properties";
import type { PropertyClass } from "./property-classes";

// DTO de la ficha de propiedad (detalle público).
export type PropertyDetail = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  propertyType: string | null;
  propertyClass: PropertyClass | null;
  zone: string | null;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  basePriceMinor: number;
  currency: string;
  minimumNights: number;
  checkInTime: string;
  checkOutTime: string;
  rules: string | null;
  locationReference: string | null;
  durationPricingEnabled: boolean;
  images: { url: string; altText: string | null; isCover: boolean; sortOrder: number }[];
  // quantity null = la comodidad está pero no se cuenta (wifi, parrilla).
  amenities: { name: string; slug: string; icon: string | null; quantity: number | null }[];
  rates: { startDate: string; endDate: string; nightlyPriceMinor: number; label: string | null }[];
  stayPrices: { nights: number; totalPriceMinor: number }[];
  bookedRanges: string[];
};

type ListFilters = {
  featured?: boolean;
  guests?: number;
  propertyType?: string;
  propertyClass?: PropertyClass;
  checkIn?: string;
  checkOut?: string;
};

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// La RPC pública de disponibilidad es por propiedad, así que se consulta una vez por
// propiedad y se queda con las que no tengan reserva ni bloqueo dentro del rango pedido.
async function getAvailableIds(
  supabase: ServerClient,
  ids: string[],
  from: string,
  to: string,
): Promise<Set<string>> {
  const checked = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await supabase.rpc("get_property_availability", {
        p_property_id: id,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return (data ?? []).length === 0 ? id : null;
    }),
  );
  return new Set(checked.filter((id) => id !== null));
}

// Tipos de propiedad realmente cargados: el buscador solo ofrece opciones con resultados.
export async function getPropertyTypes(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("property_type")
    .eq("status", "published");
  if (error) throw error;

  const types = new Set<string>();
  for (const row of data ?? []) {
    const type = row.property_type?.trim();
    if (type) types.add(type);
  }
  return [...types].sort((a, b) => a.localeCompare(b, "es"));
}

// Cards del landing. Mapea al shape Property que consume PropertyCard.
export async function getPublishedProperties(filters: ListFilters = {}): Promise<Property[]> {
  const supabase = await createClient();
  let query = supabase
    .from("properties")
    .select(
      "id, name, slug, zone, max_guests, bedrooms, base_price_minor, property_class, property_images(url, alt_text, is_cover, sort_order)",
    )
    .eq("status", "published")
    .order("featured", { ascending: false })
    // Dentro de cada clase, de la más económica a la más cara: es el orden en que la gente
    // compara. El agrupamiento por clase lo hace la portada con propertyClassRank.
    .order("base_price_minor", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters.featured !== undefined) query = query.eq("featured", filters.featured);
  if (filters.guests !== undefined) query = query.gte("max_guests", filters.guests);
  if (filters.propertyType) query = query.ilike("property_type", filters.propertyType);
  if (filters.propertyClass) query = query.eq("property_class", filters.propertyClass);

  const { data, error } = await query;
  if (error) throw error;

  let rows = data ?? [];
  if (filters.checkIn && filters.checkOut) {
    const available = await getAvailableIds(
      supabase,
      rows.map((p) => p.id),
      filters.checkIn,
      filters.checkOut,
    );
    rows = rows.filter((p) => available.has(p.id));
  }

  return rows.map((p) => {
    const images = (p.property_images ?? []) as {
      url: string;
      alt_text: string | null;
      is_cover: boolean;
      sort_order: number;
    }[];
    const cover =
      images.find((img) => img.is_cover) ??
      [...images].sort((a, b) => a.sort_order - b.sort_order)[0];
    return {
      id: p.slug,
      name: p.name,
      zone: p.zone ?? "",
      propertyClass: p.property_class,
      guests: p.base_price_minor > 0 ? p.max_guests : undefined,
      bedrooms: p.bedrooms,
      priceFrom: p.base_price_minor > 0 ? Math.round(p.base_price_minor / 100) : undefined,
      currency: "Bs",
      image: cover?.url ?? "",
      alt: cover?.alt_text ?? p.name,
    } satisfies Property;
  });
}

export const getPropertyBySlug = cache(async (slug: string): Promise<PropertyDetail | null> => {
  const supabase = await createClient();
  const { data: p, error } = await supabase
    .from("properties")
    .select(
      "id, name, slug, short_description, description, rules, location_reference, property_type, property_class, zone, max_guests, bedrooms, beds, bathrooms, base_price_minor, currency, minimum_nights, check_in_time, check_out_time, duration_pricing_enabled, status, property_images(url, alt_text, is_cover, sort_order), property_amenities(quantity, amenities(name, slug, icon)), property_rates(start_date, end_date, nightly_price_minor, label), property_stay_prices(nights, total_price_minor)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  if (!p) return null;

  const today = new Date();
  const to = new Date();
  to.setMonth(to.getMonth() + 12);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const { data: availability } =
    p.base_price_minor > 0
      ? await supabase.rpc("get_property_availability", {
          p_property_id: p.id,
          p_from: fmt(today),
          p_to: fmt(to),
        })
      : { data: [] };

  // La cantidad vive en la tabla puente, no en el catálogo: dos propiedades comparten la
  // comodidad "Televisor" pero cada una tiene los suyos.
  const amenities = (
    (p.property_amenities ?? []) as {
      quantity: number | null;
      amenities: { name: string; slug: string; icon: string | null } | null;
    }[]
  ).flatMap((row) => (row.amenities ? [{ ...row.amenities, quantity: row.quantity }] : []));

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDescription: p.short_description,
    description: p.description,
    propertyType: p.property_type,
    propertyClass: p.property_class,
    zone: p.zone,
    maxGuests: p.max_guests,
    bedrooms: p.bedrooms,
    beds: p.beds,
    bathrooms: p.bathrooms,
    basePriceMinor: p.base_price_minor,
    currency: p.currency,
    minimumNights: p.minimum_nights,
    checkInTime: p.check_in_time.slice(0, 5),
    checkOutTime: p.check_out_time.slice(0, 5),
    rules: p.rules,
    locationReference: p.location_reference,
    durationPricingEnabled: p.duration_pricing_enabled,
    images: [...(p.property_images ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({
        url: img.url,
        altText: img.alt_text,
        isCover: img.is_cover,
        sortOrder: img.sort_order,
      })),
    amenities,
    rates: (p.property_rates ?? []).map((r) => ({
      startDate: r.start_date,
      endDate: r.end_date,
      nightlyPriceMinor: r.nightly_price_minor,
      label: r.label,
    })),
    stayPrices: (p.property_stay_prices ?? []).map((price) => ({
      nights: price.nights,
      totalPriceMinor: price.total_price_minor,
    })),
    bookedRanges: ((availability ?? []) as { stay_range: string }[]).map((r) => r.stay_range),
  };
});
