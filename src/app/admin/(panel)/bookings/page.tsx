import Link from "next/link";
import { listBookings } from "@/lib/admin/bookings";
import {
  AdminPageHeader,
  EmptyState,
  Money,
  Pager,
  Panel,
  StatusBadge,
} from "@/components/admin/ui";
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const p = await searchParams;
  const result = await listBookings({
    page: Math.max(1, Number(p.page) || 1),
    pageSize: 20,
    status: p.status,
  });
  return (
    <>
      <AdminPageHeader
        title="Reservas"
        description="Listado operativo sin tokens de acceso ni hashes."
      />
      <div className="mb-4 flex gap-2">
        {["", "pending_payment", "confirmed", "manual_review", "cancelled", "expired"].map((s) => (
          <Link
            key={s || "all"}
            className={`rounded-full px-3 py-1 text-sm ${p.status === s || (!p.status && !s) ? "bg-deep text-cream" : "bg-white border"}`}
            href={s ? `/admin/bookings?status=${s}` : "/admin/bookings"}
          >
            {s || "Todas"}
          </Link>
        ))}
      </div>
      <Panel>
        {result.rows.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="pb-3">Código</th>
                    <th className="pb-3">Huésped</th>
                    <th className="pb-3">Fechas</th>
                    <th className="pb-3">Estado</th>
                    <th className="pb-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((b) => (
                    <tr key={b.id} className="border-b">
                      <td className="py-3">
                        <Link
                          className="font-semibold text-cyan-700"
                          href={`/admin/bookings/${b.id}`}
                        >
                          {b.booking_code}
                        </Link>
                      </td>
                      <td>{b.guest_name}</td>
                      <td>
                        {b.check_in} → {b.check_out}
                      </td>
                      <td>
                        <StatusBadge value={b.status} />
                      </td>
                      <td>
                        <Money amount={b.total_minor} currency={b.currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              {...result}
              basePath={p.status ? `/admin/bookings?status=${p.status}` : "/admin/bookings"}
            />
          </>
        ) : (
          <EmptyState title="Sin reservas" body="No hay reservas para este filtro." />
        )}
      </Panel>
    </>
  );
}
