import QRCode from "qrcode";
import { requireStaff } from "@/lib/auth";
import { assertAdminAction } from "@/lib/permissions";
import { listAccessEntries, SOURCE_LABELS, type AccessEntry } from "@/lib/access";
import {
  approveAccessAction,
  revokeAccessAction,
  setAccessCompanionsAction,
} from "@/lib/admin/access-actions";
import { getAccessQrToken } from "@/lib/admin/access";
import { todayInLaPaz } from "@/lib/admin/planner-query";
import { AdminPageHeader, EmptyState, Panel, StatusBadge } from "@/components/admin/ui";
import {
  AccessCompanionsForm,
  ApproveAccessForm,
  RevokeAccessForm,
} from "@/components/access/approval-forms";

export const dynamic = "force-dynamic";

type SearchParams = { estado?: string; fecha?: string; q?: string };

const field = "mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal";

const STATUS_OPTIONS = [
  ["", "Todos"],
  ["pendientes", "Sin aprobar"],
  ["aprobados", "Aprobados"],
] as const;

function shortDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

// QR opcional: es un atajo para que el guardia no tenga que tipear nombre o carnet, no
// reemplaza la búsqueda. Se genera server-side a partir del token de la aprobación; sin
// aprobación no hay token, así que no hay nada que mostrar.
async function AccessQrCode({ entry }: { entry: AccessEntry }) {
  const token = await getAccessQrToken({
    bookingId: entry.isBooking ? entry.entryId : null,
    stayId: entry.isBooking ? null : entry.entryId,
  });
  if (!token) return null;
  const dataUrl = await QRCode.toDataURL(token, { margin: 1, width: 200 });
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm text-slate-600">
        Mostrar QR (extra, no hace falta para dejarlo pasar)
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt={`Código QR de ${entry.titular}`}
          width={160}
          height={160}
          className="rounded border border-slate-200 bg-white p-2"
        />
        <div className="max-w-xs text-xs text-slate-500">
          <p>
            Se lo mostrás al huésped (pantalla o impreso) para que lo tenga a mano en portería.
            Sirve para todo el grupo durante toda la estadía; si le quitás la aprobación y volvés
            a aprobar, este código deja de funcionar y se genera uno nuevo.
          </p>
          <p className="mt-2">
            Código, por si el guardia lo tiene que pegar a mano:
            <br />
            <code className="break-all font-semibold text-slate-700">{token}</code>
          </p>
        </div>
      </div>
    </details>
  );
}

async function EntryPanel({ entry }: { entry: AccessEntry }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{entry.titular}</h2>
          <p className="text-sm text-slate-600">
            {SOURCE_LABELS[entry.source] ?? entry.source} · {entry.lugar}
          </p>
          <p className="text-sm text-slate-600">
            {shortDate(entry.checkIn)} al {shortDate(entry.checkOut)} · {entry.guestCount}{" "}
            {entry.guestCount === 1 ? "persona" : "personas"}
            {entry.documentId ? ` · CI ${entry.documentId}` : ""}
          </p>
        </div>
        <StatusBadge value={entry.approved ? "aprobado" : "sin aprobar"} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Personas del grupo
          </p>
          <ul className="mt-1.5 grid gap-1 text-sm">
            <li className="font-medium">{entry.titular} (titular)</li>
            {entry.people.map((person, index) => (
              <li key={`${entry.entryId}-${index}`}>
                {person.nombre}
                {person.carnet ? ` · CI ${person.carnet}` : ""}
              </li>
            ))}
          </ul>
          {entry.source === "alquiler" ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-slate-600">
                Cargar acompañantes
              </summary>
              <div className="mt-2">
                <AccessCompanionsForm action={setAccessCompanionsAction} entry={entry} />
              </div>
            </details>
          ) : null}
        </div>

        <div>
          {entry.approved ? (
            <>
              <p className="mb-2 text-sm text-emerald-700">
                Aprobado{entry.approvedAt ? ` el ${shortDate(entry.approvedAt.slice(0, 10))}` : ""}.
                El guardia lo ve en verde.
              </p>
              <RevokeAccessForm action={revokeAccessAction} entry={entry} />
              <AccessQrCode entry={entry} />
            </>
          ) : (
            <ApproveAccessForm action={approveAccessAction} entry={entry} />
          )}
        </div>
      </div>
    </Panel>
  );
}

// Control de acceso: acá RentaMar aprueba a quien ya pasó por la oficina. Mientras no esté
// aprobado, el guardia lo ve en rojo y no lo deja entrar.
export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "access.review");

  const p = await searchParams;
  const search = (p.q ?? "").trim();
  // Sin fecha explícita se muestra el día de hoy; con búsqueda se ignora la fecha.
  const date = search ? null : p.fecha || todayInLaPaz();
  const entries = await listAccessEntries({ date, search: search || null });
  const visible =
    p.estado === "pendientes"
      ? entries.filter((entry) => !entry.approved)
      : p.estado === "aprobados"
        ? entries.filter((entry) => entry.approved)
        : entries;

  return (
    <>
      <AdminPageHeader
        title="Control de acceso"
        helpKey="accesos.page"
        description="Alquileres, afiliados y copropietarios en un solo listado. Aprobá a quien ya firmó, dejó la garantía y retiró sus manillas: recién ahí el guardia lo ve en verde."
      />

      <Panel>
        <form method="get" className="admin-filter-form flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Estado
            <select name="estado" defaultValue={p.estado ?? ""} className={field}>
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Día
            <input
              type="date"
              name="fecha"
              defaultValue={p.fecha ?? todayInLaPaz()}
              className={field}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Buscar
            <input name="q" defaultValue={search} placeholder="Nombre o carnet" className={field} />
          </label>
          <button className="rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream">
            Filtrar
          </button>
        </form>
        {search ? (
          <p className="mt-3 text-sm text-slate-600">
            La búsqueda ignora el día: busca en todos los registros.
          </p>
        ) : null}
      </Panel>

      {visible.length === 0 ? (
        <EmptyState
          title="No hay nada que mostrar"
          body="Probá con otro día o buscá por nombre o carnet."
        />
      ) : (
        <div className="mt-5 grid gap-5">
          {visible.map((entry) => (
            <EntryPanel key={`${entry.source}-${entry.entryId}`} entry={entry} />
          ))}
        </div>
      )}
    </>
  );
}
