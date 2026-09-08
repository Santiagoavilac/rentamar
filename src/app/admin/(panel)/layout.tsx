import { requireStaff } from "@/lib/auth";
import { canPerformAdminAction, type AdminAction, type StaffRole } from "@/lib/permissions";
import { HelpProvider } from "@/components/admin/help";
import { AdminShell } from "@/components/admin/admin-shell";

// Menú agrupado por área de trabajo. Cada entrada declara el permiso que la
// habilita para no mostrarle al operator pantallas que le devolverían un 403.
type NavItem = { href: string; label: string; requires?: AdminAction };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operación",
    items: [
      { href: "/admin", label: "Resumen" },
      { href: "/admin/calendar", label: "Disponibilidad" },
      { href: "/admin/bookings", label: "Reservas" },
      { href: "/admin/accesos", label: "Control de acceso", requires: "access.review" },
      { href: "/admin/limpieza", label: "Limpieza", requires: "cleaning.manage" },
      { href: "/admin/affiliates", label: "Afiliados", requires: "affiliate.review" },
      { href: "/admin/payments", label: "Pagos", requires: "payment.review" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/admin/properties", label: "Propiedades", requires: "property.manage" },
      { href: "/admin/towers", label: "Torres", requires: "property.manage" },
      { href: "/admin/pricing", label: "Tarifas", requires: "rate.manage" },
      { href: "/admin/mapa", label: "Mapa", requires: "map.manage" },
    ],
  },
  {
    title: "Registros",
    items: [
      { href: "/admin/registros/huespedes", label: "Huéspedes", requires: "declaration.read" },
      { href: "/admin/registros/afiliados", label: "Afiliados", requires: "declaration.read" },
      {
        href: "/admin/copropietarios/registros",
        label: "Copropietarios",
        requires: "coowner.manage",
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/users", label: "Usuarios", requires: "user.manage" },
      { href: "/admin/audit", label: "Auditoría", requires: "audit.read" },
    ],
  },
];

function visibleGroups(role: StaffRole) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.requires || canPerformAdminAction(role, item.requires),
    ),
  })).filter((group) => group.items.length > 0);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  const groups = visibleGroups(session.role);

  return (
    <HelpProvider>
      <AdminShell
        groups={groups}
        accountLabel={session.fullName || session.email || "Usuario del panel"}
        role={session.role}
      >
        {children}
      </AdminShell>
    </HelpProvider>
  );
}
