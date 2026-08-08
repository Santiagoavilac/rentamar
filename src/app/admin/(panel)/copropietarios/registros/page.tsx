import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { assertAdminAction } from "@/lib/permissions";
import {
  listCoOwnerAccounts,
  listCoOwnerPropertyNames,
  listCoOwnerStays,
} from "@/lib/admin/co-owners";
import { AdminPageHeader, EmptyState, Pager, Panel, formatDateTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type SearchParams = {
  page?: string;
  propertyName?: string;
  accountId?: string;
  from?: string;
  to?: string;
};

const field = "mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal";

export default async function CoOwnerStaysPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "coowner.manage");

  const p = await searchParams;
  const [result, propertyNames, accounts] = await Promise.all([
    listCoOwnerStays({
      page: Math.max(1, Number(p.page) || 1),
      pageSize: 20,
      propertyName: p.propertyName || undefined,
      accountId: p.accountId || undefined,
      from: p.from || undefined,
      to: p.to || undefined,
    }),
    listCoOwnerPropertyNames(),
    listCoOwnerAccounts(),
  ]);

  const basePath = `/admin/copropietarios/registros?propertyName=${encodeURIComponent(
    p.propertyName ?? "",
  )}&accountId=${encodeURIComponent(p.accountId ?? "")}&from=${encodeURIComponent(
    p.from ?? "",
  )}&to=${encodeURIComponent(p.to ?? "")}`;

  return (
    <>
      <AdminPageHeader
        title="Estadías declaradas"
        description="Lo que cada copropietario registró, del más reciente al más antiguo. Los datos quedan congelados: renombrar una propiedad no altera los registros viejos."
      />

      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Registrado desde
            <input type="date" name="from" defaultValue={p.from ?? ""} className={field} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Hasta
            <input type="date" name="to" defaultValue={p.to ?? ""} className={field} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Propiedad
            <select name="propertyName" defaultValue={p.propertyName ?? ""} className={field}>
              <option value="">Todas</option>
              {propertyNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Usuario
            <select name="accountId" defaultValue={p.accountId ?? ""} className={field}>
              <option value="">Todos</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.username}
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="pb-3">Registrado</th>
                    <th>Usuario</th>
                    <th>Huésped</th>
                    <th>Propiedad</th>
                    <th>Habitaciones</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Personas</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <td className="py-3">
                        <Link
                          className="font-semibold text-cyan-700"
                          href={`/admin/copropietarios/registros/${row.id}`}
                        >
                          {formatDateTime(row.created_at)}
                        </Link>
                      </td>
                      <td>{row.username}</td>
                      <td>
                        {row.full_name}
                        <span className="block text-xs text-slate-500">
                          CI {row.document_id} · {row.phone}
                        </span>
                      </td>
                      <td>{row.property_name}</td>
                      <td>{row.room_count}</td>
                      <td>{formatDateTime(row.check_in_at)}</td>
                      <td>{formatDateTime(row.check_out_at)}</td>
                      <td>
                        {row.adults} adultos
                        <span className="block text-xs text-slate-500">
                          {row.minors} menores de 2 años
                        </span>
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
            body="Cuando un copropietario complete el formulario en /copropietarios aparecerá acá."
          />
        )}
      </Panel>
    </>
  );
}
