import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import { hashToken } from "./bookings";
import {
  AppError,
  PaymentConfirmationFailedError,
  PaymentNotFoundError,
  PaymentProviderUnavailableError,
  UnauthorizedBookingAccessError,
  mapPostgresError,
} from "./errors";
import { getPaymentProvider } from "./payments/factory";
import type { CreatePaymentInput } from "./validation";

// Vigencia del intento de pago (independiente del hold de la reserva).
const PAYMENT_TTL_MINUTES = 20;
// Intervalo mínimo entre consultas reales al proveedor por pago (anti-abuso).
const PROVIDER_CHECK_MIN_INTERVAL_MS = 8_000;

function tokenMatches(token: string, hash: string | null): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Las selecciones son explícitas y NUNCA incluyen create_response_raw,
// last_status_response_raw ni idempotency_key: son server-only y no salen por la API.
export type PaymentView = {
  id: string;
  bookingId: string;
  provider: string;
  method: string;
  status: string;
  amountMinor: number;
  currency: string;
  qrCode: string | null;
  qrImageBase64: string | null;
  qrMimeType: string | null;
  expiresAt: string;
  paidAt: string | null;
  bookingStatus: string;
  bookingPaymentStatus: string;
};

type PaymentAccessRow = {
  id: string;
  booking_id: string;
  provider: string;
  provider_mode: string | null;
  method: string;
  status: string;
  amount_minor: number;
  currency: string;
  external_id: string | null;
  external_qr_code: string | null;
  qr_image_base64: string | null;
  qr_mime_type: string | null;
  expires_at: string;
  paid_at: string | null;
  last_provider_check_at: string | null;
  created_at: string;
};

type BookingAccessRow = {
  status: string;
  payment_status: string;
  guest_id: string | null;
  access_token_hash: string | null;
};

type AccessResult = {
  payment: PaymentAccessRow;
  booking: BookingAccessRow;
};

// Carga el pago + su reserva y exige sesión del dueño o token de reserva válido.
async function assertPaymentAccess(params: {
  paymentId: string;
  token?: string;
  userId?: string;
}): Promise<AccessResult> {
  const supabase = createAdminClient();

  const { data: payment, error } = await supabase
    .from("payments")
    .select(
      "id, booking_id, provider, provider_mode, method, status, amount_minor, currency, external_id, external_qr_code, qr_image_base64, qr_mime_type, expires_at, paid_at, last_provider_check_at, created_at",
    )
    .eq("id", params.paymentId)
    .maybeSingle();

  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!payment) throw new PaymentNotFoundError();

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("status, payment_status, guest_id, access_token_hash")
    .eq("id", payment.booking_id)
    .maybeSingle();

  if (bErr) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!booking) throw new UnauthorizedBookingAccessError();

  const isOwner = Boolean(params.userId) && booking.guest_id === params.userId;
  const hasToken =
    Boolean(params.token) && tokenMatches(params.token as string, booking.access_token_hash);
  if (!isOwner && !hasToken) throw new UnauthorizedBookingAccessError();

  return { payment: payment as PaymentAccessRow, booking: booking as BookingAccessRow };
}

function toView(payment: PaymentAccessRow, booking: BookingAccessRow): PaymentView {
  return {
    id: payment.id,
    bookingId: payment.booking_id,
    provider: payment.provider,
    method: payment.method,
    status: payment.status,
    amountMinor: payment.amount_minor,
    currency: payment.currency,
    qrCode: payment.external_qr_code,
    qrImageBase64: payment.qr_image_base64,
    qrMimeType: payment.qr_mime_type,
    expiresAt: payment.expires_at,
    paidAt: payment.paid_at,
    bookingStatus: booking.status,
    bookingPaymentStatus: booking.payment_status,
  };
}

// Crea (o reutiliza) el pago activo de una reserva. Idempotente ante doble clic /
// retries: el RPC devuelve el pago existente y no se llama de nuevo al proveedor.
export async function createPaymentForBooking(params: {
  bookingId: string;
  token?: string;
  userId?: string;
  input: CreatePaymentInput;
}): Promise<PaymentView> {
  const supabase = createAdminClient();

  // Validación de acceso a la reserva (dueño o token) antes de crear nada.
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("guest_id, access_token_hash")
    .eq("id", params.bookingId)
    .maybeSingle();
  if (bErr) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!booking) throw new UnauthorizedBookingAccessError();

  const isOwner = Boolean(params.userId) && booking.guest_id === params.userId;
  const hasToken =
    Boolean(params.token) && tokenMatches(params.token as string, booking.access_token_hash);
  if (!isOwner && !hasToken) throw new UnauthorizedBookingAccessError();

  const provider = getPaymentProvider();
  const expiresAt = new Date(Date.now() + PAYMENT_TTL_MINUTES * 60_000).toISOString();

  const { data: intent, error: intentErr } = await supabase.rpc("create_payment_intent", {
    p_booking_id: params.bookingId,
    p_provider: params.input.provider,
    p_provider_mode: provider.mode,
    p_method: params.input.method,
    p_idempotency_key: randomBytes(24).toString("base64url"),
    p_expires_at: expiresAt,
  });
  if (intentErr) throw mapPostgresError(intentErr.message);

  const { isNew, paymentId } = intent as unknown as { isNew: boolean; paymentId: string };

  // Solo si el intento es nuevo llamamos al proveedor y adjuntamos su QR. Ante
  // reutilización (doble clic / segunda pestaña) no se genera un segundo QR.
  if (isNew) {
    let created;
    try {
      created = await provider.createPayment({
        paymentId,
        bookingId: params.bookingId,
        amountMinor: 0, // el monto autoritativo lo fija el RPC desde la reserva.
        currency: "BOB",
        expiresAt,
      });
    } catch {
      throw new PaymentProviderUnavailableError();
    }

    const { error: attachErr } = await supabase.rpc("attach_payment_provider_data", {
      p_payment_id: paymentId,
      p_external_id: created.externalId,
      p_qr_image_base64: created.qrImageBase64,
      p_qr_mime_type: created.qrMimeType,
      p_qr_code: created.qrCode,
      p_provider_status_code: created.providerStatusCode,
      p_raw: created.rawResponse as never,
    });
    if (attachErr) throw mapPostgresError(attachErr.message);
  }

  const access = await assertPaymentAccess({
    paymentId,
    token: params.token,
    userId: params.userId,
  });
  return toView(access.payment, access.booking);
}

// Verifica contra el proveedor y confirma la reserva si el pago está pagado.
// Corta temprano si ya está pagado/expirado y throttlea las consultas reales.
export async function verifyPayment(params: {
  paymentId: string;
  token?: string;
  userId?: string;
}): Promise<PaymentView> {
  const supabase = createAdminClient();
  const { payment } = await assertPaymentAccess(params);

  // Estados terminales: no se consulta al proveedor.
  if (payment.status === "paid" || payment.status === "expired" || payment.status === "error") {
    const access = await assertPaymentAccess(params);
    return toView(access.payment, access.booking);
  }

  // Throttle de consultas reales al proveedor por pago.
  const lastCheck = payment.last_provider_check_at
    ? new Date(payment.last_provider_check_at).getTime()
    : 0;
  const throttled = Date.now() - lastCheck < PROVIDER_CHECK_MIN_INTERVAL_MS;

  if (!throttled && payment.external_id) {
    const provider = getPaymentProvider();
    let status;
    try {
      status = await provider.getPaymentStatus(payment.external_id);
    } catch {
      throw new PaymentProviderUnavailableError();
    }

    await supabase
      .from("payments")
      .update({ last_provider_check_at: new Date().toISOString() })
      .eq("id", payment.id);

    if (status.status === "paid") {
      const { data: result, error: confirmErr } = await supabase.rpc("confirm_booking_payment", {
        p_payment_id: payment.id,
      });
      if (confirmErr) throw mapPostgresError(confirmErr.message);
      const confirmed = result as unknown as { ok: boolean };
      if (!confirmed.ok) {
        // amount mismatch u otra inconsistencia: el RPC ya persistió manual_review.
        const access = await assertPaymentAccess(params);
        return toView(access.payment, access.booking);
      }
    } else if (status.status === "expired") {
      const { error: expErr } = await supabase.rpc("expire_payment", { p_payment_id: payment.id });
      if (expErr) throw mapPostgresError(expErr.message);
    } else if (status.status === "error") {
      const { error: recErr } = await supabase.rpc("record_payment_error", {
        p_payment_id: payment.id,
        p_provider_status_code: status.providerStatusCode,
        p_raw: status.rawResponse as never,
      });
      if (recErr) throw mapPostgresError(recErr.message);
    }
  }

  const access = await assertPaymentAccess(params);
  return toView(access.payment, access.booking);
}

// Estado interno para polling: nunca llama al proveedor.
export async function getInternalPaymentStatus(params: {
  paymentId: string;
  token?: string;
  userId?: string;
}): Promise<PaymentView> {
  const access = await assertPaymentAccess(params);
  return toView(access.payment, access.booking);
}

// Wrapper del barrido de pagos vencidos para el endpoint dev / cron futuro.
export async function expireStalePayments(): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("expire_stale_payments");
  if (error) throw error;
  return data ?? 0;
}

// Simula un cambio de estado en el "banco" mock (solo dev). No confirma la reserva.
export async function simulateMockPayment(
  paymentId: string,
  status: "paid" | "expired" | "error",
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .select("external_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!payment || !payment.external_id) throw new PaymentNotFoundError();

  const { getMockProvider } = await import("./payments/factory");
  const updated = await getMockProvider().simulate(payment.external_id, status);
  if (!updated) throw new PaymentConfirmationFailedError();
  return updated;
}
