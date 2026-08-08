"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, Upload, XCircle } from "lucide-react";
import { DeclarationButton } from "@/components/declaration-button";

export type BankInfo = {
  holder: string;
  account: string;
  bank: string;
  qrImagePath: string;
};

type Booking = {
  id: string;
  bookingCode: string;
  status: string;
  propertyName: string;
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  subtotalMinor: number;
  cleaningFeeMinor: number;
  serviceFeeMinor: number;
  discountMinor: number;
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
  expiresAt: string;
  bookingStatus: string;
  bookingPaymentStatus: string;
};

type UploadOutcome = "approved" | "retry" | "review";

const POLL_INTERVAL_MS = 12_000;
const ACCEPT = "image/jpeg,image/png,application/pdf";

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

export default function PaymentClient({ bookingId, bank }: { bookingId: string; bank: BankInfo }) {
  const [token, setToken] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    outcome: UploadOutcome;
    attemptsLeft: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
        body: JSON.stringify({ provider: "transfer", method: "qr" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? "No se pudo iniciar el pago");
      setPayment(body.payment);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al iniciar el pago");
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

  const uploadReceipt = useCallback(async () => {
    if (!payment) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Adjuntá el comprobante (JPG, PNG o PDF).");
      return;
    }
    setUploading(true);
    setError(null);
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append("receipt", file);
      const res = await fetch(`/api/payments/${payment.id}/receipt${tokenQuery}`, {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? "No se pudo procesar el comprobante");
      setUploadResult({ outcome: body.outcome, attemptsLeft: body.attemptsLeft ?? 0 });
      if (fileRef.current) fileRef.current.value = "";
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir el comprobante");
    } finally {
      setUploading(false);
    }
  }, [payment, tokenQuery, refreshStatus]);

  // Polling mientras el pago sigue pendiente (por si un admin lo confirma).
  useEffect(() => {
    if (!payment) return;
    if (payment.status !== "pending" && payment.status !== "created") return;
    const id = setInterval(() => void refreshStatus(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [payment, refreshStatus]);

  const isPaid =
    payment?.status === "paid" ||
    booking?.status === "confirmed" ||
    payment?.bookingStatus === "confirmed";
  const isApproved = payment?.status === "ai_approved";
  const isExpired = payment?.status === "expired" || booking?.status === "expired";
  const isReview = payment?.status === "manual_review";
  const isActive = payment && (payment.status === "created" || payment.status === "pending");

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
                  <dt className="text-night/60">Propiedad</dt>
                  <dd>{booking.propertyName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-night/60">Huésped</dt>
                  <dd>{booking.guestName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-night/60">Estadía</dt>
                  <dd>
                    {booking.checkIn} {booking.checkInTime} → {booking.checkOut}{" "}
                    {booking.checkOutTime} ({booking.nights} noches)
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-night/60">Huéspedes</dt>
                  <dd>{booking.guests}</dd>
                </div>
                <div className="flex justify-between border-t border-night/10 pt-2">
                  <dt className="text-night/60">Precio base</dt>
                  <dd>{formatMoney(booking.subtotalMinor, booking.currency)}</dd>
                </div>
                {booking.discountMinor > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Descuento</dt>
                    <dd>-{formatMoney(booking.discountMinor, booking.currency)}</dd>
                  </div>
                ) : null}
                {booking.cleaningFeeMinor > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-night/60">Limpieza</dt>
                    <dd>{formatMoney(booking.cleaningFeeMinor, booking.currency)}</dd>
                  </div>
                ) : null}
                {booking.serviceFeeMinor > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-night/60">Servicio</dt>
                    <dd>{formatMoney(booking.serviceFeeMinor, booking.currency)}</dd>
                  </div>
                ) : null}
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
                ) : isApproved ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-700">
                    <CheckCircle2 className="h-6 w-6" aria-hidden />
                    <div>
                      <p className="font-semibold">Comprobante aprobado</p>
                      <p className="text-sm text-night/70">
                        Estamos confirmando tu reserva. Te avisaremos cuando quede lista.
                      </p>
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
                ) : isReview ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-700">
                    <XCircle className="h-6 w-6" aria-hidden />
                    <div>
                      <p className="font-semibold">Comprobante en revisión</p>
                      <p className="text-sm text-night/70">
                        Nuestro equipo lo revisará y te contactará.
                      </p>
                    </div>
                  </div>
                ) : isActive ? (
                  <div>
                    <p className="text-sm font-semibold">Transferí el total y subí el comprobante</p>
                    <dl className="mt-3 space-y-1.5 rounded-2xl bg-night/5 p-4 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-night/60">Titular</dt>
                        <dd className="font-medium">{bank.holder || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-night/60">Cuenta</dt>
                        <dd className="font-mono">{bank.account || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-night/60">Banco</dt>
                        <dd className="font-medium">{bank.bank || "—"}</dd>
                      </div>
                      <div className="flex justify-between border-t border-night/10 pt-1.5">
                        <dt className="text-night/60">Monto</dt>
                        <dd className="font-semibold">
                          {formatMoney(payment!.amountMinor, payment!.currency)}
                        </dd>
                      </div>
                    </dl>
                    {bank.qrImagePath ? (
                      <div className="mt-3 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element -- QR estático servido desde public/ */}
                        <img
                          src={bank.qrImagePath}
                          alt="Código QR para transferir"
                          width={200}
                          height={200}
                          className="mx-auto rounded-2xl border border-night/10"
                        />
                      </div>
                    ) : null}
                    <div className="mt-3 text-sm">
                      Tenés tiempo hasta <Countdown expiresAt={payment!.expiresAt} />
                    </div>

                    <div className="mt-4">
                      <input
                        ref={fileRef}
                        type="file"
                        accept={ACCEPT}
                        className="block w-full text-sm text-night/70 file:mr-3 file:rounded-full file:border-0 file:bg-turquoise/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-turquoise"
                      />
                      <button
                        onClick={() => void uploadReceipt()}
                        disabled={uploading}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3.5 font-semibold text-white transition hover:bg-turquoise-soft disabled:opacity-60"
                      >
                        {uploading ? (
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        ) : (
                          <Upload className="h-5 w-5" aria-hidden />
                        )}
                        {uploading ? "Verificando comprobante…" : "Subir comprobante"}
                      </button>
                    </div>

                    {uploadResult?.outcome === "retry" ? (
                      <p className="mt-3 text-sm text-amber-700">
                        No pudimos confirmar el pago con ese comprobante. Volvé a
                        intentar
                        {uploadResult.attemptsLeft > 0
                          ? ` (${uploadResult.attemptsLeft} intento${
                              uploadResult.attemptsLeft === 1 ? "" : "s"
                            } restante${uploadResult.attemptsLeft === 1 ? "" : "s"}).`
                          : "."}
                      </p>
                    ) : null}
                    {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
                    <p className="mt-3 text-xs text-night/50">
                      Aceptamos JPG, PNG o PDF (hasta 10 MB).
                    </p>
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
                      ) : null}
                      Continuar al pago
                    </button>
                    {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
                  </>
                )}
              </div>

              <div className="mt-6">
                <DeclarationButton target={{ kind: "booking", bookingId, token }} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
