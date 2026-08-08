"use client";

import { useEffect, useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { CalendarDays, Loader2, ShieldCheck } from "lucide-react";
import type { Quote } from "@/lib/bookings";
import { calculateDiscountPercent, formatCurrency } from "@/lib/money";
import {
  dateIsOccupied,
  localIsoDate,
  nightsBetween,
  parsePostgresDateRange,
  stayOverlapsRange,
} from "@/lib/date-ranges";

type Guest = {
  name: string;
  email: string;
  phone: string;
  documentId: string;
  nationality: string;
  city: string;
};

function formatDiscountPercent(value: number) {
  return value.toLocaleString("es-BO", { maximumFractionDigits: 2 });
}

export function PropertyBookingPanel({
  propertyId,
  propertyName,
  maxGuests,
  minimumNights,
  basePriceMinor,
  currency,
  checkInTime,
  checkOutTime,
  bookedRanges,
  stayPrices,
}: {
  propertyId: string;
  propertyName: string;
  maxGuests: number;
  minimumNights: number;
  basePriceMinor: number;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  bookedRanges: string[];
  stayPrices: { nights: number; totalPriceMinor: number }[];
}) {
  const occupied = useMemo(
    () =>
      bookedRanges
        .map(parsePostgresDateRange)
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    [bookedRanges],
  );
  const stayPriceOptions = useMemo(
    () =>
      stayPrices.map((price) => ({
        ...price,
        discountPercent: calculateDiscountPercent(
          basePriceMinor * price.nights,
          price.totalPriceMinor,
        ),
      })),
    [basePriceMinor, stayPrices],
  );
  const [range, setRange] = useState<DateRange>();
  const [guests, setGuests] = useState(1);
  const [months, setMonths] = useState(2);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState<Guest>({
    name: "",
    email: "",
    phone: "",
    documentId: "",
    nationality: "Boliviana",
    city: "",
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setMonths(media.matches ? 1 : 2);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const checkIn = range?.from ? localIsoDate(range.from) : "";
  const checkOut = range?.to ? localIsoDate(range.to) : "";
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  useEffect(() => {
    if (!checkIn || !checkOut || nights < minimumNights) {
      setQuote(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setQuoting(true);
      setError(null);
      try {
        const response = await fetch("/api/bookings/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ propertyId, checkIn, checkOut, guestCount: guests }),
          signal: controller.signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message ?? "No se pudo calcular el precio");
        setQuote(body as Quote);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setQuote(null);
        setError(
          requestError instanceof Error ? requestError.message : "No se pudo calcular el precio",
        );
      } finally {
        if (!controller.signal.aborted) setQuoting(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [checkIn, checkOut, guests, minimumNights, nights, propertyId]);

  function disabledDay(date: Date) {
    const iso = localIsoDate(date);
    const today = localIsoDate(new Date());
    if (iso < today) return true;
    if (range?.from && !range.to && iso > localIsoDate(range.from)) {
      return stayOverlapsRange(localIsoDate(range.from), iso, occupied);
    }
    if (range?.to && iso === localIsoDate(range.to)) return false;
    return dateIsOccupied(iso, occupied);
  }

  function selectRange(next: DateRange | undefined) {
    setError(null);
    if (next?.from && next.to) {
      const from = localIsoDate(next.from);
      const to = localIsoDate(next.to);
      if (stayOverlapsRange(from, to, occupied)) {
        setError("El rango incluye noches que ya no están disponibles.");
        return;
      }
      if (nightsBetween(from, to) < minimumNights) {
        setRange(next);
        setError(`Esta propiedad requiere un mínimo de ${minimumNights} noches.`);
        return;
      }
    }
    setRange(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote || !checkIn || !checkOut) {
      setError("Seleccioná un rango válido antes de reservar.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyId,
          checkIn,
          checkOut,
          guestCount: guests,
          guest: {
            name: guest.name,
            email: guest.email,
            phone: guest.phone || undefined,
            documentId: guest.documentId,
            nationality: guest.nationality,
            city: guest.city,
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "No se pudo iniciar la reserva");
      window.location.assign(
        `/pago/${body.bookingId}?token=${encodeURIComponent(body.accessToken)}`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "No se pudo iniciar la reserva",
      );
      setSubmitting(false);
    }
  }

  return (
    <aside
      id="reservar"
      className="rounded-3xl bg-white p-5 text-night shadow-[0_24px_70px_-32px_rgba(0,0,0,.55)] sm:p-6 lg:sticky lg:top-24"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-night/55">Desde</p>
          <p className="text-2xl font-bold">
            {formatCurrency(basePriceMinor, currency)}{" "}
            <span className="text-sm font-normal text-night/55">/ noche</span>
          </p>
        </div>
        <CalendarDays className="text-turquoise" />
      </div>

      {stayPriceOptions.length ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {stayPriceOptions.map((price) => (
            <span
              key={price.nights}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                price.discountPercent > 0
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-cyan-50 text-cyan-800"
              }`}
            >
              {price.nights} noches · {formatCurrency(price.totalPriceMinor, currency)}
              {price.discountPercent > 0 ? (
                <strong className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">
                  -{formatDiscountPercent(price.discountPercent)}%
                </strong>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-night/10 p-2">
        <DayPicker
          mode="range"
          numberOfMonths={months}
          selected={range}
          onSelect={selectRange}
          disabled={disabledDay}
          excludeDisabled
          defaultMonth={new Date()}
          className="mx-auto"
        />
      </div>
      <p className="mt-2 text-xs text-night/55">
        Mínimo {minimumNights} {minimumNights === 1 ? "noche" : "noches"}. La fecha de salida no se
        cobra como noche.
      </p>

      <form onSubmit={submit} className="mt-5 grid gap-4">
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-night/10 p-3 text-sm">
          <div>
            <span className="block text-xs text-night/50">Ingreso</span>
            <strong>{checkIn || "Seleccionar"}</strong>
            <span className="block text-xs text-night/55">{checkInTime}</span>
          </div>
          <div>
            <span className="block text-xs text-night/50">Salida</span>
            <strong>{checkOut || "Seleccionar"}</strong>
            <span className="block text-xs text-night/55">{checkOutTime}</span>
          </div>
        </div>
        <label className="text-sm font-semibold">
          Huéspedes
          <select
            value={guests}
            onChange={(event) => setGuests(Number(event.target.value))}
            className="mt-1 w-full rounded-xl border border-night/15 bg-white p-3 font-normal"
          >
            {Array.from({ length: maxGuests }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value} {value === 1 ? "huésped" : "huéspedes"}
              </option>
            ))}
          </select>
        </label>

        {quoting ? (
          <p className="flex items-center gap-2 text-sm text-night/60">
            <Loader2 size={16} className="animate-spin" /> Calculando precio…
          </p>
        ) : null}
        {quote ? (
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
        ) : null}

        <div className="grid gap-3 border-t border-night/10 pt-4">
          <label className="text-sm font-semibold">
            Nombre completo
            <input
              required
              minLength={2}
              value={guest.name}
              onChange={(event) =>
                setGuest((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Email
            <input
              required
              type="email"
              value={guest.email}
              onChange={(event) =>
                setGuest((current) => ({ ...current, email: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Teléfono opcional
            <input
              value={guest.phone}
              onChange={(event) =>
                setGuest((current) => ({ ...current, phone: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Cédula de identidad
            <input
              required
              minLength={4}
              value={guest.documentId}
              onChange={(event) =>
                setGuest((current) => ({ ...current, documentId: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Nacionalidad
            <input
              required
              minLength={3}
              value={guest.nationality}
              onChange={(event) =>
                setGuest((current) => ({ ...current, nationality: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Ciudad de residencia
            <input
              required
              minLength={2}
              value={guest.city}
              onChange={(event) =>
                setGuest((current) => ({ ...current, city: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <p className="text-xs text-night/50">
            Estos datos se usan para la Declaración Jurada de Responsabilidad que exige la
            urbanización.
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <button
          disabled={!quote || submitting}
          className="flex items-center justify-center gap-2 rounded-2xl bg-turquoise px-5 py-3.5 font-bold text-deep transition hover:bg-turquoise-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}{" "}
          {submitting ? "Creando prerreserva…" : `Reservar ${propertyName}`}
        </button>
        <p className="text-center text-xs text-night/50">
          Las fechas quedan bloqueadas durante 30 minutos para completar el pago.
        </p>
      </form>
    </aside>
  );
}
