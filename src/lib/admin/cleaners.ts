import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AppError,
  CleanerHasReportsError,
  NotFoundError,
  UsernameTakenError,
  mapPostgresError,
} from "@/lib/errors";
import { cleanerEmail } from "@/lib/cleaners";
import type { CleanerAccountInput } from "@/lib/validation";

// Capa de datos de las cuentas de limpieza. Las lecturas usan el cliente de sesión (RLS:
// is_staff() ve todo); las escrituras del panel usan service_role, porque la tabla no tiene
// políticas de insert/update a propósito.

const internal = () => new AppError("INTERNAL_ERROR", "Error interno", 500);

export async function createCleanerAccount(
  input: CleanerAccountInput,
  actorId: string,
): Promise<{ accountId: string }> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("cleaner_accounts")
    .select("id")
    .eq("username", input.username)
    .maybeSingle();
  if (existing) throw new UsernameTakenError();

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: cleanerEmail(input.username),
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
    p_new_role: "cleaner",
    p_reason: "Alta de personal de limpieza",
    p_actor_id: actorId,
  });
  if (roleErr) throw mapPostgresError(roleErr.message);

  const { error: insertErr } = await supabase
    .from("cleaner_accounts")
    .insert({ id: userId, username: input.username, full_name: input.fullName });
  if (insertErr) {
    // La cuenta de Auth quedaría huérfana sin registro de limpieza utilizable.
    await supabase.auth.admin.deleteUser(userId);
    throw insertErr.code === "23505" ? new UsernameTakenError() : internal();
  }

  return { accountId: userId };
}

export async function setCleanerPassword(accountId: string, password: string): Promise<void> {
  const supabase = createAdminClient();
  await assertAccountExists(accountId);
  const { error } = await supabase.auth.admin.updateUserById(accountId, { password });
  if (error) throw new AppError("INTERNAL_ERROR", "No se pudo cambiar la contraseña", 500);
}

export async function setCleanerActive(accountId: string, isActive: boolean): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("cleaner_accounts")
    .update({ is_active: isActive })
    .eq("id", accountId);
  if (error) throw internal();
}

// Baja definitiva solo si es segura: con partes registrados se rechaza (el on delete
// restrict de cleaning_reports.account_id lo respalda en la base) y el admin desactiva.
export async function deleteCleanerAccount(accountId: string): Promise<void> {
  const supabase = createAdminClient();

  const { count, error: countErr } = await supabase
    .from("cleaning_reports")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if (countErr) throw internal();
  if ((count ?? 0) > 0) throw new CleanerHasReportsError();

  const { error } = await supabase.auth.admin.deleteUser(accountId);
  if (error) throw new AppError("INTERNAL_ERROR", "No se pudo eliminar la cuenta", 500);
}

async function assertAccountExists(accountId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("cleaner_accounts")
    .select("id")
    .eq("id", accountId)
    .maybeSingle();
  if (!data) throw new NotFoundError("Cuenta no encontrada");
}

export type CleanerAccountRow = {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
};

export async function listCleanerAccounts(): Promise<CleanerAccountRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cleaner_accounts")
    .select("id, username, full_name, is_active")
    .order("username", { ascending: true });
  if (error) throw internal();

  return (data ?? []).map((account) => ({
    id: account.id,
    username: account.username,
    fullName: account.full_name,
    isActive: account.is_active,
  }));
}
