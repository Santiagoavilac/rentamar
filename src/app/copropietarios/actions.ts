"use server";

import { revalidatePath } from "next/cache";
import { requireCoOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/admin/context";
import { AppError, mapPostgresError } from "@/lib/errors";
import { coOwnerStaySchema } from "@/lib/validation";

export type StayFormState = { ok: boolean; error: string | null; stayId: string | null };

// Registro de estadía declarada. No crea reserva, pago, QR, tarifa, hold ni bloqueo de
// calendario: solo inserta la declaración por la RPC, que deriva la cuenta de auth.uid()
// y arma la copia congelada de usuario, propiedad y habitaciones del lado del servidor.
export async function registerStayAction(
  _prev: StayFormState,
  formData: FormData,
): Promise<StayFormState> {
  let stayId: string;
  try {
    await requireCoOwner();
    await assertSameOrigin();

    let guests: unknown = [];
    try {
      guests = JSON.parse(String(formData.get("guests") ?? "[]"));
    } catch {
      return { ok: false, error: "No se pudieron leer los huéspedes.", stayId: null };
    }

    const result = coOwnerStaySchema.safeParse({
      fullName: formData.get("fullName"),
      documentId: formData.get("documentId"),
      phone: formData.get("phone"),
      birthDate: formData.get("birthDate"),
      nationality: formData.get("nationality"),
      city: formData.get("city"),
      checkInDate: formData.get("checkInDate"),
      checkInTime: formData.get("checkInTime"),
      checkOutDate: formData.get("checkOutDate"),
      checkOutTime: formData.get("checkOutTime"),
      guests,
      minors: formData.get("minors") || 0,
    });
    if (!result.success) {
      return {
        ok: false,
        error: result.error.issues[0]?.message ?? "Revisá los datos.",
        stayId: null,
      };
    }
    const parsed = result.data;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("register_co_owner_stay", {
      p_full_name: parsed.fullName,
      p_document_id: parsed.documentId,
      p_phone: parsed.phone,
      p_check_in_at: parsed.checkInAt,
      p_check_out_at: parsed.checkOutAt,
      // La cantidad de adultos ya no se escribe a mano: sale del declarante más los
      // huéspedes que cargó, así no puede contradecir a la lista.
      p_adults: 1 + parsed.guests.length,
      p_minors: parsed.minors,
    });
    if (error) throw mapPostgresError(error.message);

    // Nacionalidad, ciudad, fecha de nacimiento y huéspedes se guardan aparte para no
    // recrear la RPC `security definer`. Las tablas solo tienen política de lectura, así que
    // va con el cliente admin, acotado al id que la propia RPC acaba de crear después de
    // validar que la estadía es de esta cuenta.
    stayId = (data as unknown as { stayId: string }).stayId;
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("co_owner_stays")
      .update({
        nationality: parsed.nationality,
        city: parsed.city,
        birth_date: parsed.birthDate,
      })
      .eq("id", stayId);
    if (updateError) throw mapPostgresError(updateError.message);

    if (parsed.guests.length) {
      const { error: guestsError } = await admin.from("co_owner_stay_guests").insert(
        parsed.guests.map((guest, index) => ({
          stay_id: stayId,
          full_name: guest.fullName,
          document_id: guest.documentId,
          phone: guest.phone,
          birth_date: guest.birthDate,
          sort_order: index,
        })),
      );
      // La estadía ya quedó registrada, así que el mensaje no puede decir "intentá de nuevo".
      if (guestsError) {
        console.error("[coowner-stay-guests]", guestsError.message);
        revalidatePath("/admin/copropietarios/registros");
        return {
          ok: false,
          error: "La estadía se registró pero no se pudieron guardar los huéspedes. Avisá a administración.",
          stayId,
        };
      }
    }
  } catch (error) {
    if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
      return { ok: false, error: error.message, stayId: null };
    }
    if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
      return { ok: false, error: "Solicitud rechazada (origen inválido).", stayId: null };
    }
    console.error("[coowner-stay]", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "Ocurrió un error. Intentá de nuevo.", stayId: null };
  }

  revalidatePath("/admin/copropietarios/registros");
  return { ok: true, error: null, stayId };
}
