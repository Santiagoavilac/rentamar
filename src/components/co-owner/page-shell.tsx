import Link from "next/link";
import { signOutCoOwnerAction } from "@/app/copropietarios/login/actions";

// Marco común de las pantallas del copropietario: mismo fondo, mismo encabezado y el
// botón de salir siempre en el mismo lugar. `back` aparece en todo lo que cuelga del hub.
export default function CoOwnerShell({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f6f4ef] px-4 py-10 text-night">
      <div className="mx-auto max-w-2xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-turquoise">RentaMar</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {back ? (
              <Link
                href="/copropietarios"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              >
                Volver
              </Link>
            ) : null}
            <form action={signOutCoOwnerAction}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                Salir
              </button>
            </form>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
