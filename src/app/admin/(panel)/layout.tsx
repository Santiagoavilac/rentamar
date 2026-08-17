import Link from "next/link";
import { signOutAction } from "@/app/admin/login/actions";
import { requireStaff } from "@/lib/auth";
import { canPerformAdminAction, type AdminAction, type StaffRole } from "@/lib/permissions";
import { HelpProvider } from "@/components/admin/help";

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
    title: "Copropietarios",
    items: [
      {
        href: "/admin/copropietarios/registros",
        label: "Registros",
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
      <div className="min-h-screen bg-[#f6f4ef] text-night">
        <aside className="hidden fixed inset-y-0 w-60 overflow-y-auto bg-deep p-5 text-cream lg:block">
          <Link href="/admin" className="text-xl font-bold">
            RentaMar <span className="text-turquoise">Admin</span>
          </Link>
          <nav className="mt-8 grid gap-6">
            {groups.map((group) => (
              <div key={group.title} className="grid gap-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-cream/40">
                  {group.title}
                </p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-sm text-cream/80 hover:bg-white/10 hover:text-cream"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <header className="border-b border-slate-200 bg-white px-5 py-3 lg:ml-60">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <nav className="flex gap-4 overflow-auto lg:hidden">
              {groups.map((group) => (
                <div key={group.title} className="flex items-center gap-3">
                  <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {group.title}
                  </span>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="whitespace-nowrap text-sm font-medium"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span>
                {session.fullName || session.email}{" "}
                <span className="text-slate-500">({session.role})</span>
              </span>
              <form action={signOutAction}>
                <button className="rounded border border-slate-300 px-3 py-1.5">Salir</button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-5 lg:ml-60 lg:p-8">{children}</main>
      </div>
    </HelpProvider>
  );
}
