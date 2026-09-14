import type { Metadata } from "next";
import Link from "next/link";
import { requireGuard } from "@/lib/auth";
import { listAccessEntries, getAccessEntryByToken, SOURCE_LABELS, type AccessEntry } from "@/lib/access";
import { listIdDocuments } from "@/lib/id-documents";
import { todayInLaPaz } from "@/lib/admin/planner-query";
import { QrScanButton } from "@/components/access/qr-scan-button";
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
// Quién del grupo ya pasó por el mostrador. El guardia lo necesita para no dejar entrar a
// alguien que todavía no retiró su manilla, aunque el grupo esté aprobado.
function WristbandMark({ checkedIn, manilla }: { checkedIn: boolean; manilla?: boolean }) {
  if (!checkedIn) {
    return <span className="ml-1 text-xs font-semibold text-rose-700">· sin registrar</span>;
  }
  return (
    <span className="ml-1 text-xs font-semibold text-emerald-700">
      · registrado{manilla === false ? ", sin manilla" : ""}
    </span>
  );
}

// Fotos de carnet: solo se piden para la ficha que salió de un escaneo, no para cada
// tarjeta de la lista del día. Son las mismas fotos que sube administración; acá se
// muestran de solo lectura, sin subir ni borrar nada.
async function EntryPhotos({ entry }: { entry: AccessEntry }) {
  const documents = await listIdDocuments(
    entry.isBooking ? { kind: "booking", bookingId: entry.entryId } : { kind: "stay", stayId: entry.entryId },
  );
  if (documents.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
        Todavía no hay fotos de carnet cargadas para este grupo.
      </p>
    );
  }
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Fotos de carnet ({documents.length})
      </p>
      <ul className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {documents.map((doc) => (
          <li key={doc.id}>
            {doc.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={doc.url}
                alt={`Carnet de ${doc.personName || "titular"}, ${doc.side === "front" ? "anverso" : "reverso"}`}
                className="h-24 w-full rounded-lg border border-slate-200 object-cover"
              />
            ) : (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-24 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-cyan-700"
              >
                Ver PDF
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntryCard({ entry, showPhotos = false }: { entry: AccessEntry; showPhotos?: boolean }) {
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
            <WristbandMark checkedIn={entry.titularCheckedIn} />
          </li>
          {entry.people.map((person, index) => (
            <li key={`${entry.entryId}-${index}`}>
              {person.nombre}
              {person.carnet ? ` · CI ${person.carnet}` : ""}
              <WristbandMark checkedIn={person.registrado} manilla={person.manilla} />
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

      {showPhotos ? <EntryPhotos entry={entry} /> : null}
    </article>
  );
}

export default async function GuardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; qr?: string }>;
}) {
  const session = await requireGuard();
  const p = await searchParams;
  const search = (p.q ?? "").trim();
  const qrToken = (p.qr ?? "").trim();
  const today = todayInLaPaz();

  // El QR es un atajo, no un modo aparte: si viene un token se resuelve una sola ficha y se
  // deja de lado la lista del día, igual que ya pasa cuando se busca por nombre.
  if (qrToken) {
    const scanned = await getAccessEntryByToken(qrToken);
    return (
      <main className="min-h-screen bg-[#f6f4ef] px-4 py-8 text-night">
        <div className="mx-auto max-w-2xl">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-turquoise">RentaMar</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Portería</h1>
              <p className="mt-1 text-sm text-slate-600">Resultado del QR escaneado.</p>
            </div>
            <form action={signOutGuardAction}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                Salir
              </button>
            </form>
          </header>

          <Link href="/guardias" className="mb-5 inline-block text-sm font-semibold text-turquoise underline">
            ← Volver a la lista de hoy
          </Link>

          {scanned ? (
            <EntryCard entry={scanned} showPhotos />
          ) : (
            <p className="rounded-2xl border border-slate-300 bg-white p-6 text-center text-slate-600">
              Ese código no es válido o ya venció. Probá escanear de nuevo o buscá por nombre o
              carnet.
            </p>
          )}
        </div>
      </main>
    );
  }

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

        <form method="get" className="mb-3 flex gap-2">
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

        <div className="mb-5">
          <QrScanButton />
        </div>

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
