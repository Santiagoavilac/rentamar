import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, NotFoundError, UsernameTakenError, mapPostgresError } from "@/lib/errors";
import { guardEmail } from "@/lib/guards";
import type { GuardAccountInput } from "@/lib/validation";

// Capa de datos de las cuentas de guardia. Espejo de cleaners.ts: las lecturas usan el
// cliente de sesión (RLS: is_staff() ve todo) y las escrituras del panel usan service_role,
// porque la tabla no tiene políticas de insert/update a propósito.

const internal = () => new AppError("INTERNAL_ERROR", "Error interno", 500);

export async function createGuardAccount(
  input: GuardAccountInput,
  actorId: string,
): Promise<{ accountId: string }> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("guard_accounts")
    .select("id")
    .eq("username", input.username)
    .maybeSingle();
  if (existing) throw new UsernameTakenError();

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: guardEmail(input.username),
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
    p_new_role: "guard",
    p_reason: "Alta de guardia de portería",
    p_actor_id: actorId,
  });
  if (roleErr) throw mapPostgresError(roleErr.message);

  const { error: insertErr } = await supabase
    .from("guard_accounts")
    .insert({ id: userId, username: input.username, full_name: input.fullName });
  if (insertErr) {
    // La cuenta de Auth quedaría huérfana sin registro de guardia utilizable.
    await supabase.auth.admin.deleteUser(userId);
    throw insertErr.code === "23505" ? new UsernameTakenError() : internal();
  }

  return { accountId: userId };
}

export async function setGuardPassword(accountId: string, password: string): Promise<void> {
  const supabase = createAdminClient();
  await assertAccountExists(accountId);
  const { error } = await supabase.auth.admin.updateUserById(accountId, { password });
  if (error) throw new AppError("INTERNAL_ERROR", "No se pudo cambiar la contraseña", 500);
}

export async function setGuardActive(accountId: string, isActive: boolean): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("guard_accounts")
    .update({ is_active: isActive })
    .eq("id", accountId);
  if (error) throw internal();
}

// El guardia no registra nada, así que la baja siempre es segura: no hay tabla de partes
// que quede huérfana como en limpieza.
export async function deleteGuardAccount(accountId: string): Promise<void> {
  const supabase = createAdminClient();
  await assertAccountExists(accountId);
  const { error } = await supabase.auth.admin.deleteUser(accountId);
  if (error) throw new AppError("INTERNAL_ERROR", "No se pudo eliminar la cuenta", 500);
}

async function assertAccountExists(accountId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guard_accounts")
    .select("id")
    .eq("id", accountId)
    .maybeSingle();
  if (!data) throw new NotFoundError("Cuenta no encontrada");
}

export type GuardAccountRow = {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
};

export async function listGuardAccounts(): Promise<GuardAccountRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guard_accounts")
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
