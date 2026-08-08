"use server";

import { revalidatePath } from "next/cache";
import { requireCleaner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/admin/context";
import { AppError, mapPostgresError } from "@/lib/errors";
import { cleaningReportSchema } from "@/lib/validation";

export type CleaningFormState = { ok: boolean; error: string | null };

// Parte de limpieza declarado por quien limpió. No crea reserva ni bloquea el calendario:
// solo inserta el parte por la RPC, que deriva la cuenta de auth.uid() y arma la copia
// congelada de usuario, nombre y propiedad del lado del servidor.
export async function registerCleaningAction(
  _prev: CleaningFormState,
  formData: FormData,
): Promise<CleaningFormState> {
  try {
    await requireCleaner();
    await assertSameOrigin();

    const result = cleaningReportSchema.safeParse({
      propertyId: formData.get("propertyId"),
      workDate: formData.get("workDate"),
      entryTime: formData.get("entryTime"),
      exitTime: formData.get("exitTime"),
    });
    if (!result.success) {
      return { ok: false, error: result.error.issues[0]?.message ?? "Revisá los datos." };
    }
    const parsed = result.data;

    const supabase = await createClient();
    const { error } = await supabase.rpc("register_cleaning", {
      p_property_id: parsed.propertyId,
      p_work_date: parsed.workDate,
      p_entry_time: parsed.entryTime,
      p_exit_time: parsed.exitTime,
    });
    if (error) throw mapPostgresError(error.message);
  } catch (error) {
    if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
      return { ok: false, error: error.message };
    }
    if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
      return { ok: false, error: "Solicitud rechazada (origen inválido)." };
    }
    console.error("[cleaning-report]", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
  }

  revalidatePath("/admin/limpieza");
  return { ok: true, error: null };
}
