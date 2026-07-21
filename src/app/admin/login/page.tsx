import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Ingreso staff | RentaMar",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-deep px-4 py-16">
      <div className="glass-strong w-full max-w-sm rounded-3xl p-8">
        <p className="eyebrow text-turquoise-soft">RentaMar</p>
        <h1 className="mt-2 text-2xl font-semibold text-cream">Panel interno</h1>
        <p className="mt-1 mb-6 text-sm text-cream/60">
          Acceso exclusivo del equipo. Las cuentas las crea un administrador.
        </p>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </main>
  );
}
