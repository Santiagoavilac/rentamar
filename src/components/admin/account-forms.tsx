"use client";

import { useActionState } from "react";
import { Submit } from "./forms";
import type { ActionResult } from "@/lib/admin/actions";

type FormAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;
const initial: ActionResult = { ok: false, error: null };

const input = "mt-1 w-full rounded border p-2";

function Feedback({ state, okLabel }: { state: ActionResult; okLabel: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-rose-700">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-emerald-700">
        {okLabel}
      </p>
    );
  }
  return null;
}

// Formularios de las cuentas con usuario y contraseña que crea administración
// (copropietarios y personal de limpieza). Cambiar contraseña, activar y eliminar son
// idénticos para ambos módulos: solo cambia la server action que reciben.

// Alta completa en un solo paso: usuario, contraseña, propiedad y habitaciones. El email
// que Supabase Auth necesita se deriva del usuario en el servidor, así que acá no se pide
// ni se muestra.
export function CreateCoOwnerForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-3 md:max-w-md">
      <label className="text-sm">
        Usuario
        <input
          required
          name="username"
          autoComplete="off"
          minLength={3}
          maxLength={32}
          pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}"
          placeholder="juan.perez"
          aria-describedby="co-owner-username-help"
          title="Ingresá el usuario sin espacios. Podés usar letras, números, punto, guion o guion bajo."
          className={input}
        />
        <span id="co-owner-username-help" className="mt-1 block text-xs text-slate-500">
          Escribilo sin espacios. Podés usar letras, números, punto, guion o guion bajo.
        </span>
      </label>
      <label className="text-sm">
        Contraseña
        <input
          required
          type="password"
          name="password"
          minLength={10}
          autoComplete="new-password"
          className={input}
        />
      </label>
      <label className="text-sm">
        Propiedad
        <input required name="propertyName" placeholder="Edificio Coral" className={input} />
      </label>
      <label className="text-sm">
        N° de habitaciones
        <input
          required
          type="number"
          name="roomCount"
          min={1}
          max={200}
          defaultValue={1}
          className={input}
        />
      </label>
      <p className="text-xs text-slate-500">
        La contraseña queda definitiva desde ahora. Entregala al copropietario por un canal seguro.
      </p>
      <div>
        <Submit label="Crear cuenta" />
      </div>
      <Feedback state={state} okLabel="Cuenta creada." />
    </form>
  );
}

export function CreateCleanerForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-3 md:max-w-md">
      <label className="text-sm">
        Nombre completo
        <input required name="fullName" placeholder="María Pérez" className={input} />
      </label>
      <label className="text-sm">
        Usuario
        <input
          required
          name="username"
          autoComplete="off"
          minLength={3}
          maxLength={32}
          pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}"
          placeholder="maria.perez"
          aria-describedby="cleaner-username-help"
          title="Ingresá el usuario sin espacios. Podés usar letras, números, punto, guion o guion bajo."
          className={input}
        />
        <span id="cleaner-username-help" className="mt-1 block text-xs text-slate-500">
          Escribilo sin espacios. Podés usar letras, números, punto, guion o guion bajo.
        </span>
      </label>
      <label className="text-sm">
        Contraseña
        <input
          required
          type="password"
          name="password"
          minLength={10}
          autoComplete="new-password"
          className={input}
        />
      </label>
      <p className="text-xs text-slate-500">
        Con esta cuenta la persona entra en /limpieza y reporta su hora de entrada y salida.
      </p>
      <div>
        <Submit label="Crear cuenta" />
      </div>
      <Feedback state={state} okLabel="Cuenta creada." />
    </form>
  );
}

export function ChangePasswordForm({
  action,
  accountId,
}: {
  action: FormAction;
  accountId: string;
}) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <input
        required
        type="password"
        name="password"
        minLength={10}
        autoComplete="new-password"
        placeholder="Nueva contraseña"
        className="w-44 rounded border p-1.5 text-sm"
      />
      <Submit label="Cambiar" />
      <Feedback state={state} okLabel="Contraseña actualizada." />
    </form>
  );
}

export function ToggleActiveForm({
  action,
  accountId,
  isActive,
}: {
  action: FormAction;
  accountId: string;
  isActive: boolean;
}) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <Submit label={isActive ? "Desactivar" : "Activar"} />
      <Feedback state={state} okLabel="Estado actualizado." />
    </form>
  );
}

export function DeleteAccountForm({
  action,
  accountId,
}: {
  action: FormAction;
  accountId: string;
}) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <Submit label="Eliminar" />
      <Feedback state={state} okLabel="Cuenta eliminada." />
    </form>
  );
}
