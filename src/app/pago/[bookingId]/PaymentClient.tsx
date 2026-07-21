"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, QrCode, XCircle } from "lucide-react";

type Booking = {
  id: string;
  bookingCode: string;
  status: string;
  currency: string;
  totalMinor: number;
  nights: number;
  guests: number;
  checkIn: string;
  checkOut: string;
  guestName: string;
};

type Payment = {
  id: string;
  status: string;
  amountMinor: number;
  currency: string;
  qrImageBase64: string | null;
  qrMimeType: string | null;
  expiresAt: string;
  bookingStatus: string;
  bookingPaymentStatus: string;
};

const POLL_INTERVAL_MS = 12_000;

function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1.5 text-night/70">
      <Clock className="h-4 w-4" aria-hidden />
      {mm}:{ss}
    </span>
  );
}

export default function PaymentClient({ bookingId }: { bookingId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : "";

  // Lee el token de la URL y carga la reserva una sola vez al montar.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    const query = t ? `?token=${encodeURIComponent(t)}` : "";
    (async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}${query}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? "No se pudo cargar la reserva");
        }
        const body = await res.json();
        setBooking(body.booking);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar la reserva");
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId]);

  const createPayment = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payments${tokenQuery}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "mock", method: "qr" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? "No se pudo crear el pago");
      setPayment(body.payment);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el pago");
    } finally {
      setCreating(false);
    }
  }, [bookingId, tokenQuery]);

  const refreshStatus = useCallback(async () => {
    if (!payment) return;
    try {
      const res = await fetch(`/api/payments/${payment.id}/status${tokenQuery}`);
      if (!res.ok) return;
      const body = await res.json();
      setPayment((prev) => (prev ? { ...prev, ...body.payment } : body.payment));
    } catch {
      // Silencioso: el polling reintenta.
    }
  }, [payment, tokenQuery]);

  const verifyPayment = useCallback(async () => {
    if (!payment) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${payment.id}/verify${tokenQuery}`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? "No se pudo verificar el pago");
      setPayment((prev) => (prev ? { ...prev, ...body.payment } : body.payment));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al verificar el pago");
    } finally {
      setVerifying(false);
    }
  }, [payment, tokenQuery]);

  // Polling mientras el pago está pendiente.
  useEffect(() => {
    if (!payment || payment.status !== "pending") return;
    const id = setInterval(() => void refreshStatus(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [payment, refreshStatus]);

  const isPaid =
    payment?.status === "paid" ||
    booking?.status === "confirmed" ||
    payment?.bookingStatus === "confirmed";
  const isExpired = payment?.status === "expired" || booking?.status === "expired";
  const isErrored = payment?.status === "error" || payment?.status === "manual_review";

  return (
    <main className="min-h-screen bg-deep px-5 py-16">
      <div className="mx-auto w-full max-w-lg">
        <p className="eyebrow text-turquoise-soft">RentaMar</p>
        <h1 className="mt-2 text-3xl font-semibold text-cream">Pago de tu reserva</h1>

        <div className="surface mt-8 rounded-[26px] p-6 text-night">
          {loading ? (
            <div className="flex items-center gap-3 text-night/70">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Cargando reserva…
            </div>
          ) : error && !booking ? (
            <div className="flex items-start gap-3 text-red-600">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p>{error}</p>
            </div>
          ) : booking ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-night/60">Reserva</span>
                <span className="font-mono text-sm">{booking.bookingCode}</span>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-night/60">Huésped</dt>
                  <dd>{booking.guestName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-night/60">Estadía</dt>
                  <dd>
                    {booking.checkIn} → {booking.checkOut} ({booking.nights} noches)
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-night/60">Huéspedes</dt>
                  <dd>{booking.guests}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-baseline justify-between border-t border-night/10 pt-4">
                <span className="text-night/60">Total</span>
                <span className="text-2xl font-semibold">
                  {formatMoney(booking.totalMinor, booking.currency)}
                </span>
              </div>

              <div className="mt-6">
                {isPaid ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-turquoise/10 p-4 text-turquoise">
                    <CheckCircle2 className="h-6 w-6" aria-hidden />
                    <div>
                      <p className="font-semibold">Pago confirmado</p>
                      <p className="text-sm text-night/70">Tu reserva quedó confirmada.</p>
                    </div>
                  </div>
                ) : isExpired ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-red-600">
                    <XCircle className="h-6 w-6" aria-hidden />
                    <div>
                      <p className="font-semibold">Pago expirado</p>
                      <p className="text-sm text-night/70">
                        El tiempo se agotó y las fechas se liberaron.
                      </p>
                    </div>
                  </div>
                ) : isErrored ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-700">
                    <XCircle className="h-6 w-6" aria-hidden />
                    <div>
                      <p className="font-semibold">Pago en revisión</p>
                      <p className="text-sm text-night/70">
                        Hubo un problema; nuestro equipo lo revisará.
                      </p>
                    </div>
                  </div>
                ) : payment && payment.qrImageBase64 ? (
                  <div className="text-center">
                    <p className="text-sm text-night/70">Escaneá el QR para pagar</p>
                    {/* eslint-disable-next-line @next/next/no-img-element -- QR es un data-URI base64, no optimizable por next/image */}
                    <img
                      src={`data:${payment.qrMimeType ?? "image/png"};base64,${payment.qrImageBase64}`}
                      alt="Código QR de pago"
                      width={240}
                      height={240}
                      className="mx-auto mt-3 rounded-2xl border border-night/10"
                    />
                    <div className="mt-3 text-sm">
                      Vence en <Countdown expiresAt={payment.expiresAt} />
                    </div>
                    <button
                      onClick={() => void verifyPayment()}
                      disabled={verifying}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3.5 font-semibold text-white transition hover:bg-turquoise-soft disabled:opacity-60"
                    >
                      {verifying ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      ) : (
                        <QrCode className="h-5 w-5" aria-hidden />
                      )}
                      Verificar pago
                    </button>
                    {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => void createPayment()}
                      disabled={creating}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3.5 font-semibold text-white transition hover:bg-turquoise-soft disabled:opacity-60"
                    >
                      {creating ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      ) : (
                        <QrCode className="h-5 w-5" aria-hidden />
                      )}
                      Pagar con QR
                    </button>
                    {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
