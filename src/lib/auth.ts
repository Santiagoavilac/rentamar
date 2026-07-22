import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { ForbiddenError } from "./errors";
import type { Database } from "./supabase/types";
import { canPerformAdminAction, assertAdminAction, type StaffRole } from "./permissions";

export type { StaffRole, AdminAction } from "./permissions";
export { canPerformAdminAction, assertAdminAction };
export type UserRole = Database["public"]["Enums"]["user_role"];

export type StaffSession = {
  userId: string;
  role: StaffRole;
  fullName: string | null;
  email: string | null;
};

// Lee la sesión actual y verifica que el perfil sea staff (admin/operator).
// Devuelve null si no hay sesión o si el usuario no es staff (p. ej. un guest).
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "operator")) {
    return null;
  }

  return {
    userId: user.id,
    role: profile.role,
    fullName: profile.full_name,
    email: profile.email ?? user.email ?? null,
  };
}

// Exige una sesión de staff; redirige al login si no la hay.
export async function requireStaff(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  return session;
}

// Exige una sesión de admin; redirige a login si no es staff, lanza Forbidden si es operator.
export async function requireAdmin(): Promise<StaffSession> {
  const session = await requireStaff();
  if (session.role !== "admin") throw new ForbiddenError();
  return session;
}
