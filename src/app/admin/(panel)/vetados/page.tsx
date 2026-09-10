import { requireStaff } from "@/lib/auth";
import { assertAdminAction } from "@/lib/permissions";
import { listBannedGuests, listBannedAttempts } from "@/lib/banned-guests";
import {
  AdminPageHeader,
  AdminResponsiveTable,
  EmptyState,
  Panel,
  formatDateTime,
} from "@/components/admin/ui";
import { PanelHeading } from "@/components/admin/help";
import { BannedGuestForm, RevokeBannedGuestForm } from "@/components/admin/banned-forms";
import { addBannedGuestAction, revokeBannedGuestAction } from "@/lib/admin/banned-actions";
import { SOURCE_LABELS } from "@/lib/access";

export const dynamic = "force-dynamic";

type SearchParams = { search?: string };

const field = "mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal";

// Huéspedes que no pueden ingresar al complejo. El bloqueo lo aplica la base sobre los tres
// canales; acá se administra la lista y se ven los intentos que frenó.
export default async function BannedGuestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "banned.manage");

  const p = await searchParams;
  const [rows, attempts] = await Promise.all([
    listBannedGuests({ search: p.search }),
    listBannedAttempts(20),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Huéspedes vetados"
        description="Nadie de esta lista puede ser registrado, ni por RentaMar ni por un afiliado ni por un copropietario."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_.6fr]">
        <div className="grid gap-5">
          <Panel>
            <PanelHeading helpKey="vetados.page">Agregar a la lista</PanelHeading>
            <BannedGuestForm action={addBannedGuestAction} />
          </Panel>

          <Panel>
            <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="text-sm font-semibold">
                Buscar
                <input
                  name="search"
                  defaultValue={p.search ?? ""}
                  placeholder="Nombre o documento"
                  className={field}
                />
              </label>
              <button className="rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream">
                Buscar
              </button>
            </form>

            {rows.length ? (
              <div className="mt-4">
                <AdminResponsiveTable className="md:min-w-[560px]">
                  <thead className="border-b text-slate-500">
                    <tr className="text-left text-xs uppercase tracking-wide">
                      <th className="pb-3">Nombre completo</th>
                      <th>Documento</th>
                      <th>Motivo</th>
                      <th>Desde</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b align-top">
                        <td data-label="Nombre completo" className="py-3 font-semibold">
                          {row.full_name}
                        </td>
                        <td data-label="Documento">{row.document_id}</td>
                        <td data-label="Motivo">{row.reason || "—"}</td>
                        <td data-label="Desde" className="whitespace-nowrap">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td data-mobile-full="true">
                          <RevokeBannedGuestForm action={revokeBannedGuestAction} id={row.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminResponsiveTable>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="La lista está vacía"
                  body="Mientras no haya nadie acá, todos los registros siguen su curso normal."
                />
              </div>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelHeading helpKey="vetados.intentos">Intentos bloqueados</PanelHeading>
          {attempts.length ? (
            <ul className="mt-3 grid gap-3 text-sm">
              {attempts.map((attempt) => (
                <li key={attempt.id} className="rounded border border-slate-200 p-3">
                  <strong>{SOURCE_LABELS[attempt.channel] ?? attempt.channel}</strong>
                  <span className="block text-xs text-slate-500">
                    {formatDateTime(attempt.created_at)}
                  </span>
                  <ul className="mt-2 grid gap-1 text-xs text-slate-600">
                    {attempt.submitted.map((person, index) => (
                      <li key={index}>
                        {person.nombre}
                        {person.carnet ? ` · ${person.carnet}` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Todavía no hubo ningún intento de registrar a alguien de la lista.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
