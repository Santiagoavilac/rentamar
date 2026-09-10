"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Loader2, ShieldCheck } from "lucide-react";
import type { Quote } from "@/lib/bookings";
import { calculateDiscountPercent, formatCurrency } from "@/lib/money";
import { useStayRange } from "./booking/use-stay-range";
import { useQuote } from "./booking/use-quote";
import { BookingCalendar, StayDatesSummary } from "./booking/booking-calendar";
import {
  QuoteLoading,
  QuoteSummary,
  formatDiscountPercent,
} from "./booking/quote-summary";

type Guest = {
  name: string;
  email: string;
  phone: string;
  documentId: string;
  nationality: string;
  city: string;
};

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
  const stay = useStayRange(bookedRanges, minimumNights);
  const [guests, setGuests] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [guest, setGuest] = useState<Guest>({
    name: "",
    email: "",
    phone: "",
    documentId: "",
    nationality: "Boliviana",
    city: "",
  });

  const { checkIn, checkOut } = stay;
  const { quote, quoting, quoteError } = useQuote<Quote>({
    endpoint: "/api/bookings/quote",
    propertyId,
    checkIn,
    checkOut,
    guestCount: guests,
    enabled: stay.isComplete,
  });
  // Un solo mensaje a la vista: el de la selección de fechas manda, después el de la
  // cotización y por último el del envío.
  const error = stay.rangeError ?? quoteError ?? submitError;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote || !checkIn || !checkOut) {
      setSubmitError("Seleccioná un rango válido antes de reservar.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
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
      setSubmitError(
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

      <div className="mt-5">
        <BookingCalendar stay={stay} minimumNights={minimumNights} />
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-4">
        <StayDatesSummary
          checkIn={checkIn}
          checkOut={checkOut}
          checkInTime={checkInTime}
          checkOutTime={checkOutTime}
        />
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

        {quoting ? <QuoteLoading /> : null}
        {quote ? <QuoteSummary quote={quote} /> : null}

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
