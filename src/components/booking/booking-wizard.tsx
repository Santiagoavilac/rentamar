"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, ShieldCheck } from "lucide-react";
import type { Quote } from "@/lib/bookings";
import { formatCurrency } from "@/lib/money";
import { useStayRange } from "./use-stay-range";
import { useQuote } from "./use-quote";
import { BookingCalendar, StayDatesSummary } from "./booking-calendar";
import { QuoteLoading, QuoteSummary } from "./quote-summary";
import { CompanionsFields, type Companion } from "./companions-fields";

// Chequeo liviano, solo para habilitar "Continuar": alcanza con nombre@dominio.algo. La
// validación real (que también permite tildes, longitud, etc.) es la del servidor.
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Reservar paso a paso. Antes el calendario estaba incrustado en la ficha del departamento
// y al tocar una fecha se desplegaban campos ahí mismo: el huésped se topaba de golpe con
// todo y no entendía cómo terminar.
//
// La reserva se crea UNA sola vez, en el último paso. Mientras la persona tipea, las fechas
// siguen libres: el hold dura 30 minutos y no tiene sentido gastarlo en el paso 2.

const STEPS = ["Fechas", "Tus datos", "Acompañantes", "Confirmar"] as const;
type Step = 0 | 1 | 2 | 3;

type Guest = {
  name: string;
  email: string;
  phone: string;
  documentId: string;
  nationality: string;
  city: string;
};

const field = "mt-1 w-full rounded-xl border border-night/15 p-3 font-normal";

export function BookingWizard({
  propertyId,
  propertySlug,
  propertyName,
  maxGuests,
  minimumNights,
  basePriceMinor,
  currency,
  checkInTime,
  checkOutTime,
  bookedRanges,
}: {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  maxGuests: number;
  minimumNights: number;
  basePriceMinor: number;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  bookedRanges: string[];
}) {
  const stay = useStayRange(bookedRanges, minimumNights);
  const [step, setStep] = useState<Step>(0);
  const [guests, setGuests] = useState(1);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [hasCompanions, setHasCompanions] = useState<boolean | null>(null);
  const [guest, setGuest] = useState<Guest>({
    name: "",
    email: "",
    phone: "",
    documentId: "",
    nationality: "Boliviana",
    city: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { checkIn, checkOut } = stay;
  const { quote, quoting, quoteError } = useQuote<Quote>({
    endpoint: "/api/bookings/quote",
    propertyId,
    checkIn,
    checkOut,
    guestCount: guests,
    enabled: stay.isComplete,
  });

  const companionsAllowed = Math.max(0, guests - 1);
  const error = stay.rangeError ?? quoteError ?? submitError;

  function goTo(next: Step) {
    setSubmitError(null);
    setStep(next);
    // Cambiar de paso mueve la vista a la parte superior: en el celular, si no, el paso
    // nuevo arranca a mitad de pantalla.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!quote || !checkIn || !checkOut) {
      setSubmitError("Volvé al primer paso y elegí las fechas.");
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
          companions: hasCompanions ? companions : [],
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

  // El paso de datos usa un <form> para que el navegador valide required/minLength antes de
  // dejar avanzar, en vez de reimplementar esas reglas a mano.
  const holderComplete =
    guest.name.trim().length >= 2 &&
    isValidEmail(guest.email) &&
    guest.documentId.trim().length >= 4 &&
    guest.nationality.trim().length >= 3 &&
    guest.city.trim().length >= 2;

  const companionsComplete =
    hasCompanions === false ||
    (hasCompanions === true &&
      companions.length > 0 &&
      companions.every(
        (companion) =>
          companion.fullName.trim().length >= 2 && companion.documentId.trim().length >= 4,
      ));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/propiedades/${propertySlug}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700"
      >
        <ArrowLeft size={16} /> Volver a {propertyName}
      </Link>

      <ol className="mt-6 flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              index === step
                ? "bg-deep text-cream"
                : index < step
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-white text-night/50"
            }`}
          >
            {index < step ? <Check size={13} /> : <span>{index + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-3xl bg-white p-5 shadow-[0_24px_70px_-32px_rgba(0,0,0,.35)] sm:p-7">
        {step === 0 ? (
          <section>
            <h2 className="text-2xl font-bold">¿Qué días te quedás?</h2>
            <p className="mt-2 text-sm text-night/65">
              Elegí la fecha de entrada y la de salida. Abajo te mostramos el precio final, sin
              sorpresas.
            </p>
            <div className="mt-5">
              <BookingCalendar stay={stay} minimumNights={minimumNights} />
            </div>
            <div className="mt-5 grid gap-4">
              <StayDatesSummary
                checkIn={checkIn}
                checkOut={checkOut}
                checkInTime={checkInTime}
                checkOutTime={checkOutTime}
              />
              <label className="text-sm font-semibold">
                ¿Cuántas personas son?
                <select
                  value={guests}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setGuests(next);
                    // Bajar la cantidad no puede dejar más acompañantes que huéspedes.
                    setCompanions((current) => current.slice(0, Math.max(0, next - 1)));
                  }}
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
              {quote ? (
                <>
                  <QuoteSummary quote={quote} />
                  <p className="text-xs text-night/55">
                    Incluye el alojamiento por {quote.nights}{" "}
                    {quote.nights === 1 ? "noche" : "noches"}
                    {quote.cleaningFeeMinor > 0 ? " y la limpieza final" : ""}. Entrada desde las{" "}
                    {checkInTime}, salida hasta las {checkOutTime}.
                  </p>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section>
            <h2 className="text-2xl font-bold">¿Quién reserva?</h2>
            <p className="mt-2 text-sm text-night/65">
              Son los datos del titular. Se usan para la Declaración Jurada de Responsabilidad que
              exige la urbanización.
            </p>
            <div className="mt-5 grid gap-3">
              <label className="text-sm font-semibold">
                Nombre completo
                <input
                  required
                  minLength={2}
                  value={guest.name}
                  onChange={(e) => setGuest((c) => ({ ...c, name: e.target.value }))}
                  className={field}
                />
              </label>
              <label className="text-sm font-semibold">
                Email
                <input
                  required
                  type="email"
                  value={guest.email}
                  onChange={(e) => setGuest((c) => ({ ...c, email: e.target.value }))}
                  className={field}
                />
              </label>
              <label className="text-sm font-semibold">
                Teléfono opcional
                <input
                  value={guest.phone}
                  onChange={(e) => setGuest((c) => ({ ...c, phone: e.target.value }))}
                  className={field}
                />
              </label>
              <label className="text-sm font-semibold">
                Cédula de identidad
                <input
                  required
                  minLength={4}
                  value={guest.documentId}
                  onChange={(e) => setGuest((c) => ({ ...c, documentId: e.target.value }))}
                  className={field}
                />
              </label>
              <label className="text-sm font-semibold">
                Nacionalidad
                <input
                  required
                  minLength={3}
                  value={guest.nationality}
                  onChange={(e) => setGuest((c) => ({ ...c, nationality: e.target.value }))}
                  className={field}
                />
              </label>
              <label className="text-sm font-semibold">
                Ciudad de residencia
                <input
                  required
                  minLength={2}
                  value={guest.city}
                  onChange={(e) => setGuest((c) => ({ ...c, city: e.target.value }))}
                  className={field}
                />
              </label>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <h2 className="text-2xl font-bold">¿Viajás con alguien más?</h2>
            <p className="mt-2 text-sm text-night/65">
              Recepción necesita el nombre y el carnet de cada persona que entra al complejo.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setHasCompanions(false);
                  setCompanions([]);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  hasCompanions === false ? "bg-deep text-cream" : "bg-cream text-night/70"
                }`}
              >
                Voy solo
              </button>
              <button
                type="button"
                disabled={companionsAllowed === 0}
                onClick={() => {
                  setHasCompanions(true);
                  if (companions.length === 0) {
                    setCompanions([{ fullName: "", documentId: "", phone: "" }]);
                  }
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 ${
                  hasCompanions === true ? "bg-deep text-cream" : "bg-cream text-night/70"
                }`}
              >
                Voy acompañado
              </button>
            </div>

            {companionsAllowed === 0 ? (
              <p className="mt-3 text-xs text-night/55">
                Reservaste para una sola persona. Volvé al primer paso si sos más.
              </p>
            ) : null}

            {hasCompanions ? (
              <div className="mt-5">
                <CompanionsFields
                  companions={companions}
                  onChange={setCompanions}
                  allowed={companionsAllowed}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 3 ? (
          <section>
            <h2 className="text-2xl font-bold">¿Está todo listo?</h2>
            <p className="mt-2 text-sm text-night/65">
              Revisá los datos. Al confirmar bloqueamos las fechas 30 minutos para que puedas pagar.
            </p>

            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-night/10 p-4">
                <p className="text-sm font-bold">{propertyName}</p>
                <p className="mt-1 text-sm text-night/65">
                  Del {checkIn} al {checkOut} · {guests} {guests === 1 ? "huésped" : "huéspedes"}
                </p>
              </div>

              <div className="rounded-2xl border border-night/10 p-4 text-sm">
                <p className="font-bold">Titular</p>
                <p className="mt-1 text-night/70">
                  {guest.name} · CI {guest.documentId}
                </p>
                <p className="text-night/70">{guest.email}</p>
                {guest.phone ? <p className="text-night/70">{guest.phone}</p> : null}
              </div>

              <div className="rounded-2xl border border-night/10 p-4 text-sm">
                <p className="font-bold">Acompañantes</p>
                {companions.length ? (
                  <ul className="mt-1 grid gap-1 text-night/70">
                    {companions.map((companion, index) => (
                      <li key={index}>
                        {companion.fullName} · CI {companion.documentId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-night/70">Viajás solo.</p>
                )}
              </div>

              {quote ? <QuoteSummary quote={quote} /> : null}
            </div>
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="mt-5 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-night/10 pt-5">
          <button
            type="button"
            onClick={() => goTo((step - 1) as Step)}
            disabled={step === 0}
            className="rounded-2xl border border-night/15 px-5 py-3 text-sm font-semibold disabled:opacity-40"
          >
            Atrás
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => goTo((step + 1) as Step)}
              disabled={
                (step === 0 && !quote) ||
                (step === 1 && !holderComplete) ||
                (step === 2 && !companionsComplete)
              }
              className="rounded-2xl bg-turquoise px-6 py-3 font-bold text-deep transition hover:bg-turquoise-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!quote || submitting}
              className="flex items-center gap-2 rounded-2xl bg-turquoise px-6 py-3 font-bold text-deep transition hover:bg-turquoise-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ShieldCheck size={18} />
              )}
              {submitting
                ? "Creando reserva…"
                : `Reservar por ${formatCurrency(quote?.totalMinor ?? 0, currency)}`}
            </button>
          )}
        </div>

        {step === 0 && !quote ? (
          <p className="mt-3 text-right text-xs text-night/55">
            Elegí las fechas para continuar. Desde {formatCurrency(basePriceMinor, currency)} por
            noche.
          </p>
        ) : null}
      </div>
    </div>
  );
}
