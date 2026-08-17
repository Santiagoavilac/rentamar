import Link from "next/link";
import {
  AdminPageHeader,
  EmptyState,
  Money,
  Pager,
  Panel,
  StatusBadge,
} from "@/components/admin/ui";
import { listAffiliateEnabledProperties, listAffiliateRequests } from "@/lib/admin/affiliates";
import { assertAdminAction, requireStaff } from "@/lib/auth";

type SearchParams = { page?: string; status?: string; propertyId?: string };

const STATUS_OPTIONS = [
  ["", "Todos los estados"],
  ["pending_payment", "Pendiente"],
  ["confirmed", "Confirmada"],
  ["cancelled", "Cancelada"],
  ["expired", "Expirada"],
] as const;

export default async function AffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "affiliate.review");
  const p = await searchParams;
  const [result, properties] = await Promise.all([
    listAffiliateRequests({
      page: Math.max(1, Number(p.page) || 1),
      pageSize: 20,
      status: p.status || undefined,
      propertyId: p.propertyId || undefined,
    }),
    listAffiliateEnabledProperties(),
  ]);
  const propertyNames = new Map(properties.map((item) => [item.id, item.name]));
  const basePath = `/admin/affiliates?status=${encodeURIComponent(p.status ?? "")}&propertyId=${encodeURIComponent(p.propertyId ?? "")}`;

  return (
    <>
      <AdminPageHeader
        title="Solicitudes de afiliados"
        helpKey="affiliates.page"
        description="Reservas creadas desde /afiliados. Bloquean las fechas hasta que se confirmen o se cancelen."
      />
      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Estado
            <select
              name="status"
              defaultValue={p.status ?? ""}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
            >
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Propiedad
            <select
              name="propertyId"
              defaultValue={p.propertyId ?? ""}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
            >
              <option value="">Todas</option>
              {properties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
            Filtrar
          </button>
        </form>
      </Panel>
      <Panel className="mt-5">
        {result.rows.length ? (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="pb-3">Código</th>
                  <th>Afiliado</th>
                  <th>Propiedad</th>
                  <th>Estadía</th>
                  <th>Estado</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-3">
                      <Link
                        className="font-semibold text-cyan-700"
                        href={`/admin/affiliates/${row.id}`}
                      >
                        {row.booking_code}
                      </Link>
                    </td>
                    <td>
                      {row.guest_name}
                      <span className="block text-xs text-slate-500">
                        CI {row.affiliate_document_id || "—"} · {row.guest_phone || "—"}
                      </span>
                    </td>
                    <td>{propertyNames.get(row.property_id) || row.property_id.slice(0, 8)}</td>
                    <td>
                      {row.check_in} → {row.check_out}
                      <span className="block text-xs text-slate-500">
                        {row.nights} noches · {row.guests} personas
                      </span>
                    </td>
                    <td>
                      <StatusBadge value={row.status} />
                    </td>
                    <td>
                      <Money amount={row.total_minor} currency={row.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager {...result} basePath={basePath} />
          </>
        ) : (
          <EmptyState
            title="Sin solicitudes"
            body="Cuando un afiliado envíe una reserva desde /afiliados aparecerá acá."
          />
        )}
      </Panel>
    </>
  );
}
