import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { assertAdminAction } from "@/lib/permissions";
import { listOfficeCheckins } from "@/lib/admin/access";
import { boliviaDayRange, formatCheckinMoment, todayInBolivia } from "@/lib/admin/checkins-export";
import { AdminPageHeader, AdminResponsiveTable, EmptyState, Panel } from "@/components/admin/ui";
import { PanelHeading } from "@/components/admin/help";
import { SOURCE_LABELS } from "@/lib/access";
import { AutoRefresh } from "@/components/admin/auto-refresh";

export const dynamic = "force-dynamic";

type SearchParams = { from?: string; to?: string };

const field = "mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal";

// Quién acaba de entrar al complejo. Administración lo pidió para no tener que buscar
// registro por registro cuando alguien pasa por el mostrador.
export default async function OfficeCheckinsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "access.review");

  const p = await searchParams;
  const today = todayInBolivia();
  const from = p.from || today;
  const to = p.to || from;
  const rows = await listOfficeCheckins(boliviaDayRange(from, to));

  const exportHref = `/admin/ingresos/export?from=${encodeURIComponent(
    from,
  )}&to=${encodeURIComponent(to)}`;

  return (
    <>
      <AdminPageHeader
        title="Ingresos"
        description="Registros hechos en oficina, del más reciente al más antiguo."
        action={
          <a
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            href={exportHref}
          >
            Descargar CSV
          </a>
        }
      />

      {/* Solo mientras se mira el día de hoy: un rango pasado no cambia solo. */}
      {from === today && to === today ? <AutoRefresh seconds={30} /> : null}

      <Panel>
        <form className="grid gap-3 sm:grid-cols-[auto_auto_auto] sm:items-end">
          <label className="text-sm font-semibold">
            Desde
            <input type="date" name="from" defaultValue={from} className={field} />
          </label>
          <label className="text-sm font-semibold">
            Hasta
            <input type="date" name="to" defaultValue={to} className={field} />
          </label>
          <button className="rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream">
            Ver
          </button>
        </form>
      </Panel>

      <Panel>
        <PanelHeading helpKey="ingresos.page">Registros del período</PanelHeading>
        {rows.length ? (
          <div className="mt-3">
            <AdminResponsiveTable className="md:min-w-[720px]">
              <thead className="border-b text-slate-500">
                <tr className="text-left text-xs uppercase tracking-wide">
                  <th className="pb-3">Fecha y hora de registro</th>
                  <th>Huésped titular</th>
                  <th>Teléfono</th>
                  <th>Fecha de salida</th>
                  <th>Lugar</th>
                  <th>Personas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.entryId} className="border-b align-top">
                    <td data-label="Fecha y hora de registro" className="py-3 whitespace-nowrap">
                      {formatCheckinMoment(row.checkedInAt)}
                    </td>
                    <td data-label="Huésped titular">
                      <Link
                        className="font-semibold text-cyan-700"
                        href={
                          row.source === "copropietario"
                            ? `/admin/copropietarios/registros/${row.entryId}`
                            : `/admin/bookings/${row.entryId}`
                        }
                      >
                        {row.titular}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {SOURCE_LABELS[row.source] ?? row.source}
                      </span>
                    </td>
                    <td data-label="Teléfono">{row.phone || "—"}</td>
                    <td data-label="Fecha de salida" className="whitespace-nowrap">
                      {row.checkOut}
                    </td>
                    <td data-label="Lugar">{row.lugar}</td>
                    <td data-label="Personas">
                      {row.peopleCheckedIn} de {row.guestCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminResponsiveTable>
          </div>
        ) : (
          <EmptyState
            title="Todavía no entró nadie"
            body="Acá aparece cada grupo en cuanto recepción registra su ingreso desde la ficha del registro."
          />
        )}
      </Panel>
    </>
  );
}
