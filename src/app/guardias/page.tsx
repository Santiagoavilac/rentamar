import type { Metadata } from "next";
import { requireGuard } from "@/lib/auth";
import { listAccessEntries, SOURCE_LABELS, type AccessEntry } from "@/lib/access";
import { todayInLaPaz } from "@/lib/admin/planner-query";
import { signOutGuardAction } from "./login/actions";

export const metadata: Metadata = {
  title: "Portería | RentaMar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Fechas en formato corto (dd/mm) a partir del `YYYY-MM-DD` que devuelve la RPC. Se parte el
// texto en vez de usar Date para que no haya corrimiento de zona horaria.
function shortDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

// El color nunca es el único indicador: siempre va acompañado del texto, para que se entienda
// de noche, con poca luz o en una pantalla gastada.
function EntryCard({ entry }: { entry: AccessEntry }) {
  const tone = entry.approved ? "border-emerald-500 bg-emerald-50" : "border-rose-500 bg-rose-50";
  const badge = entry.approved ? "bg-emerald-600 text-white" : "bg-rose-600 text-white";

  return (
    <article className={`rounded-2xl border-4 p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">{entry.titular}</h2>
          <p className="text-sm text-slate-700">
            {SOURCE_LABELS[entry.source] ?? entry.source} · {entry.lugar}
          </p>
          <p className="text-sm text-slate-600">
            {shortDate(entry.checkIn)} al {shortDate(entry.checkOut)} · {entry.guestCount}{" "}
            {entry.guestCount === 1 ? "persona" : "personas"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm font-bold uppercase ${badge}`}>
          {entry.approved ? "Aprobado" : "No aprobado"}
        </span>
      </div>

      {entry.approved ? null : (
        <p className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
          No puede ingresar. Tiene que pasar primero por RentaMar a firmar, dejar la garantía y
          retirar sus manillas.
        </p>
      )}

      <div className="mt-3 border-t border-black/10 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Personas autorizadas
        </p>
        <ul className="mt-1.5 grid gap-1 text-sm">
          <li className="font-medium">
            {entry.titular}
            {entry.documentId ? ` · CI ${entry.documentId}` : ""}
          </li>
          {entry.people.map((person, index) => (
            <li key={`${entry.entryId}-${index}`}>
              {person.nombre}
              {person.carnet ? ` · CI ${person.carnet}` : ""}
            </li>
          ))}
        </ul>
        {entry.people.length + 1 < entry.guestCount ? (
          <p className="mt-2 text-xs text-slate-600">
            La reserva declara {entry.guestCount} personas y hay {entry.people.length + 1} con
            nombre. Consultá con RentaMar antes de dejar pasar al resto.
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default async function GuardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireGuard();
  const p = await searchParams;
  const search = (p.q ?? "").trim();
  const today = todayInLaPaz();

  // Con búsqueda se ignora la fecha: el guardia escribe un nombre y espera encontrarlo
  // aunque la estadía empiece mañana.
  const entries = await listAccessEntries({
    date: search ? null : today,
    search: search || null,
  });

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-4 py-8 text-night">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-turquoise">RentaMar</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Portería</h1>
            <p className="mt-1 text-sm text-slate-600">Sesión de {session.fullName}.</p>
          </div>
          <form action={signOutGuardAction}>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              Salir
            </button>
          </form>
        </header>

        <form method="get" className="mb-5 flex gap-2">
          <input
            name="q"
            defaultValue={search}
            placeholder="Buscar por nombre o carnet"
            aria-label="Buscar por nombre o carnet"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5"
          />
          <button className="rounded-xl bg-deep px-4 py-2.5 font-semibold text-cream">
            Buscar
          </button>
        </form>

        <p className="mb-3 text-sm text-slate-600">
          {search
            ? `Resultados para “${search}”.`
            : "Personas que están hoy en el condominio. Buscá por nombre o carnet si no aparece."}
        </p>

        {entries.length === 0 ? (
          <p className="rounded-2xl border border-slate-300 bg-white p-6 text-center text-slate-600">
            {search ? "No se encontró a nadie con ese dato." : "Hoy no hay ingresos registrados."}
          </p>
        ) : (
          <div className="grid gap-4">
            {entries.map((entry) => (
              <EntryCard key={`${entry.source}-${entry.entryId}`} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
