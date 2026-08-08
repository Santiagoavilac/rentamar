import type { Metadata } from "next";
import { requireCoOwner } from "@/lib/auth";
import { getCoOwnerAccount } from "@/lib/admin/co-owners";
import StayForm from "@/components/co-owner/stay-form";
import { signOutCoOwnerAction } from "./login/actions";

export const metadata: Metadata = {
  title: "Copropietarios | RentaMar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CoOwnerPage() {
  const session = await requireCoOwner();
  const account = await getCoOwnerAccount(session.userId);

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-4 py-10 text-night">
      <div className="mx-auto max-w-2xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-turquoise">RentaMar</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Registrar estadía</h1>
            <p className="mt-1 text-sm text-slate-600">Sesión de {session.username}.</p>
          </div>
          <form action={signOutCoOwnerAction}>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              Salir
            </button>
          </form>
        </header>

        <section className="surface rounded-2xl p-5">
          <StayForm propertyName={account.propertyName} roomCount={account.roomCount} />
        </section>
      </div>
    </main>
  );
}
