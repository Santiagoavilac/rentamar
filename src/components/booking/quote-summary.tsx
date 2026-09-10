"use client";

import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import type { Quote } from "@/lib/bookings";

// Desglose de precio. Lo que ve el huésped antes de comprometerse: qué incluye y cuánto es
// el total final.

export function formatDiscountPercent(value: number) {
  return value.toLocaleString("es-BO", { maximumFractionDigits: 2 });
}

export function QuoteLoading() {
  return (
    <p className="flex items-center gap-2 text-sm text-night/60">
      <Loader2 size={16} className="animate-spin" /> Calculando precio…
    </p>
  );
}

export function QuoteSummary({ quote }: { quote: Quote }) {
  return (
    <dl className="grid gap-2 rounded-2xl bg-cream p-4 text-sm">
      <div className="flex justify-between">
        <dt>{quote.nights} noches</dt>
        <dd className={quote.discountMinor > 0 ? "line-through text-night/45" : ""}>
          {formatCurrency(quote.originalSubtotalMinor, quote.currency)}
        </dd>
      </div>
      {quote.discountMinor > 0 ? (
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-3 font-semibold text-emerald-700"
        >
          <dt className="flex items-center gap-2">
            Descuento
            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
              -{formatDiscountPercent(quote.discountPercent)}%
            </span>
          </dt>
          <dd>-{formatCurrency(quote.discountMinor, quote.currency)}</dd>
        </div>
      ) : null}
      {quote.cleaningFeeMinor > 0 ? (
        <div className="flex justify-between">
          <dt>Limpieza</dt>
          <dd>{formatCurrency(quote.cleaningFeeMinor, quote.currency)}</dd>
        </div>
      ) : null}
      {quote.serviceFeeMinor > 0 ? (
        <div className="flex justify-between">
          <dt>Servicio</dt>
          <dd>{formatCurrency(quote.serviceFeeMinor, quote.currency)}</dd>
        </div>
      ) : null}
      <div className="mt-1 flex justify-between border-t border-night/10 pt-3 text-base font-bold">
        <dt>Total</dt>
        <dd>{formatCurrency(quote.totalMinor, quote.currency)}</dd>
      </div>
    </dl>
  );
}
