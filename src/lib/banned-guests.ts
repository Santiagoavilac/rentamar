import "server-only";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import { AppError } from "./errors";
import { hashIp } from "./audit";
import { normalizeDocumentId } from "./document-id";

// Lista de huéspedes vetados. El bloqueo real lo hace la base con triggers sobre las tablas
// donde entra una persona; acá vive la administración de la lista y el registro del intento.

export const BANNED_GUEST_CODE = "GUEST_BANNED";

// Lo que ve el público. No dice que la persona está vetada ni por qué: eso es información
// de administración, y confirmárselo a quien intenta registrarla no ayuda a nadie.
export const BANNED_GUEST_PUBLIC_MESSAGE =
  "No podemos completar este registro. Comunicate con la administración de RentaMar.";

export function isBannedGuestError(error: unknown): boolean {
  if (error instanceof AppError) return error.code === BANNED_GUEST_CODE;
  if (error instanceof Error) return error.message.includes(BANNED_GUEST_CODE);
  return false;
}

export type BannedGuestRow = {
  id: string;
  full_name: string;
  document_id: string;
  reason: string | null;
  created_at: string;
  revoked_at: string | null;
};

export async function listBannedGuests(params: {
  search?: string | null;
  includeRevoked?: boolean;
}): Promise<BannedGuestRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("banned_guests")
    .select("id, full_name, document_id, reason, created_at, revoked_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!params.includeRevoked) query = query.is("revoked_at", null);
  const search = params.search?.trim();
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,document_id.ilike.%${search}%`);
  }
  const { data } = await query;
  return (data ?? []) as BannedGuestRow[];
}

export async function addBannedGuest(
  input: { fullName: string; documentId: string; reason: string | null },
  actorId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("banned_guests").insert({
    full_name: input.fullName,
    document_id: input.documentId,
    reason: input.reason,
    created_by: actorId,
  });
  if (error) {
    // El índice único parcial es lo que impide dos vetos vigentes del mismo documento.
    if (error.code === "23505") {
      throw new AppError("VALIDATION_ERROR", "Ese documento ya está en la lista", 409);
    }
    throw new AppError("INTERNAL_ERROR", "No se pudo agregar a la lista", 500);
  }
}

// Se revoca, no se borra: hay que poder auditar quién vetó a quién y hasta cuándo.
export async function revokeBannedGuest(id: string, actorId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("banned_guests")
    .update({ revoked_at: new Date().toISOString(), revoked_by: actorId })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) throw new AppError("INTERNAL_ERROR", "No se pudo quitar de la lista", 500);
}

export type BannedAttemptPerson = { nombre: string; carnet: string };

export type BannedAttemptRow = {
  id: string;
  channel: string;
  submitted: BannedAttemptPerson[];
  created_at: string;
};

// El "avisar al admin". Se escribe desde la aplicación y no desde el trigger porque la
// excepción del trigger hace rollback de su propia transacción: una fila insertada ahí
// adentro no sobreviviría.
//
// Best-effort a propósito: el bloqueo ya ocurrió, y no vale la pena romper la respuesta al
// usuario porque falló el registro del intento.
export async function recordBannedAttempt(params: {
  channel: "alquiler" | "afiliado" | "copropietario";
  submitted: BannedAttemptPerson[];
  ip?: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("banned_guest_attempts").insert({
      channel: params.channel,
      submitted: params.submitted,
      ip_hash: hashIp(params.ip),
    });
  } catch (error) {
    console.error("[banned-attempt]", error instanceof Error ? error.message : "unknown");
  }
}

export async function listBannedAttempts(limit = 20): Promise<BannedAttemptRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("banned_guest_attempts")
    .select("id, channel, submitted, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id,
    channel: row.channel,
    submitted: Array.isArray(row.submitted) ? (row.submitted as BannedAttemptPerson[]) : [],
    created_at: row.created_at,
  }));
}

// Chequeo previo para el canal directo. El bloqueo autoritativo son los triggers, pero ahí
// el carnet del huésped se guarda en un update posterior a la RPC: sin esto la reserva ya
// estaría creada (y las fechas bloqueadas) cuando el trigger la frena.
export async function assertGuestsNotBanned(
  documents: (string | null | undefined)[],
): Promise<void> {
  const normalized = documents
    .map(normalizeDocumentId)
    .filter((doc): doc is string => doc !== null);
  if (!normalized.length) return;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("banned_guests")
    .select("id")
    .in("document_normalized", normalized)
    .is("revoked_at", null)
    .limit(1);
  if (data?.length) {
    throw new AppError(BANNED_GUEST_CODE, BANNED_GUEST_PUBLIC_MESSAGE, 409);
  }
}
