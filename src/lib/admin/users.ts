import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, mapPostgresError } from "@/lib/errors";
import type { CreateUserInput } from "@/lib/validation";

// Lista de staff (admin/operator). Nunca expone datos de auth (hashes de password).
export async function listStaff() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .in("role", ["admin", "operator"])
    .order("created_at", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return data ?? [];
}

// Alta de usuario interno: solo admin (validado en la acción). Crea el usuario en
// Auth con email confirmado y fija el rol vía RPC (que audita y respeta LAST_ADMIN).
export async function createStaffUser(
  input: CreateUserInput,
  actorId: string,
): Promise<{ userId: string }> {
  const supabase = createAdminClient();
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (createErr || !created.user) {
    if (createErr && /registered|exists/i.test(createErr.message)) {
      throw new AppError("USER_EXISTS", "Ya existe un usuario con ese email", 409);
    }
    throw new AppError("INTERNAL_ERROR", "No se pudo crear el usuario", 500);
  }

  const userId = created.user.id;

  // El trigger handle_new_user crea el profile como guest; completamos datos.
  await supabase
    .from("profiles")
    .update({ full_name: input.fullName, email: input.email, phone: input.phone || null })
    .eq("id", userId);

  // Promoción de rol vía RPC (auditada, respeta invariantes).
  const { error: roleErr } = await supabase.rpc("change_user_role", {
    p_user_id: userId,
    p_new_role: input.role,
    p_reason: "Alta de usuario interno",
    p_actor_id: actorId,
  });
  if (roleErr) throw mapPostgresError(roleErr.message);

  return { userId };
}

export async function changeUserRole(
  userId: string,
  role: "admin" | "operator" | "guest",
  reason: string,
  actorId: string,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("change_user_role", {
    p_user_id: userId,
    p_new_role: role,
    p_reason: reason,
    p_actor_id: actorId,
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as { userId: string; role: string; oldRole?: string };
}
