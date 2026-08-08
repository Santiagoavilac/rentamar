import type { Metadata } from "next";
import { requireCleaner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInLaPaz } from "@/lib/admin/planner-query";
import CleaningReportForm from "@/components/cleaning/report-form";
import { signOutCleanerAction } from "./login/actions";

export const metadata: Metadata = {
  title: "Personal de limpieza | RentaMar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CleaningPage() {
  const session = await requireCleaner();

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, name")
    .eq("status", "published")
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-4 py-10 text-night">
      <div className="mx-auto max-w-2xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-turquoise">RentaMar</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Registrar limpieza</h1>
            <p className="mt-1 text-sm text-slate-600">Sesión de {session.fullName}.</p>
          </div>
          <form action={signOutCleanerAction}>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              Salir
            </button>
          </form>
        </header>

        <section className="surface rounded-2xl p-5">
          <CleaningReportForm properties={properties ?? []} today={todayInLaPaz()} />
        </section>
      </div>
    </main>
  );
}
