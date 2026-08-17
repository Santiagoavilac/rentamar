"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/admin/actions";
import {
  PropertyFields,
  WeekendPricingFields,
  type PropertyValues,
} from "@/components/admin/forms";
import { PanelHeading } from "@/components/admin/help";

type RateRow = {
  id: string | null;
  startDate: string;
  endDate: string;
  price: string;
  minimumNights: string;
  label: string;
};

export type EditorRate = {
  id: string;
  start_date: string;
  end_date: string;
  nightly_price_minor: number;
  minimum_nights: number | null;
  label: string | null;
};

function SaveBar({ state }: { state: ActionResult }) {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 -mx-5 mt-6 flex flex-wrap items-center gap-4 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-deep px-6 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar todo"}
      </button>
      <span className="text-sm text-slate-600">
        Datos, precio base, fin de semana y tarifas se guardan juntos.
      </span>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm font-semibold text-emerald-700">
          Cambios guardados.
        </p>
      ) : null}
    </div>
  );
}

// Un solo formulario para toda la propiedad: campos, recargo de fin de semana y
// tarifas estacionales. Nada se guarda suelto — todo viaja en el mismo submit.
export function PropertyEditor({
  action,
  values,
  towers,
  canManageAffiliates,
  weekend,
  rates,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  values: PropertyValues;
  towers: { id: string; name: string; is_active: boolean }[];
  canManageAffiliates: boolean;
  weekend: { days: number[]; surchargePercent: number };
  rates: EditorRate[];
}) {
  const [state, formAction] = useActionState(action, { ok: false, error: null });
  const [baseMinor, setBaseMinor] = useState(Number(values.base_price_minor ?? 0));
  const [rows, setRows] = useState<RateRow[]>(
    rates.map((rate) => ({
      id: rate.id,
      startDate: rate.start_date,
      endDate: rate.end_date,
      price: (rate.nightly_price_minor / 100).toFixed(2),
      minimumNights: rate.minimum_nights ? String(rate.minimum_nights) : "",
      label: rate.label ?? "",
    })),
  );

  function updateRow(index: number, next: Partial<RateRow>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...next } : row)),
    );
  }

  // El servidor espera minimumNights numérico (o null), no el string del input.
  const ratesPayload = rows.map((row) => ({
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    price: row.price,
    minimumNights: row.minimumNights ? Number(row.minimumNights) : null,
    label: row.label,
  }));

  return (
    <form action={formAction}>
      <input type="hidden" name="ratesJson" value={JSON.stringify(ratesPayload)} />

      <PanelHeading helpKey="properties.editor.data" className="mb-4 font-bold">
        Datos de la propiedad
      </PanelHeading>
      {/* El precio base se escucha acá para que el bloque de fin de semana calcule sobre
          lo que se está tipeando, sin tener que guardar primero. */}
      <div
        onInput={(event) => {
          const target = event.target as HTMLInputElement;
          if (target.name === "basePrice") {
            setBaseMinor(Math.round((Number(target.value) || 0) * 100));
          }
        }}
      >
        <PropertyFields values={values} towers={towers} canManageAffiliates={canManageAffiliates} />
      </div>

      <section className="mt-8 border-t border-slate-200 pt-6">
        <PanelHeading helpKey="properties.editor.weekend">Precio de fin de semana</PanelHeading>
        <p className="mb-3 mt-1 text-sm text-slate-600">
          Recargo sobre el precio base en los días marcados. Es un ajuste general: los mismos días y
          porcentaje valen para todas las propiedades.
        </p>
        <WeekendPricingFields
          days={weekend.days}
          surchargePercent={weekend.surchargePercent}
          basePriceMinor={baseMinor}
        />
      </section>

      <section className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PanelHeading helpKey="properties.editor.rates">
              Tarifas estacionales y feriados
            </PanelHeading>
            <p className="mt-1 text-sm text-slate-600">
              Fijan el precio de esas noches: tienen prioridad sobre el fin de semana y el precio
              base. Para un feriado suelto, poné el mismo día en Desde y el siguiente en Hasta.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setRows((current) => [
                ...current,
                { id: null, startDate: "", endDate: "", price: "", minimumNights: "", label: "" },
              ])
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            <Plus size={16} /> Añadir tarifa
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {rows.length ? (
            rows.map((row, index) => (
              <div
                key={row.id ?? `nueva-${index}`}
                className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_1fr_1fr_.7fr_1fr_auto]"
              >
                <label className="text-sm">
                  Desde
                  <input
                    required
                    type="date"
                    value={row.startDate}
                    onChange={(event) => updateRow(index, { startDate: event.target.value })}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="text-sm">
                  Hasta
                  <input
                    required
                    type="date"
                    value={row.endDate}
                    onChange={(event) => updateRow(index, { endDate: event.target.value })}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="text-sm">
                  Precio por noche (BOB)
                  <input
                    required
                    inputMode="decimal"
                    value={row.price}
                    onChange={(event) => updateRow(index, { price: event.target.value })}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="text-sm">
                  Mín. noches
                  <input
                    type="number"
                    min="1"
                    value={row.minimumNights}
                    onChange={(event) => updateRow(index, { minimumNights: event.target.value })}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="text-sm">
                  Etiqueta
                  <input
                    value={row.label}
                    onChange={(event) => updateRow(index, { label: event.target.value })}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Quitar tarifa"
                  onClick={() =>
                    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                  }
                  className="self-center rounded-lg p-2 text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              Sin tarifas estacionales. Las noches se cobran con el precio base (más el recargo de
              fin de semana, si está activo).
            </p>
          )}
        </div>
      </section>

      <SaveBar state={state} />
    </form>
  );
}
