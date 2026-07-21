import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { ForbiddenError } from "./errors";
import type { Database } from "./supabase/types";

export type StaffRole = "admin" | "operator";
export type UserRole = Database["public"]["Enums"]["user_role"];

export type StaffSession = {
  userId: string;
  role: StaffRole;
  fullName: string | null;
  email: string | null;
};

// Acciones del panel. Única fuente de verdad de permisos: la UI oculta botones por
// conveniencia, pero TODA mutación revalida el permiso en el servidor con
// assertAdminAction. Nunca se dispersan comparaciones `role === "admin"` por la app.
export type AdminAction =
  | "property.manage"
  | "rate.manage"
  | "availability.manage"
  | "booking.review"
  | "booking.cancel"
  | "booking.manual_review"
  | "booking.confirm_manual"
  | "payment.review"
  | "payment.manual_review"
  | "audit.read"
  | "user.manage"
  | "role.change";

// Acciones reservadas a admin. El operator puede hacer todo lo demás.
const ADMIN_ONLY: ReadonlySet<AdminAction> = new Set<AdminAction>([
  "booking.confirm_manual",
  "audit.read",
  "user.manage",
  "role.change",
]);

// Matriz de permisos central. Devuelve true si el rol puede ejecutar la acción.
export function canPerformAdminAction(role: StaffRole, action: AdminAction): boolean {
  if (role === "admin") return true;
  if (role === "operator") return !ADMIN_ONLY.has(action);
  return false;
}

// Lanza ForbiddenError (403) si el rol no puede ejecutar la acción. Se llama en
// cada server action ANTES de invocar la RPC service-role.
export function assertAdminAction(role: StaffRole, action: AdminAction): void {
  if (!canPerformAdminAction(role, action)) {
    throw new ForbiddenError();
  }
}

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
