"use client";

import { useActionState, useState } from "react";
import { Submit } from "./forms";
import type { ActionResult } from "@/lib/admin/actions";

// Selector de comodidades, estilo Airbnb: se tilda lo que la propiedad tiene y, donde tiene
// sentido contar (televisores, camas, baños de cortesía), se escribe cuántas.
//
// El catálogo vive en la base, no en el código: agregar una comodidad nueva es un insert en
// `amenities`, no un deploy.

type FormAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;
const initial: ActionResult = { ok: false, error: null };

export type AmenityOption = { id: string; name: string; slug: string; icon: string | null };
export type AmenitySelection = { amenityId: string; quantity: number | null };

function AmenityRow({
  amenity,
  initialSelection,
}: {
  amenity: AmenityOption;
  initialSelection: AmenitySelection | undefined;
}) {
  const [checked, setChecked] = useState(Boolean(initialSelection));

  return (
    <li className="flex items-center gap-2">
      <label className="flex flex-1 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="amenityId"
          value={amenity.id}
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        {amenity.name}
      </label>
      {/* La cantidad solo se manda si la comodidad está tildada: un número suelto de algo
          que la propiedad no tiene no significa nada. */}
      {checked ? (
        <input
          type="number"
          min={1}
          max={99}
          name={`quantity_${amenity.id}`}
          defaultValue={initialSelection?.quantity ?? ""}
          placeholder="Cant."
          aria-label={`Cantidad de ${amenity.name}`}
          className="w-20 rounded border p-1 text-sm"
        />
      ) : null}
    </li>
  );
}

export function AmenitiesPicker({
  action,
  amenities,
  selected,
}: {
  action: FormAction;
  amenities: AmenityOption[];
  selected: AmenitySelection[];
}) {
  const [state, formAction] = useActionState(action, initial);
  const byId = new Map(selected.map((item) => [item.amenityId, item]));

  return (
    <form action={formAction} className="mt-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {amenities.map((amenity) => (
          <AmenityRow
            key={amenity.id}
            amenity={amenity}
            initialSelection={byId.get(amenity.id)}
          />
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Dejá la cantidad vacía cuando no se cuenta (wifi, parrilla, seguridad).
      </p>
      <div className="mt-3">
        <Submit label="Guardar comodidades" />
        {state.error ? (
          <p role="alert" className="mt-2 text-sm text-rose-700">
            {state.error}
          </p>
        ) : state.ok ? (
          <p role="status" className="mt-2 text-sm text-emerald-700">
            Comodidades guardadas.
          </p>
        ) : null}
      </div>
    </form>
  );
}
