import { requireStaff } from "@/lib/auth";
import { assertAdminAction } from "@/lib/permissions";
import { listCleaningReports, listDayTurnover, type TurnoverRow } from "@/lib/admin/cleaning";
import { todayInLaPaz } from "@/lib/admin/planner-query";
import { AdminPageHeader, EmptyState, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const field = "mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal";

function TurnoverList({ title, rows, empty }: { title: string; rows: TurnoverRow[]; empty: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">{empty}</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {rows.map((row) => (
            <li key={row.bookingCode} className="flex justify-between gap-3 text-sm">
              <span className="font-medium">{row.propertyName}</span>
              <span className="text-slate-500">
                {row.time} · {row.bookingCode}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function CleaningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "cleaning.manage");

  const p = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.date ?? "") ? p.date! : todayInLaPaz();
  const [reports, turnover] = await Promise.all([listCleaningReports(date), listDayTurnover(date)]);

  return (
    <>
      <AdminPageHeader
        title="Limpieza"
        description="Lo que el personal reportó ese día, junto con los departamentos que se desocupan y se ocupan."
      />

      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Día
            <input type="date" name="date" defaultValue={date} className={field} />
          </label>
          <button className="rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream">
            Ver
          </button>
        </form>
      </Panel>

      <div className="mt-5 grid gap-5">
        <Panel>
          <h2 className="mb-4 text-lg font-semibold">Entradas y salidas del día</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <TurnoverList
              title="Se desocupan (check-out)"
              rows={turnover.checkOuts}
              empty="Ningún departamento se desocupa este día."
            />
            <TurnoverList
              title="Se ocupan (check-in)"
              rows={turnover.checkIns}
              empty="Ningún departamento se ocupa este día."
            />
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-lg font-semibold">Limpiezas reportadas</h2>
          {reports.length === 0 ? (
            <EmptyState
              title="Sin reportes este día"
              body="El personal de limpieza carga su entrada y salida desde /limpieza."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Persona</th>
                    <th className="py-2">Departamento</th>
                    <th className="py-2">Entrada</th>
                    <th className="py-2">Salida</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-t border-slate-200">
                      <td className="py-3">
                        <strong className="block font-medium">{report.fullName}</strong>
                        <small className="text-slate-500">{report.username}</small>
                      </td>
                      <td className="py-3">{report.propertyName}</td>
                      <td className="py-3">{report.entryTime}</td>
                      <td className="py-3">{report.exitTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
