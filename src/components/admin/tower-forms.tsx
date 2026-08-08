"use client";

import { useActionState } from "react";
import { Submit } from "@/components/admin/forms";
import type { TowerActionResult } from "@/lib/admin/tower-actions";
import type { TowerOption, TowerRow } from "@/lib/admin/towers";

type FormAction = (state: TowerActionResult, formData: FormData) => Promise<TowerActionResult>;

const initial: TowerActionResult = { ok: false, error: null };

function Feedback({ state }: { state: TowerActionResult }) {
  if (state.error) {
    return <p className="mt-2 text-sm text-rose-700">{state.error}</p>;
  }
  if (state.ok) {
    return <p className="mt-2 text-sm text-emerald-700">Cambios guardados.</p>;
  }
  return null;
}

export function TowerForm({ action, tower }: { action: FormAction; tower?: TowerRow }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_120px]">
      <label className="text-sm">
        Nombre
        <input
          required
          name="name"
          minLength={2}
          maxLength={160}
          defaultValue={tower?.name ?? ""}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Orden
        <input
          required
          type="number"
          name="sortOrder"
          min={0}
          max={10000}
          defaultValue={tower?.sort_order ?? 0}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Descripción
        <textarea
          name="description"
          maxLength={2000}
          rows={3}
          defaultValue={tower?.description ?? ""}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <div className="sm:col-span-2">
        <Submit label={tower ? "Guardar torre" : "Crear torre"} />
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function TowerActiveForm({ action, isActive }: { action: FormAction; isActive: boolean }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction}>
      <Submit label={isActive ? "Desactivar" : "Activar"} />
      <Feedback state={state} />
    </form>
  );
}

export function PropertyTowerForm({
  action,
  towers,
  currentTowerId,
}: {
  action: FormAction;
  towers: TowerOption[];
  currentTowerId: string | null;
}) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex min-w-64 flex-wrap items-start gap-2">
      <label className="sr-only">Torre asignada</label>
      <select
        name="towerId"
        defaultValue={currentTowerId ?? ""}
        className="min-w-40 flex-1 rounded border border-slate-300 px-2 py-2 text-sm"
      >
        <option value="">Sin torre</option>
        {towers.map((tower) => (
          <option key={tower.id} value={tower.id}>
            {tower.name}
            {tower.is_active ? "" : " (inactiva)"}
          </option>
        ))}
      </select>
      <Submit label="Asignar" />
      <div className="w-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}
