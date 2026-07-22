import { ForbiddenError } from "./errors";

// Matriz de permisos del panel — módulo puro (sin server-only) para poder testearla
// de forma aislada. auth.ts la reexporta junto con las utilidades de sesión.

export type StaffRole = "admin" | "operator";

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
  | "role.change"
  | "map.manage"
  | "map.publish";

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
