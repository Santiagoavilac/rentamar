import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { mapPostgresError } from "./errors";
import type { Property } from "./properties";
import type { PropertyDetail } from "./queries";
import type { CreateAffiliateRequestInput, QuoteInput } from "./validation";

// Canal de afiliados: tarifa plana por noche, cierre por WhatsApp en lugar de QR.
// El flujo es anónimo, así que todo pasa por RPC security definer y la capa de
// servidor nunca confía en montos enviados por el cliente.

export const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "59178013406";

export type AffiliateQuote = {
  currency: string;
  nights: number;
  originalSubtotalMinor: number;
  subtotalMinor: number;
  cleaningFeeMinor: number;
  serviceFeeMinor: number;
  discountMinor: number;
  discountPercent: number;
  pricingMode: "affiliate_flat";
  durationPriceMinor: number | null;
  totalMinor: number;
  items: {
    type: string;
    description: string;
    quantity: number;
    unitAmountMinor: number;
    totalAmountMinor: number;
  }[];
};

// El catálogo de afiliados es el catálogo público completo. Una propiedad sin
// precio de afiliado cargado igual se lista, pero no se puede reservar todavía.
export type AffiliatePropertyDetail = PropertyDetail & {
  affiliateNightlyPriceMinor: number | null;
};

export async function listAffiliateProperties(): Promise<Property[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, name, slug, zone, max_guests, bedrooms, affiliate_nightly_price_minor, property_images(url, alt_text, is_cover, sort_order)",
    )
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((p) => {
    const images = p.property_images ?? [];
    const cover =
      images.find((img) => img.is_cover) ??
      [...images].sort((a, b) => a.sort_order - b.sort_order)[0];
    const nightly = p.affiliate_nightly_price_minor ?? 0;
    return {
      id: p.slug,
      name: p.name,
      zone: p.zone ?? "",
      guests: p.max_guests,
      bedrooms: p.bedrooms,
      priceFrom: nightly > 0 ? Math.round(nightly / 100) : undefined,
      currency: "Bs",
      image: cover?.url ?? "",
      alt: cover?.alt_text ?? p.name,
    } satisfies Property;
  });
}

export const getAffiliatePropertyBySlug = cache(
  async (slug: string): Promise<AffiliatePropertyDetail | null> => {
    const supabase = await createClient();
    const { data: p, error } = await supabase
      .from("properties")
      .select(
        "id, name, slug, short_description, description, rules, location_reference, property_type, zone, max_guests, bedrooms, beds, bathrooms, base_price_minor, currency, minimum_nights, check_in_time, check_out_time, duration_pricing_enabled, affiliate_nightly_price_minor, property_images(url, alt_text, is_cover, sort_order), property_amenities(amenities(name, slug, icon))",
      )
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw error;
    if (!p) return null;

    const from = new Date();
    const to = new Date();
    to.setMonth(to.getMonth() + 12);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: availability } = await supabase.rpc("get_property_availability", {
      p_property_id: p.id,
      p_from: fmt(from),
      p_to: fmt(to),
    });

    const amenities = (p.property_amenities ?? [])
      .map((row) => row.amenities)
      .filter((a): a is NonNullable<typeof a> => a !== null);

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
      // La tarifa de afiliado es plana: los descuentos por duración no aplican.
      durationPricingEnabled: false,
      images: [...(p.property_images ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((img) => ({
          url: img.url,
          altText: img.alt_text,
          isCover: img.is_cover,
          sortOrder: img.sort_order,
        })),
      amenities,
      rates: [],
      stayPrices: [],
      bookedRanges: ((availability ?? []) as { stay_range: string }[]).map((r) => r.stay_range),
      affiliateNightlyPriceMinor: p.affiliate_nightly_price_minor,
    };
  },
);

export async function getAffiliateQuote(input: QuoteInput): Promise<AffiliateQuote> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("calculate_affiliate_booking_price", {
    p_property_id: input.propertyId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guest_count: input.guestCount,
  });

  if (error) throw mapPostgresError(error.message);
  return data as unknown as AffiliateQuote;
}

export type AffiliateRequestResult = {
  bookingId: string;
  bookingCode: string;
  currency: string;
  nights: number;
  nightlyMinor: number;
  totalMinor: number;
  checkIn: string;
  checkOut: string;
};

export async function createAffiliateRequest(
  input: CreateAffiliateRequestInput,
): Promise<AffiliateRequestResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_affiliate_booking_request", {
    p_property_id: input.propertyId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guest_count: input.guestCount,
    p_affiliate_name: input.affiliate.fullName,
    p_affiliate_document_id: input.affiliate.documentId,
    p_affiliate_phone: input.affiliate.phone,
    p_affiliate_email: input.affiliate.email || null,
    p_companions: input.companions.map((c, index) => ({
      fullName: c.fullName,
      documentId: c.documentId,
      phone: c.phone || null,
      sortOrder: index,
    })),
  });

  if (error) throw mapPostgresError(error.message);

  const result = data as unknown as AffiliateRequestResult;

  // Nacionalidad, ciudad y CI van en un update aparte, por el mismo motivo que en
  // `createBooking`: no tocar la RPC `security definer` que ya está en producción.
  // `guest_document_id` lo necesita la declaración jurada (target booking).
  await supabase
    .from("bookings")
    .update({
      guest_document_id: input.affiliate.documentId,
      guest_nationality: input.affiliate.nationality,
      guest_city: input.affiliate.city,
    })
    .eq("id", result.bookingId);

  return result;
}

// El mensaje se arma con los datos que devolvió la RPC, nunca con los del cliente.
export function buildWhatsappMessage(params: {
  propertyName: string;
  result: AffiliateRequestResult;
  affiliate: CreateAffiliateRequestInput["affiliate"];
  companions: CreateAffiliateRequestInput["companions"];
  guestCount: number;
}): string {
  const { result, affiliate, companions } = params;
  const money = (minor: number) =>
    `${result.currency} ${(minor / 100).toLocaleString("es-BO", { minimumFractionDigits: 2 })}`;

  const lines = [
    `Solicitud de reserva de afiliado ${result.bookingCode}`,
    "",
    "PROPIEDAD",
    params.propertyName,
    "",
    "AFILIADO",
    `Nombre: ${affiliate.fullName}`,
    `CI: ${affiliate.documentId}`,
    `Teléfono: ${affiliate.phone}`,
  ];

  if (affiliate.email) lines.push(`Email: ${affiliate.email}`);

  lines.push("", "ACOMPAÑANTES");
  if (companions.length === 0) {
    lines.push("Sin acompañantes");
  } else {
    companions.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.fullName} — CI ${c.documentId}${c.phone ? ` — ${c.phone}` : ""}`);
    });
  }

  lines.push(
    "",
    "RESERVA",
    `Ingreso: ${result.checkIn}`,
    `Salida: ${result.checkOut}`,
    `Noches: ${result.nights}`,
    `Huéspedes: ${params.guestCount}`,
    `Tarifa afiliado: ${money(result.nightlyMinor)} por noche`,
    `Total: ${money(result.totalMinor)}`,
  );

  return lines.join("\n");
}

export function buildWhatsappUrl(message: string, phone: string = WHATSAPP_NUMBER): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
