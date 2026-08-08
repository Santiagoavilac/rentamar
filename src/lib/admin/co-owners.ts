import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AppError,
  CoOwnerHasStaysError,
  NotFoundError,
  UsernameTakenError,
  mapPostgresError,
} from "@/lib/errors";
import { coOwnerEmail } from "@/lib/co-owners";
import type { CoOwnerAccountInput } from "@/lib/validation";

// Capa de datos del módulo de copropietarios. Las lecturas usan el cliente de sesión
// (RLS: is_staff() ve todo); las escrituras del panel usan service_role, igual que el alta
// de staff, porque las tablas no tienen políticas de insert/update a propósito.

const internal = () => new AppError("INTERNAL_ERROR", "Error interno", 500);

// ---------- Cuentas ----------

// Alta de copropietario en un solo paso: crea el usuario en Auth con el email interno
// derivado del username (ya confirmado, sin invitación ni verificación), lo promueve a
// co_owner con la misma RPC auditada que usa el staff, y registra la cuenta con su
// propiedad y cantidad de habitaciones.
export async function createCoOwnerAccount(
  input: CoOwnerAccountInput,
  actorId: string,
): Promise<{ accountId: string }> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("co_owner_accounts")
    .select("id")
    .eq("username", input.username)
    .maybeSingle();
  if (existing) throw new UsernameTakenError();

  const email = coOwnerEmail(input.username);
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    if (createErr && /registered|exists/i.test(createErr.message)) throw new UsernameTakenError();
    throw new AppError("INTERNAL_ERROR", "No se pudo crear la cuenta", 500);
  }

  const userId = created.user.id;
  const { error: roleErr } = await supabase.rpc("change_user_role", {
    p_user_id: userId,
    p_new_role: "co_owner",
    p_reason: "Alta de copropietario",
    p_actor_id: actorId,
  });
  if (roleErr) throw mapPostgresError(roleErr.message);

  const { error: insertErr } = await supabase
    .from("co_owner_accounts")
    .insert({
      id: userId,
      username: input.username,
      property_name: input.propertyName,
      room_count: input.roomCount,
    });
  if (insertErr) {
    // La cuenta de Auth quedaría huérfana sin profile de copropietario utilizable.
    await supabase.auth.admin.deleteUser(userId);
    throw insertErr.code === "23505" ? new UsernameTakenError() : internal();
  }

  return { accountId: userId };
}

export async function setCoOwnerPassword(accountId: string, password: string): Promise<void> {
  const supabase = createAdminClient();
  await assertAccountExists(accountId);
  const { error } = await supabase.auth.admin.updateUserById(accountId, { password });
  if (error) throw new AppError("INTERNAL_ERROR", "No se pudo cambiar la contraseña", 500);
}

export async function setCoOwnerActive(accountId: string, isActive: boolean): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("co_owner_accounts")
    .update({ is_active: isActive })
    .eq("id", accountId);
  if (error) throw internal();
}

// Baja definitiva, solo si es segura: con estadías registradas se rechaza (el
// on delete restrict de co_owner_stays.account_id lo respalda en la base) y el admin
// desactiva en su lugar. Sin estadías se borra el usuario de Auth, y el on delete cascade
// limpia profiles y co_owner_accounts.
export async function deleteCoOwnerAccount(accountId: string): Promise<void> {
  const supabase = createAdminClient();

  const { count, error: countErr } = await supabase
    .from("co_owner_stays")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if (countErr) throw internal();
  if ((count ?? 0) > 0) throw new CoOwnerHasStaysError();

  const { error } = await supabase.auth.admin.deleteUser(accountId);
  if (error) throw new AppError("INTERNAL_ERROR", "No se pudo eliminar la cuenta", 500);
}

async function assertAccountExists(accountId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("co_owner_accounts")
    .select("id")
    .eq("id", accountId)
    .maybeSingle();
  if (!data) throw new NotFoundError("Cuenta no encontrada");
}

export type CoOwnerAccountRow = {
  id: string;
  username: string;
  isActive: boolean;
  propertyName: string;
  roomCount: number;
  createdAt: string;
};

export async function listCoOwnerAccounts(): Promise<CoOwnerAccountRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("co_owner_accounts")
    .select("id, username, is_active, property_name, room_count, created_at")
    .order("username", { ascending: true });
  if (error) throw internal();

  return (data ?? []).map((account) => ({
    id: account.id,
    username: account.username,
    isActive: account.is_active,
    propertyName: account.property_name,
    roomCount: account.room_count,
    createdAt: account.created_at,
  }));
}

// Lo que el copropietario ve de solo lectura en su formulario de estadía.
export async function getCoOwnerAccount(accountId: string): Promise<CoOwnerAccountRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("co_owner_accounts")
    .select("id, username, is_active, property_name, room_count, created_at")
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw internal();
  if (!data) throw new NotFoundError("Cuenta no encontrada");
  return {
    id: data.id,
    username: data.username,
    isActive: data.is_active,
    propertyName: data.property_name,
    roomCount: data.room_count,
    createdAt: data.created_at,
  };
}

// Opciones del filtro de Registros: los nombres tal como los guardan las cuentas.
export async function listCoOwnerPropertyNames(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("co_owner_accounts")
    .select("property_name")
    .order("property_name", { ascending: true });
  if (error) throw internal();
  return [...new Set((data ?? []).map((row) => row.property_name))];
}

// ---------- Estadías declaradas ----------

const STAY_COLUMNS =
  "id, created_at, username, property_name, room_count, full_name, document_id, phone, birth_date, check_in_at, check_out_at, adults, minors, account_id";

export type CoOwnerStayRow = {
  id: string;
  created_at: string;
  username: string;
  property_name: string;
  room_count: number;
  full_name: string;
  document_id: string;
  phone: string;
  birth_date: string | null;
  check_in_at: string;
  check_out_at: string;
  adults: number;
  minors: number;
  account_id: string;
};

// Huéspedes del 2 en adelante. El 1 son las columnas full_name/document_id/phone de la
// propia estadía, porque es quien la registra y firma la declaración jurada.
export type CoOwnerStayGuestRow = {
  full_name: string;
  document_id: string;
  phone: string | null;
  birth_date: string;
};

// Misma forma de retorno que listBookings, para que el Pager funcione igual. El orden es
// created_at descendente: el registro más reciente primero.
export async function listCoOwnerStays(params: {
  page: number;
  pageSize: number;
  propertyName?: string;
  accountId?: string;
  from?: string;
  to?: string;
}) {
  const supabase = await createClient();
  const offset = (params.page - 1) * params.pageSize;

  let query = supabase
    .from("co_owner_stays")
    .select(STAY_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + params.pageSize - 1);

  if (params.propertyName) query = query.eq("property_name", params.propertyName);
  if (params.accountId) query = query.eq("account_id", params.accountId);
  if (params.from) query = query.gte("created_at", `${params.from}T00:00:00`);
  if (params.to) query = query.lte("created_at", `${params.to}T23:59:59`);

  const { data, error, count } = await query;
  if (error) throw internal();
  return {
    rows: (data ?? []) as CoOwnerStayRow[],
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function getCoOwnerStay(
  id: string,
): Promise<CoOwnerStayRow & { guests: CoOwnerStayGuestRow[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("co_owner_stays")
    .select(STAY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw internal();
  if (!data) throw new NotFoundError("Registro no encontrado");

  const { data: guests, error: guestsError } = await supabase
    .from("co_owner_stay_guests")
    .select("full_name, document_id, phone, birth_date")
    .eq("stay_id", id)
    .order("sort_order");
  if (guestsError) throw internal();

  return { ...(data as CoOwnerStayRow), guests: guests ?? [] };
}
