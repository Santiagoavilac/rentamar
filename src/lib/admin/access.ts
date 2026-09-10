import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapPostgresError } from "@/lib/errors";
import type { AccessTarget } from "@/lib/access";
import type { AccessApprovalInput } from "@/lib/validation";

// Escrituras del control de acceso. La lectura unificada vive en src/lib/access.ts, porque
// la comparten el panel y la pantalla de guardias.

export async function approveAccess(input: AccessApprovalInput, actorId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("approve_access", {
    p_booking_id: input.bookingId,
    p_stay_id: input.stayId,
    p_declaration: input.declarationSigned,
    p_deposit: input.depositReceived,
    p_wristbands: input.wristbandsDelivered,
    p_notes: input.notes ?? null,
    p_actor_id: actorId,
  });
  if (error) throw mapPostgresError(error.message);
}

export async function revokeAccess(target: AccessTarget): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("revoke_access", {
    p_booking_id: target.bookingId,
    p_stay_id: target.stayId,
  });
  if (error) throw mapPostgresError(error.message);
}

// Los alquileres del canal directo solo guardan el titular y la cantidad de huéspedes: los
// nombres del resto se cargan acá, cuando el grupo pasa por la oficina. Reutiliza la RPC
// que ya usa el canal de afiliados, que es agnóstica del canal.
export async function setAccessCompanions(
  bookingId: string,
  companions: { fullName: string; documentId: string }[],
  actorId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("set_booking_companions", {
    p_booking_id: bookingId,
    // El orden lo fija la propia RPC con la posición en el arreglo.
    p_companions: companions.map((companion) => ({
      fullName: companion.fullName,
      documentId: companion.documentId,
    })),
    p_actor_id: actorId,
  });
  if (error) throw mapPostgresError(error.message);
}

export type BookingCompanionRow = {
  id: string;
  full_name: string;
  document_id: string;
  phone: string | null;
  sort_order: number;
};

// Acompañantes de una reserva, sin importar el canal. La ficha de afiliados ya los leía por
// su cuenta; esto lo deja disponible también para el alquiler directo, donde recepción los
// carga a mano con setAccessCompanions.
export async function listBookingCompanions(bookingId: string): Promise<BookingCompanionRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("booking_companions")
    .select("id, full_name, document_id, phone, sort_order")
    .eq("booking_id", bookingId)
    .order("sort_order", { ascending: true });
  return (data ?? []) as BookingCompanionRow[];
}
