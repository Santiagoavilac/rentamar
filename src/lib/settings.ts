import "server-only";
import { createAdminClient } from "./supabase/admin";
import { weekendPricingSchema, type WeekendPricing } from "./validation";

// Modo de confirmación de comprobantes (ver 20260807130200_app_settings.sql).
//   "admin" (Modo B, default): la IA aprueba y un humano confirma la reserva.
//   "auto"  (Modo A): un comprobante aprobado por IA confirma la reserva solo.
export type ReceiptConfirmMode = "admin" | "auto";

// Lee el modo desde app_settings. Ante cualquier duda cae en "admin" (más seguro:
// nunca auto-confirma sin querer).
export async function getReceiptConfirmMode(): Promise<ReceiptConfirmMode> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "receipt_confirm_mode")
    .maybeSingle();
  return data?.value === "auto" ? "auto" : "admin";
}

// Cambia el modo (Modo A/B) desde el panel admin. Se pasa por service_role.
export async function setReceiptConfirmMode(mode: ReceiptConfirmMode): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("app_settings")
    .update({ value: mode, updated_at: new Date().toISOString() })
    .eq("key", "receipt_confirm_mode");
}

// Recargo de fin de semana (ver 20260816120000_weekend_pricing.sql). Es global: los
// mismos días y el mismo % valen para todas las propiedades. Quien manda al cotizar
// es la RPC calculate_booking_price; esto es solo para mostrar y editar el ajuste.
export const WEEKEND_PRICING_DEFAULT: WeekendPricing = { days: [5, 6], surchargePercent: 0 };

export async function getWeekendPricing(): Promise<WeekendPricing> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "weekend_pricing")
    .maybeSingle();
  const parsed = weekendPricingSchema.safeParse(data?.value);
  return parsed.success ? parsed.data : WEEKEND_PRICING_DEFAULT;
}

export async function setWeekendPricing(value: WeekendPricing): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("app_settings")
    .upsert(
      { key: "weekend_pricing", value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
}
