import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, mapPostgresError } from "@/lib/errors";
import { decimalStringToMinor } from "@/lib/money";
import type { RateInput } from "@/lib/validation";
import type { PropertyPricingInput } from "@/lib/validation";

export async function listRates(propertyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_rates")
    .select("id, start_date, end_date, nightly_price_minor, minimum_nights, label")
    .eq("property_id", propertyId)
    .order("start_date", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return data ?? [];
}

export async function listPriceHistory(propertyId: string, limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_change_history")
    .select("id, change_type, old_value, new_value, changed_by, reason, created_at")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return data ?? [];
}

export async function listStayPrices(propertyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_stay_prices")
    .select("id, nights, total_price_minor")
    .eq("property_id", propertyId)
    .order("nights", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return data ?? [];
}

export async function savePropertyPricing(
  propertyId: string,
  input: PropertyPricingInput,
  actorId: string,
) {
  const supabase = createAdminClient();
  const prices = input.prices.map((price) => ({
    nights: price.nights,
    totalMinor: decimalStringToMinor(price.total),
  }));
  const { data, error } = await supabase.rpc("save_property_pricing", {
    p_property_id: propertyId,
    p_base_price_minor: decimalStringToMinor(input.basePrice),
    p_duration_pricing_enabled: input.durationPricingEnabled,
    p_prices: prices,
    p_actor_id: actorId,
    p_reason: input.reason,
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as {
    propertyId: string;
    basePriceMinor: number;
    durationPricingEnabled: boolean;
  };
}

// El precio de reserva para afiliados se carga junto con la propiedad, pero pasa
// por esta RPC para quedar registrado en price_change_history.
export async function saveAffiliatePricing(
  propertyId: string,
  nightlyMinor: number | null,
  reason: string,
  actorId: string,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("set_property_affiliate_pricing", {
    p_property_id: propertyId,
    p_nightly_minor: nightlyMinor,
    p_reason: reason,
    p_actor_id: actorId,
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as {
    propertyId: string;
    affiliateNightlyPriceMinor: number | null;
  };
}

export async function createRate(propertyId: string, input: RateInput, actorId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_property_rate", {
    p_property_id: propertyId,
    p_start: input.startDate,
    p_end: input.endDate,
    p_price_minor: decimalStringToMinor(input.price),
    p_minimum_nights: input.minimumNights ?? 1,
    p_label: input.label || "",
    p_actor_id: actorId,
    p_reason: "",
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as { rateId: string };
}

export async function updateRate(rateId: string, input: RateInput, actorId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("update_property_rate", {
    p_rate_id: rateId,
    p_start: input.startDate,
    p_end: input.endDate,
    p_price_minor: decimalStringToMinor(input.price),
    p_minimum_nights: input.minimumNights ?? 1,
    p_label: input.label || "",
    p_actor_id: actorId,
    p_reason: "",
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as { rateId: string };
}

export async function removeRate(rateId: string, actorId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("remove_property_rate", {
    p_rate_id: rateId,
    p_actor_id: actorId,
    p_reason: "",
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as { rateId: string; removed: boolean };
}

export async function changeBasePrice(
  propertyId: string,
  price: string,
  reason: string,
  actorId: string,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("change_property_base_price", {
    p_property_id: propertyId,
    p_new_minor: decimalStringToMinor(price),
    p_reason: reason,
    p_actor_id: actorId,
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as { propertyId: string; basePriceMinor: number };
}
