import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Property } from "./properties";

// DTO de la ficha de propiedad (detalle público).
export type PropertyDetail = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  propertyType: string | null;
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
  amenities: { name: string; slug: string; icon: string | null }[];
  rates: { startDate: string; endDate: string; nightlyPriceMinor: number; label: string | null }[];
  stayPrices: { nights: number; totalPriceMinor: number }[];
  bookedRanges: string[];
};

type ListFilters = {
  featured?: boolean;
  guests?: number;
};

// Cards del landing. Mapea al shape Property que consume PropertyCard.
export async function getPublishedProperties(filters: ListFilters = {}): Promise<Property[]> {
  const supabase = await createClient();
  let query = supabase
    .from("properties")
    .select(
      "id, name, slug, zone, max_guests, bedrooms, base_price_minor, property_images(url, alt_text, is_cover, sort_order)",
    )
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: true });

  if (filters.featured !== undefined) query = query.eq("featured", filters.featured);
  if (filters.guests !== undefined) query = query.gte("max_guests", filters.guests);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((p) => {
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
      "id, name, slug, short_description, description, rules, location_reference, property_type, zone, max_guests, bedrooms, beds, bathrooms, base_price_minor, currency, minimum_nights, check_in_time, check_out_time, duration_pricing_enabled, status, property_images(url, alt_text, is_cover, sort_order), property_amenities(amenities(name, slug, icon)), property_rates(start_date, end_date, nightly_price_minor, label), property_stay_prices(nights, total_price_minor)",
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

  const amenities = (
    (p.property_amenities ?? []) as { amenities: PropertyDetail["amenities"][number] | null }[]
  )
    .map((row) => row.amenities)
    .filter((a): a is PropertyDetail["amenities"][number] => a !== null);

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDescription: p.short_description,
    description: p.description,
    propertyType: p.property_type,
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
