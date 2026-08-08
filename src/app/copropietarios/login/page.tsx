import type { Metadata } from "next";
import CoOwnerLoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Ingreso copropietarios | RentaMar",
  robots: { index: false, follow: false },
};

export default function CoOwnerLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-deep px-4 py-16">
      <div className="glass-strong w-full max-w-sm rounded-3xl p-8">
        <p className="eyebrow text-turquoise-soft">RentaMar</p>
        <h1 className="mt-2 text-2xl font-semibold text-cream">Copropietarios</h1>
        <p className="mt-1 mb-6 text-sm text-cream/60">
          Ingresá con el usuario y la contraseña que te dio administración.
        </p>
        <CoOwnerLoginForm />
      </div>
    </main>
  );
}
