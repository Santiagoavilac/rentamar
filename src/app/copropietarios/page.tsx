import type { Metadata } from "next";
import Link from "next/link";
import { requireCoOwner } from "@/lib/auth";
import { getCoOwnerAccount } from "@/lib/admin/co-owners";
import CoOwnerShell from "@/components/co-owner/page-shell";

export const metadata: Metadata = {
  title: "Copropietarios | RentaMar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Pantalla de entrada: en vez de caer directo al formulario, el copropietario elige qué
// hacer. "Reservas de mi propiedad" solo aparece si administración vinculó la cuenta a una
// propiedad publicada; sin ese vínculo no hay nada que mostrar.
export default async function CoOwnerHomePage() {
  const session = await requireCoOwner();
  const account = await getCoOwnerAccount(session.userId);

  return (
    <CoOwnerShell
      title={account.propertyName}
      subtitle={`Sesión de ${session.username}. ¿Qué querés hacer?`}
    >
      <div className="grid gap-3">
        <Option
          href="/copropietarios/registro"
          title="Registrar estadía"
          body="Declarar quién se queda en tu propiedad, con sus datos y fechas."
        />
        <Option
          href="/copropietarios/estadias"
          title="Mis estadías declaradas"
          body="Todo lo que registraste, de lo más reciente a lo más antiguo."
        />
        {account.propertyId ? (
          <Option
            href="/copropietarios/reservas"
            title="Reservas de mi propiedad"
            body="Los alquileres que RentaMar generó sobre tu departamento."
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
            Todavía no hay una propiedad publicada vinculada a tu cuenta, así que no podemos
            mostrarte sus reservas. Avisá a administración.
          </p>
        )}
      </div>
    </CoOwnerShell>
  );
}

function Option({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="surface rounded-2xl p-5 transition-colors hover:border-turquoise hover:bg-white"
    >
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </Link>
  );
}
