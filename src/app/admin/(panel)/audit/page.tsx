import Link from "next/link";
import { getStaffSession } from "@/lib/auth";
import { listAuditFeed } from "@/lib/admin/audit";
import {
  describeAction,
  describeEntityType,
  diffChangedFields,
  entityHref,
  ROLE_LABELS,
} from "@/lib/admin/audit-labels";
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
  const result = await listAuditFeed({ page: Math.max(1, Number(p.page) || 1), pageSize: 20 });

  return (
    <>
      <AdminPageHeader
        title="Actividad del panel"
        description="Quién hizo cada cambio y qué modificó. El registro no se puede editar ni borrar."
      />
      <Panel>
        {result.rows.length ? (
          <>
            <ul className="grid gap-4">
              {result.rows.map((x) => {
                const href = entityHref(x.entity_type, x.entity_id);
                const title =
                  x.entityTitle ?? `${describeEntityType(x.entity_type)} (ya no existe)`;
                const changes = diffChangedFields(x.before_data, x.after_data);
                const role = x.actor_role ? ROLE_LABELS[x.actor_role] : null;
                return (
                  <li key={x.id} className="border-b pb-4 text-sm last:border-b-0">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>{describeAction(x.action)}</strong>
                      <time className="text-slate-500">
                        {new Date(x.created_at).toLocaleString("es-BO")}
                      </time>
                    </div>
                    <p className="text-slate-500">
                      {x.actorName ?? "Sistema"}
                      {role ? ` (${role})` : ""}
                    </p>
                    <p className="text-slate-700">
                      {href ? (
                        <Link href={href} className="font-semibold text-cyan-700">
                          {title}
                        </Link>
                      ) : (
                        title
                      )}
                    </p>
                    {changes.length ? (
                      <ul className="mt-1 grid gap-0.5 text-slate-600">
                        {changes.map((change) => (
                          <li key={change.label}>
                            {change.label}: {change.from} → {change.to}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {x.reason ? <p className="mt-1 text-slate-600">Motivo: {x.reason}</p> : null}
                  </li>
                );
              })}
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
