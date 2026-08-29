import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { assertAdminAction } from "@/lib/permissions";
import { listAffiliateEnabledProperties, listAffiliateRequests } from "@/lib/admin/affiliates";
import { listDeclarationsByBooking } from "@/lib/admin/declarations";
import {
  AdminPageHeader,
  AdminResponsiveTable,
  EmptyState,
  Money,
  Pager,
  Panel,
  StatusBadge,
  formatDateTime,
} from "@/components/admin/ui";
import { DeclarationCell } from "@/components/admin/declaration-cell";

export const dynamic = "force-dynamic";

type SearchParams = { page?: string; status?: string; propertyId?: string };

const field = "mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal";

const STATUS_OPTIONS = [
  ["", "Todos los estados"],
  ["pending_payment", "Pendiente"],
  ["confirmed", "Confirmada"],
  ["cancelled", "Cancelada"],
  ["expired", "Expirada"],
] as const;

// Registros de afiliados: mismo listado que /admin/affiliates pero orientado a la
// declaración jurada. La gestión de la solicitud sigue estando en el detalle.
export default async function AffiliateRecordsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "declaration.read");

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
  const declarations = await listDeclarationsByBooking(result.rows.map((row) => row.id));
  const propertyNames = new Map(properties.map((item) => [item.id, item.name]));

  const basePath = `/admin/registros/afiliados?status=${encodeURIComponent(
    p.status ?? "",
  )}&propertyId=${encodeURIComponent(p.propertyId ?? "")}`;

  return (
    <>
      <AdminPageHeader
        title="Registros de afiliados"
        helpKey="registros.affiliates.page"
        description="Reservas del canal de afiliados. Desde acá se ve y se descarga la declaración jurada de cada una."
      />

      <Panel>
        <form method="get" className="admin-filter-form flex flex-wrap items-end gap-3">
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
            Propiedad
            <select name="propertyId" defaultValue={p.propertyId ?? ""} className={field}>
              <option value="">Todas</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
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
            <AdminResponsiveTable className="md:min-w-[940px]">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="pb-3">Reserva</th>
                  <th>Afiliado</th>
                  <th>Propiedad</th>
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
                    <td data-label="Reserva" className="py-3">
                      <Link
                        className="font-semibold text-cyan-700"
                        href={`/admin/affiliates/${row.id}`}
                      >
                        {row.booking_code}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {formatDateTime(row.created_at)}
                      </span>
                    </td>
                    <td data-label="Afiliado">
                      {row.guest_name}
                      <span className="block text-xs text-slate-500">
                        CI {row.affiliate_document_id ?? "—"}
                      </span>
                    </td>
                    <td data-label="Propiedad">{propertyNames.get(row.property_id) ?? "—"}</td>
                    <td data-label="Entrada">{row.check_in}</td>
                    <td data-label="Salida">{row.check_out}</td>
                    <td data-label="Estado">
                      <StatusBadge value={row.status} />
                    </td>
                    <td data-label="Total">
                      <Money amount={row.total_minor} currency={row.currency} />
                    </td>
                    <td data-label="Declaración" data-mobile-full="true">
                      <DeclarationCell
                        declaration={declarations.get(row.id)}
                        target={{ kind: "booking", bookingId: row.id }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminResponsiveTable>
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
            body="Las solicitudes de afiliados aparecerán acá con su declaración jurada."
          />
        )}
      </Panel>
    </>
  );
}
