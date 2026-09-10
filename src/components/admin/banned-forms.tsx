"use client";

import { useActionState } from "react";
import { Submit } from "./forms";
import type { ActionResult } from "@/lib/admin/actions";

type FormAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;
const initial: ActionResult = { ok: false, error: null };

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";

function Feedback({ error, ok }: ActionResult) {
  return error ? (
    <p role="alert" className="mt-2 text-sm text-rose-700">
      {error}
    </p>
  ) : ok ? (
    <p role="status" className="mt-2 text-sm text-emerald-700">
      Listo.
    </p>
  ) : null;
}

export function BannedGuestForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">
        Nombre completo
        <input required name="fullName" minLength={2} className={field} />
      </label>
      <label className="text-sm font-semibold">
        Documento de identidad
        <input required name="documentId" minLength={4} className={field} />
      </label>
      <label className="text-sm font-semibold sm:col-span-2">
        Motivo (opcional)
        <input name="reason" maxLength={500} className={field} />
      </label>
      <div className="sm:col-span-2">
        <Submit label="Agregar a la lista" />
        <Feedback {...state} />
      </div>
    </form>
  );
}

export function RevokeBannedGuestForm({ action, id }: { action: FormAction; id: string }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button className="text-xs font-semibold text-cyan-700 underline">Quitar de la lista</button>
      <Feedback {...state} />
    </form>
  );
}
