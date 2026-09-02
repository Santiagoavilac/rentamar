import type { Metadata } from "next";
import Link from "next/link";
import { requireCoOwner } from "@/lib/auth";
import { listCoOwnerStays } from "@/lib/admin/co-owners";
import { formatDateTime } from "@/components/admin/ui";
import CoOwnerShell from "@/components/co-owner/page-shell";

export const metadata: Metadata = {
  title: "Mis estadías | RentaMar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Las estadías que declaró esta cuenta. El accountId es explícito aunque la política
// `co_owner_stays_read` ya limite a `account_id = auth.uid()`: así se lee de una.
export default async function CoOwnerStaysPage() {
  const session = await requireCoOwner();
  const { rows } = await listCoOwnerStays({
    page: 1,
    pageSize: 50,
    accountId: session.userId,
  });

  return (
    <CoOwnerShell
      title="Mis estadías declaradas"
      subtitle={rows.length ? `${rows.length} registradas, de la más reciente.` : undefined}
      back
    >
      {rows.length ? (
        <div className="grid gap-3">
          {rows.map((row) => (
            <article key={row.id} className="surface rounded-2xl p-5">
              <p className="text-xs text-slate-500">
                Registrada el {formatDateTime(row.created_at)}
              </p>
              <p className="mt-1 text-base font-semibold">{row.full_name}</p>
              <p className="text-sm text-slate-600">
                CI {row.document_id} · {row.phone}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Entrada</dt>
                  <dd>{formatDateTime(row.check_in_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Salida</dt>
                  <dd>{formatDateTime(row.check_out_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Personas</dt>
                  <dd>
                    {row.adults} {row.adults === 1 ? "adulto" : "adultos"}
                    {row.minors ? ` · ${row.minors} menores de 2 años` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Habitaciones</dt>
                  <dd>{row.room_count}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="surface rounded-2xl p-5 text-sm text-slate-600">
          Todavía no declaraste ninguna estadía.{" "}
          <Link className="font-semibold text-cyan-700" href="/copropietarios/registro">
            Registrar la primera
          </Link>
          .
        </p>
      )}
    </CoOwnerShell>
  );
}
