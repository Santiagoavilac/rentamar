"use client";

import { useActionState } from "react";
import { Submit } from "./forms";
import type { ActionResult } from "@/lib/admin/actions";

type FormAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;
const initial: ActionResult = { ok: false, error: null };

const input = "mt-1 w-full rounded border p-2";

// Propiedades publicadas a las que se puede vincular una cuenta de copropietario.
export type PropertyOption = { id: string; name: string };

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
export function CreateCoOwnerForm({
  action,
  properties,
}: {
  action: FormAction;
  properties: PropertyOption[];
}) {
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
      <label className="text-sm">
        Propiedad publicada
        <select name="propertyId" defaultValue="" className={input}>
          <option value="">Sin vincular</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          Vinculala para que el copropietario vea las reservas de su departamento. Se puede dejar
          sin vincular y completar después.
        </span>
      </label>
      <label className="text-sm">
        Teléfono
        <input required name="phone" inputMode="tel" placeholder="70012345" className={input} />
      </label>
      <label className="text-sm">
        Límite de huéspedes
        <input
          required
          type="number"
          name="maxGuests"
          min={1}
          max={50}
          defaultValue={5}
          aria-describedby="co-owner-max-guests-help"
          className={input}
        />
        <span id="co-owner-max-guests-help" className="mt-1 block text-xs text-slate-500">
          Acompañantes que puede declarar. El titular firma la declaración y no ocupa cupo.
        </span>
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

// Edición de los datos de la cuenta (no del usuario ni de la contraseña). Sirve además
// para completar el teléfono de las cuentas creadas antes de que el campo existiera.
export function EditCoOwnerForm({
  action,
  account,
  properties,
}: {
  action: FormAction;
  account: {
    id: string;
    propertyName: string;
    roomCount: number;
    phone: string | null;
    maxGuests: number;
    propertyId: string | null;
  };
  properties: PropertyOption[];
}) {
  const [state, formAction] = useActionState(action, initial);
  const field = "w-full rounded border p-1.5 text-sm";
  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-4 sm:items-end">
      <input type="hidden" name="accountId" value={account.id} />
      <label className="text-xs text-slate-600">
        Propiedad
        <input required name="propertyName" defaultValue={account.propertyName} className={field} />
      </label>
      <label className="text-xs text-slate-600">
        Habitaciones
        <input
          required
          type="number"
          name="roomCount"
          min={1}
          max={200}
          defaultValue={account.roomCount}
          className={field}
        />
      </label>
      <label className="text-xs text-slate-600">
        Teléfono
        <input
          required
          name="phone"
          inputMode="tel"
          defaultValue={account.phone ?? ""}
          className={field}
        />
      </label>
      <label className="text-xs text-slate-600">
        Límite de huéspedes
        <input
          required
          type="number"
          name="maxGuests"
          min={1}
          max={50}
          defaultValue={account.maxGuests}
          className={field}
        />
      </label>
      <label className="text-xs text-slate-600 sm:col-span-2">
        Propiedad publicada
        <select name="propertyId" defaultValue={account.propertyId ?? ""} className={field}>
          <option value="">Sin vincular</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-4">
        <Submit label="Guardar datos" />
        <Feedback state={state} okLabel="Datos actualizados." />
      </div>
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
        className="w-full rounded border p-1.5 text-sm sm:w-44"
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
