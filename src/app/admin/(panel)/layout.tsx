import Link from "next/link";
import { signOutAction } from "@/app/admin/login/actions";
import { requireStaff } from "@/lib/auth";

const navigation = [
  ["/admin", "Resumen"],
  ["/admin/properties", "Propiedades"],
  ["/admin/calendar", "Calendario"],
  ["/admin/pricing", "Tarifas"],
  ["/admin/mapa", "Mapa"],
  ["/admin/bookings", "Reservas"],
  ["/admin/payments", "Pagos"],
  ["/admin/audit", "Auditoría"],
  ["/admin/users", "Usuarios"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  return (
    <div className="min-h-screen bg-[#f6f4ef] text-night">
      <aside className="hidden fixed inset-y-0 w-60 bg-deep p-5 text-cream lg:block">
        <Link href="/admin" className="text-xl font-bold">
          RentaMar <span className="text-turquoise">Admin</span>
        </Link>
        <nav className="mt-10 grid gap-1">
          {navigation.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 text-sm text-cream/80 hover:bg-white/10 hover:text-cream"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <header className="border-b border-slate-200 bg-white px-5 py-3 lg:ml-60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <nav className="flex gap-3 overflow-auto lg:hidden">
            {navigation.slice(0, 6).map(([href, label]) => (
              <Link key={href} href={href} className="whitespace-nowrap text-sm font-medium">
                {label}
              </Link>
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
  );
}
