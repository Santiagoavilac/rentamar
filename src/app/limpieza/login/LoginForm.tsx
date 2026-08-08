"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInCleanerAction, type CleanerLoginState } from "./actions";

const inputClass =
  "rounded-xl border border-white/15 bg-night/60 px-3.5 py-2.5 text-cream outline-none focus:border-turquoise-soft";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-xl bg-turquoise px-4 py-3 font-semibold text-deep transition hover:bg-turquoise-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Ingresando…" : "Ingresar"}
    </button>
  );
}

export default function CleanerLoginForm() {
  const [state, formAction] = useActionState<CleanerLoginState, FormData>(signInCleanerAction, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-cream/80">Usuario</span>
        <input name="username" autoComplete="username" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-cream/80">Contraseña</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
