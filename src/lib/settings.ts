import "server-only";
import { createAdminClient } from "./supabase/admin";

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
