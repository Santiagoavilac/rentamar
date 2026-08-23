import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { assertAdminAction } from "@/lib/permissions";
import { listBookings } from "@/lib/admin/bookings";
import { listDeclarationsByBooking } from "@/lib/admin/declarations";
import {
  AdminPageHeader,
  EmptyState,
  Money,
  Pager,
  Panel,
  StatusBadge,
  formatDateTime,
} from "@/components/admin/ui";
import { DeclarationCell } from "@/components/admin/declaration-cell";

export const dynamic = "force-dynamic";

type SearchParams = { page?: string; status?: string; search?: string };

const field = "mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal";

const STATUS_OPTIONS = [
  ["", "Todos los estados"],
  ["pending_payment", "Pendiente de pago"],
  ["confirmed", "Confirmada"],
  ["manual_review", "En revisión"],
  ["cancelled", "Cancelada"],
  ["expired", "Expirada"],
] as const;

// Registros de huéspedes: el mismo listado de reservas del canal directo, con la
// declaración jurada a mano. Las de afiliados tienen su propia sección.
export default async function GuestRecordsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "declaration.read");

  const p = await searchParams;
  const result = await listBookings({
    page: Math.max(1, Number(p.page) || 1),
    pageSize: 20,
    status: p.status || undefined,
    search: p.search || undefined,
    excludeAffiliates: true,
  });
  const declarations = await listDeclarationsByBooking(result.rows.map((row) => row.id));

  const basePath = `/admin/registros/huespedes?status=${encodeURIComponent(
    p.status ?? "",
  )}&search=${encodeURIComponent(p.search ?? "")}`;

  return (
    <>
      <AdminPageHeader
        title="Registros de huéspedes"
        helpKey="registros.guests.page"
        description="Reservas del canal directo. Desde acá se ve y se descarga la declaración jurada de cada una."
      />

      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Estado
            <select name="status" defaultValue={p.status ?? ""} className={field}>
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Código de reserva
            <input name="search" defaultValue={p.search ?? ""} className={field} />
          </label>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
            Filtrar
          </button>
        </form>
      </Panel>

      <Panel className="mt-5">
        {result.rows.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="pb-3">Reserva</th>
                    <th>Huésped</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Estado</th>
                    <th>Total</th>
                    <th>Declaración</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <td className="py-3">
                        <Link
                          className="font-semibold text-cyan-700"
                          href={`/admin/bookings/${row.id}`}
                        >
                          {row.booking_code}
                        </Link>
                        <span className="block text-xs text-slate-500">
                          {formatDateTime(row.created_at)}
                        </span>
                      </td>
                      <td>{row.guest_name}</td>
                      <td>{row.check_in}</td>
                      <td>{row.check_out}</td>
                      <td>
                        <StatusBadge value={row.status} />
                      </td>
                      <td>
                        <Money amount={row.total_minor} currency={row.currency} />
                      </td>
                      <td>
                        <DeclarationCell
                          declaration={declarations.get(row.id)}
                          target={{ kind: "booking", bookingId: row.id }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              basePath={basePath}
            />
          </>
        ) : (
          <EmptyState
            title="Sin registros"
            body="Las reservas del canal directo aparecerán acá con su declaración jurada."
          />
        )}
      </Panel>
    </>
  );
}
