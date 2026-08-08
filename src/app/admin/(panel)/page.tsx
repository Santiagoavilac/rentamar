import Link from "next/link";
import { getDashboardMetrics } from "@/lib/admin/dashboard";
import { Money, Panel, AdminPageHeader, StatusBadge } from "@/components/admin/ui";

export default async function AdminHome() {
  const m = await getDashboardMetrics();
  const cards = [
    ["Pendientes", m.bookings.pendingPayment],
    ["Confirmadas", m.bookings.confirmed],
    ["En revisión", m.bookings.manualReview],
    ["Pagos pendientes", m.payments.pending],
  ];
  return (
    <>
      <AdminPageHeader
        title="Centro operativo"
        description="Estado real de reservas, pagos y disponibilidad."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Panel key={String(label)}>
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </Panel>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="font-bold">Ingresos confirmados</h2>
          <p className="mt-3 text-2xl">
            <Money amount={m.confirmedRevenueMinor} />
          </p>
          <p className="mt-1 text-sm text-slate-600">Solo reservas confirmadas o completadas.</p>
        </Panel>
        <Panel>
          <h2 className="font-bold">Solicitudes de afiliados</h2>
          <p className="mt-3 text-2xl">{m.affiliatePendingRequests}</p>
          <p className="mt-1 text-sm text-slate-600">
            Bloquean fechas hasta que se confirmen o se cancelen. No suman a los ingresos.
          </p>
          <Link
            className="mt-3 inline-block text-sm font-semibold text-cyan-700"
            href="/admin/affiliates"
          >
            Revisar solicitudes
          </Link>
        </Panel>
        <Panel>
          <h2 className="font-bold">Propiedades publicadas</h2>
          <p className="mt-3 text-2xl">{m.publishedProperties}</p>
          <Link
            className="mt-3 inline-block text-sm font-semibold text-cyan-700"
            href="/admin/properties"
          >
            Gestionar propiedades
          </Link>
        </Panel>
        <Panel>
          <h2 className="font-bold">Próximas llegadas</h2>
          {m.upcomingArrivals.length ? (
            <ul className="mt-3 grid gap-2">
              {m.upcomingArrivals.map((b) => (
                <li key={b.id}>
                  <Link
                    className="text-sm font-medium text-cyan-700"
                    href={`/admin/bookings/${b.id}`}
                  >
                    {b.booking_code}
                  </Link>{" "}
                  <span className="text-sm text-slate-600">
                    {b.guest_name} · {b.check_in}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No hay llegadas confirmadas próximas.</p>
          )}
        </Panel>
        <Panel>
          <h2 className="font-bold">Requieren atención</h2>
          {m.attentionBookings.length ? (
            <ul className="mt-3 grid gap-2">
              {m.attentionBookings.map((b) => (
                <li key={b.id} className="flex justify-between">
                  <Link
                    className="text-sm font-medium text-cyan-700"
                    href={`/admin/bookings/${b.id}`}
                  >
                    {b.booking_code}
                  </Link>
                  <StatusBadge value={b.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Sin reservas en revisión.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
