"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { CalendarDays, Loader2, MessageCircle, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import {
  dateIsOccupied,
  localIsoDate,
  nightsBetween,
  parsePostgresDateRange,
  stayOverlapsRange,
} from "@/lib/date-ranges";
import {
  createAffiliateRequestAction,
  type AffiliateRequestState,
} from "@/app/afiliados/actions";
import type { AffiliateQuote } from "@/lib/affiliates";

type Companion = { fullName: string; documentId: string; phone: string };

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
  const occupied = useMemo(
    () =>
      bookedRanges
        .map(parsePostgresDateRange)
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    [bookedRanges],
  );

  const [range, setRange] = useState<DateRange>();
  const [guests, setGuests] = useState(1);
  const [months, setMonths] = useState(2);
  const [quote, setQuote] = useState<AffiliateQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [state, formAction, pending] = useActionState(createAffiliateRequestAction, initialState);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setMonths(media.matches ? 1 : 2);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // El WhatsApp se abre desde el cliente porque la URL solo existe tras registrar
  // la solicitud en el servidor con el total ya calculado.
  useEffect(() => {
    if (state.ok && state.whatsappUrl) window.open(state.whatsappUrl, "_blank", "noopener");
  }, [state]);

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
        const response = await fetch("/api/afiliados/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ propertyId, checkIn, checkOut, guestCount: guests }),
          signal: controller.signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message ?? "No se pudo calcular la tarifa");
        setQuote(body as AffiliateQuote);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setQuote(null);
        setError(
          requestError instanceof Error ? requestError.message : "No se pudo calcular la tarifa",
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

  function updateCompanion(index: number, patch: Partial<Companion>) {
    setCompanions((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

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

      <form action={formAction} className="mt-5 grid gap-4">
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="checkIn" value={checkIn} />
        <input type="hidden" name="checkOut" value={checkOut} />
        <input type="hidden" name="guestCount" value={guests} />
        <input type="hidden" name="companions" value={JSON.stringify(companions)} />

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

        <div className="grid gap-3 border-t border-night/10 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Acompañantes</p>
            <button
              type="button"
              disabled={companions.length >= companionsAllowed}
              onClick={() =>
                setCompanions((current) => [
                  ...current,
                  { fullName: "", documentId: "", phone: "" },
                ])
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-night/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
          {companionsAllowed === 0 ? (
            <p className="text-xs text-night/55">
              Aumentá la cantidad de huéspedes para cargar acompañantes.
            </p>
          ) : null}
          {companions.map((companion, index) => (
            <div key={index} className="grid gap-2 rounded-2xl border border-night/10 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-night/55">
                  Acompañante {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setCompanions((c) => c.filter((_, i) => i !== index))}
                  className="text-night/45 hover:text-rose-700"
                  aria-label={`Eliminar acompañante ${index + 1}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <input
                required
                placeholder="Nombre completo"
                value={companion.fullName}
                onChange={(e) => updateCompanion(index, { fullName: e.target.value })}
                className="w-full rounded-xl border border-night/15 p-2.5 text-sm"
              />
              <input
                required
                placeholder="Carnet de identidad"
                value={companion.documentId}
                onChange={(e) => updateCompanion(index, { documentId: e.target.value })}
                className="w-full rounded-xl border border-night/15 p-2.5 text-sm"
              />
              <input
                placeholder="Teléfono opcional"
                value={companion.phone}
                onChange={(e) => updateCompanion(index, { phone: e.target.value })}
                className="w-full rounded-xl border border-night/15 p-2.5 text-sm"
              />
            </div>
          ))}
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
          {pending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <MessageCircle size={18} />
          )}{" "}
          {pending ? "Registrando solicitud…" : "Continuar reserva por WhatsApp"}
        </button>
        <p className="text-center text-xs text-night/50">
          Al enviar, las fechas de {propertyName} quedan bloqueadas hasta que confirmemos la
          reserva por WhatsApp.
        </p>
      </form>
    </aside>
  );
}
