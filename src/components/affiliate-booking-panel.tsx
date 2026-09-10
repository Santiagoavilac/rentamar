"use client";

import { useActionState, useEffect, useState } from "react";
import { CalendarDays, Loader2, MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import { createAffiliateRequestAction, type AffiliateRequestState } from "@/app/afiliados/actions";
import type { AffiliateQuote } from "@/lib/affiliates";
import { useStayRange } from "./booking/use-stay-range";
import { useQuote } from "./booking/use-quote";
import { BookingCalendar, StayDatesSummary } from "./booking/booking-calendar";
import { CompanionsFields, type Companion } from "./booking/companions-fields";

const initialState: AffiliateRequestState = { ok: false, message: "" };

export function AffiliateBookingPanel({
  propertyId,
  propertyName,
  maxGuests,
  minimumNights,
  nightlyPriceMinor,
  currency,
  checkInTime,
  checkOutTime,
  bookedRanges,
}: {
  propertyId: string;
  propertyName: string;
  maxGuests: number;
  minimumNights: number;
  nightlyPriceMinor: number;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  bookedRanges: string[];
}) {
  const stay = useStayRange(bookedRanges, minimumNights);
  const [guests, setGuests] = useState(1);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [state, formAction, pending] = useActionState(createAffiliateRequestAction, initialState);

  const { checkIn, checkOut } = stay;
  const { quote, quoting, quoteError } = useQuote<AffiliateQuote>({
    endpoint: "/api/afiliados/quote",
    propertyId,
    checkIn,
    checkOut,
    guestCount: guests,
    enabled: stay.isComplete,
  });
  const error = stay.rangeError ?? quoteError;

  // El WhatsApp se abre desde el cliente porque la URL solo existe tras registrar
  // la solicitud en el servidor con el total ya calculado.
  useEffect(() => {
    if (state.ok && state.whatsappUrl) window.open(state.whatsappUrl, "_blank", "noopener");
  }, [state]);

  const companionsAllowed = Math.max(0, guests - 1);
  const canSubmit = Boolean(quote) && !pending && companions.length <= companionsAllowed;

  if (state.ok) {
    return (
      <aside className="rounded-3xl bg-white p-6 text-night shadow-[0_24px_70px_-32px_rgba(0,0,0,.55)] lg:sticky lg:top-24">
        <p className="eyebrow text-cyan-700">Solicitud {state.bookingCode}</p>
        <h2 className="mt-2 text-2xl font-bold">Fechas bloqueadas</h2>
        <p className="mt-3 leading-6 text-night/70">{state.message}</p>
        {state.whatsappUrl ? (
          <a
            href={state.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-turquoise px-5 py-3.5 font-bold text-deep"
          >
            <MessageCircle size={18} /> Abrir WhatsApp
          </a>
        ) : null}
      </aside>
    );
  }

  return (
    <aside
      id="reservar"
      className="rounded-3xl bg-white p-5 text-night shadow-[0_24px_70px_-32px_rgba(0,0,0,.55)] sm:p-6 lg:sticky lg:top-24"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-night/55">Tarifa de afiliado</p>
          <p className="text-2xl font-bold">
            {formatCurrency(nightlyPriceMinor, currency)}{" "}
            <span className="text-sm font-normal text-night/55">/ noche</span>
          </p>
        </div>
        <CalendarDays className="text-turquoise" />
      </div>

      <div className="mt-5">
        <BookingCalendar stay={stay} minimumNights={minimumNights} />
      </div>

      <form action={formAction} className="mt-5 grid gap-4">
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="checkIn" value={checkIn} />
        <input type="hidden" name="checkOut" value={checkOut} />
        <input type="hidden" name="guestCount" value={guests} />
        <input type="hidden" name="companions" value={JSON.stringify(companions)} />

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

        {quoting ? (
          <p className="flex items-center gap-2 text-sm text-night/60">
            <Loader2 size={16} className="animate-spin" /> Calculando tarifa…
          </p>
        ) : null}
        {quote ? (
          <dl className="grid gap-2 rounded-2xl bg-cream p-4 text-sm">
            <div className="flex justify-between">
              <dt>
                {quote.nights} {quote.nights === 1 ? "noche" : "noches"} ×{" "}
                {formatCurrency(nightlyPriceMinor, quote.currency)}
              </dt>
              <dd>{formatCurrency(quote.subtotalMinor, quote.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Acompañantes</dt>
              <dd>{companions.length}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-night/10 pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatCurrency(quote.totalMinor, quote.currency)}</dd>
            </div>
          </dl>
        ) : null}

        <div className="grid gap-3 border-t border-night/10 pt-4">
          <p className="text-sm font-bold">Tus datos</p>
          <label className="text-sm font-semibold">
            Nombre completo
            <input
              required
              name="fullName"
              minLength={2}
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Carnet de identidad
            <input
              required
              name="documentId"
              minLength={4}
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Teléfono
            <input
              required
              name="phone"
              minLength={6}
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Email opcional
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Nacionalidad
            <input
              required
              name="nationality"
              defaultValue="Boliviana"
              minLength={3}
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Ciudad de residencia
            <input
              required
              name="city"
              minLength={2}
              className="mt-1 w-full rounded-xl border border-night/15 p-3 font-normal"
            />
          </label>
          <div className="grid gap-2">
            <label className="text-sm font-semibold">
              Carnet de identidad — anverso
              <input
                required
                type="file"
                name="idFront"
                accept="image/jpeg,image/png,application/pdf"
                className="mt-1 w-full rounded-xl border border-night/15 p-2.5 text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-night/5 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
              />
            </label>
            <label className="text-sm font-semibold">
              Carnet de identidad — reverso
              <input
                required
                type="file"
                name="idBack"
                accept="image/jpeg,image/png,application/pdf"
                className="mt-1 w-full rounded-xl border border-night/15 p-2.5 text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-night/5 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
              />
            </label>
          </div>
          <p className="text-xs text-night/50">
            Estos datos y el carnet se usan para la Declaración Jurada de Responsabilidad que exige
            la urbanización. Aceptamos JPG, PNG o PDF (hasta 8 MB).
          </p>
        </div>

        <div className="border-t border-night/10 pt-4">
          <CompanionsFields
            companions={companions}
            onChange={setCompanions}
            allowed={companionsAllowed}
          />
        </div>

        {error || state.message ? (
          <p role="alert" className="text-sm text-rose-700">
            {error || state.message}
          </p>
        ) : null}

        <button
          disabled={!canSubmit}
          className="flex items-center justify-center gap-2 rounded-2xl bg-turquoise px-5 py-3.5 font-bold text-deep transition hover:bg-turquoise-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}{" "}
          {pending ? "Registrando solicitud…" : "Continuar reserva por WhatsApp"}
        </button>
        <p className="text-center text-xs text-night/50">
          Al enviar, las fechas de {propertyName} quedan bloqueadas hasta que confirmemos la reserva
          por WhatsApp.
        </p>
      </form>
    </aside>
  );
}
