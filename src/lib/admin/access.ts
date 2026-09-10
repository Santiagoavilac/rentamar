import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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

// ---------- Registro de ingreso, persona por persona ----------

export type CheckinPersonInput = {
  bookingId: string | null;
  stayId: string | null;
  personKind: "titular" | "acompanante";
  personRef: string | null;
  personName: string;
  personDocumentId: string | null;
  wristbandDelivered: boolean;
};

export async function checkInPerson(input: CheckinPersonInput, actorId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("check_in_person", {
    p_booking_id: input.bookingId,
    p_stay_id: input.stayId,
    p_person_kind: input.personKind,
    p_person_ref: input.personRef,
    p_person_name: input.personName,
    p_person_document_id: input.personDocumentId,
    p_wristband: input.wristbandDelivered,
    p_actor_id: actorId,
  });
  if (error) throw mapPostgresError(error.message);
}

export async function undoCheckIn(target: AccessTarget, personRef: string | null): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("undo_check_in", {
    p_booking_id: target.bookingId,
    p_stay_id: target.stayId,
    p_person_ref: personRef,
  });
  if (error) throw mapPostgresError(error.message);
}

export type PersonCheckin = {
  personRef: string | null;
  personName: string;
  wristbandDelivered: boolean;
  checkedInAt: string;
};

// Quiénes de este registro ya pasaron por el mostrador. Alimenta los botones verde/rojo
// del detalle.
export async function listCheckins(target: AccessTarget): Promise<PersonCheckin[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("access_checkins")
    .select("person_ref, person_name, wristband_delivered, checked_in_at");
  query = target.bookingId
    ? query.eq("booking_id", target.bookingId)
    : query.eq("stay_id", target.stayId as string);
  const { data } = await query;
  return (data ?? []).map((row) => ({
    personRef: row.person_ref,
    personName: row.person_name,
    wristbandDelivered: row.wristband_delivered,
    checkedInAt: row.checked_in_at,
  }));
}

// Cuántas personas se registraron por cada reserva/estadía de un lote. Lo usan las tres
// listas de Registros para pintar el verde/ámbar/rojo sin una consulta por fila.
export async function countCheckinsByTarget(params: {
  bookingIds?: string[];
  stayIds?: string[];
}): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const supabase = createAdminClient();

  const load = async (column: "booking_id" | "stay_id", ids: string[]) => {
    if (!ids.length) return;
    const { data } = await supabase.from("access_checkins").select(column).in(column, ids);
    for (const row of data ?? []) {
      const id = (row as Record<string, string | null>)[column];
      if (id) out.set(id, (out.get(id) ?? 0) + 1);
    }
  };

  await load("booking_id", params.bookingIds ?? []);
  await load("stay_id", params.stayIds ?? []);
  return out;
}

export type OfficeCheckinRow = {
  source: string;
  entryId: string;
  checkedInAt: string;
  titular: string;
  phone: string | null;
  checkOut: string;
  lugar: string;
  peopleCheckedIn: number;
  guestCount: number;
};

// Ingresos registrados en oficina dentro de un rango. Va con el cliente de sesión: la RPC
// corta con FORBIDDEN si el que llama no es staff.
export async function listOfficeCheckins(params: {
  from?: string | null;
  to?: string | null;
}): Promise<OfficeCheckinRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_office_checkins", {
    p_from: params.from ?? null,
    p_to: params.to ?? null,
  });
  if (error) throw mapPostgresError(error.message);
  return (data ?? []).map((row) => ({
    source: row.source,
    entryId: row.entry_id,
    checkedInAt: row.checked_in_at,
    titular: row.titular,
    phone: row.phone,
    checkOut: row.check_out,
    lugar: row.lugar,
    peopleCheckedIn: row.people_checked_in,
    guestCount: row.guest_count,
  }));
}

// ¿La oficina ya aprobó el ingreso de este registro? El detalle lo usa para avisar que no
// corresponde marcar la entrada de alguien que todavía no firmó ni dejó la garantía.
export async function isAccessApproved(target: AccessTarget): Promise<boolean> {
  const supabase = createAdminClient();
  let query = supabase.from("access_approvals").select("id");
  query = target.bookingId
    ? query.eq("booking_id", target.bookingId)
    : query.eq("stay_id", target.stayId as string);
  const { data } = await query.maybeSingle();
  return Boolean(data);
}
