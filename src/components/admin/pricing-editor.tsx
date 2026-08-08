"use client";

import { useMemo, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/admin/actions";
import { formatCurrency } from "@/lib/money";
import type { Quote } from "@/lib/bookings";

type PriceRow = { nights: number; total: string };
type PricingAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-deep px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
    >
      {pending ? "Guardando…" : "Guardar precios"}
    </button>
  );
}

function decimal(value: number) {
  return Math.max(0, value).toFixed(2);
}

export function PricingEditor({
  action,
  propertyId,
  maxGuests,
  initialBaseMinor,
  initialEnabled,
  initialPrices,
}: {
  action: PricingAction;
  propertyId: string;
  maxGuests: number;
  initialBaseMinor: number;
  initialEnabled: boolean;
  initialPrices: { nights: number; total_price_minor: number }[];
}) {
  const [state, formAction] = useActionState(action, { ok: false, error: null });
  const [basePrice, setBasePrice] = useState(decimal(initialBaseMinor / 100));
  const [enabled, setEnabled] = useState(initialEnabled);
  const [rows, setRows] = useState<PriceRow[]>(
    initialPrices.map((price) => ({
      nights: price.nights,
      total: decimal(price.total_price_minor / 100),
    })),
  );
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const base = Number(basePrice) || 0;
  const sortedRows = useMemo(() => [...rows].sort((a, b) => a.nights - b.nights), [rows]);

  function updateRow(index: number, next: Partial<PriceRow>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...next } : row)),
    );
  }

  function discountFor(row: PriceRow) {
    const normal = base * row.nights;
    if (!normal) return 0;
    return Math.max(0, Math.min(100, ((normal - Number(row.total || 0)) / normal) * 100));
  }

  async function simulate() {
    if (!checkIn || !checkOut) {
      setQuoteError("Seleccioná las fechas de la simulación.");
      return;
    }
    setQuoting(true);
    setQuote(null);
    setQuoteError(null);
    try {
      const response = await fetch("/api/bookings/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, checkIn, checkOut, guestCount: guests }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "No se pudo calcular la cotización");
      setQuote(body as Quote);
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : "No se pudo calcular la cotización");
    } finally {
      setQuoting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <form
        action={formAction}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="pricesJson" value={JSON.stringify(sortedRows)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Precio base por noche (BOB)
            <input
              required
              name="basePrice"
              inputMode="decimal"
              value={basePrice}
              onChange={(event) => setBasePrice(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              name="durationPricingEnabled"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Activar precios por cantidad de noches
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Precios por estadía</h2>
            <p className="text-sm text-slate-600">
              Las temporadas tienen prioridad. Cada total debe ser menor o igual al precio normal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRows((current) => [...current, { nights: 1, total: decimal(base) }])}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            <Plus size={16} /> Añadir
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {rows.length ? (
            rows.map((row, index) => {
              const normal = base * row.nights;
              const discount = discountFor(row);
              return (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[110px_1fr_1fr_auto]"
                >
                  <label className="text-sm">
                    Noches
                    <input
                      required
                      type="number"
                      min="1"
                      max="365"
                      value={row.nights}
                      onChange={(event) => updateRow(index, { nights: Number(event.target.value) })}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label className="text-sm">
                    Total (BOB)
                    <input
                      required
                      inputMode="decimal"
                      value={row.total}
                      onChange={(event) => updateRow(index, { total: event.target.value })}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label className="text-sm">
                    Descuento {discount.toFixed(1)}%
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="0.5"
                      value={discount}
                      onChange={(event) =>
                        updateRow(index, {
                          total: decimal(normal * (1 - Number(event.target.value) / 100)),
                        })
                      }
                      className="mt-3 w-full accent-cyan-600"
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      Normal: {formatCurrency(Math.round(normal * 100))}
                    </span>
                  </label>
                  <button
                    type="button"
                    aria-label="Eliminar duración"
                    onClick={() =>
                      setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                    }
                    className="self-center rounded-lg p-2 text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              Todavía no hay precios configurados por duración.
            </p>
          )}
        </div>

        <label className="mt-5 block text-sm font-semibold text-slate-700">
          Motivo del cambio
          <textarea
            required
            minLength={4}
            name="reason"
            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-3"
          />
        </label>
        <div className="mt-4 flex items-center gap-4">
          <SaveButton />
          {state.error ? <p className="text-sm text-rose-700">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-700">Precios guardados.</p> : null}
        </div>
      </form>

      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
        <h2 className="font-bold">Simulación oficial</h2>
        <p className="mt-1 text-sm text-slate-600">
          Usa la misma RPC que la reserva pública. Guardá primero para simular los cambios nuevos.
        </p>
        <div className="mt-4 grid gap-3">
          <label className="text-sm">
            Ingreso
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label className="text-sm">
            Salida
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label className="text-sm">
            Huéspedes
            <input
              type="number"
              min="1"
              max={maxGuests}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <button
            type="button"
            onClick={simulate}
            disabled={quoting}
            className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {quoting ? "Calculando…" : "Calcular"}
          </button>
        </div>
        {quoteError ? (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {quoteError}
          </p>
        ) : null}
        {quote ? (
          <dl className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt>{quote.nights} noches</dt>
              <dd>{formatCurrency(quote.originalSubtotalMinor, quote.currency)}</dd>
            </div>
            {quote.discountMinor > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <dt>Descuento ({quote.discountPercent}%)</dt>
                <dd>-{formatCurrency(quote.discountMinor, quote.currency)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd>{formatCurrency(quote.totalMinor, quote.currency)}</dd>
            </div>
          </dl>
        ) : null}
      </aside>
    </div>
  );
}
