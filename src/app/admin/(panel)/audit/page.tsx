import { getStaffSession } from "@/lib/auth";
import { listAuditLogs } from "@/lib/admin/audit";
import { AdminPageHeader, EmptyState, Pager, Panel } from "@/components/admin/ui";
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getStaffSession();
  if (session?.role !== "admin")
    return (
      <>
        <AdminPageHeader title="Acceso restringido" />
        <EmptyState
          title="403 · Solo administradores"
          body="La bitácora central está disponible únicamente para administradores."
        />
      </>
    );
  const p = await searchParams;
  const result = await listAuditLogs({ page: Math.max(1, Number(p.page) || 1), pageSize: 20 });
  return (
    <>
      <AdminPageHeader
        title="Auditoría"
        description="Registro append-only, con datos sensibles sanitizados."
      />
      <Panel>
        {result.rows.length ? (
          <>
            <ul className="grid gap-3">
              {result.rows.map((x) => (
                <li key={x.id} className="border-b pb-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <strong>{x.action}</strong>
                    <time className="text-slate-500">
                      {new Date(x.created_at).toLocaleString("es-BO")}
                    </time>
                  </div>
                  <p className="text-slate-600">
                    {x.entity_type} · {x.entity_id || "sin entidad"} · {x.reason || "sin motivo"}
                  </p>
                </li>
              ))}
            </ul>
            <Pager {...result} basePath="/admin/audit" />
          </>
        ) : (
          <EmptyState title="Sin eventos" body="Las acciones administrativas aparecerán aquí." />
        )}
      </Panel>
    </>
  );
}
