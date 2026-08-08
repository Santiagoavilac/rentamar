import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "../supabase/admin";
import {
  AppError,
  PaymentNotFoundError,
  PaymentAlreadyPaidError,
  PaymentInvalidStateError,
  UnauthorizedBookingAccessError,
  ValidationError,
  mapPostgresError,
} from "../errors";
import { hashToken } from "../bookings";
import { timingSafeEqual } from "node:crypto";
import { getReceiptConfirmMode } from "../settings";
import { verifyReceipt, type ExpectedReceipt, type ReceiptScore } from "./verifier";

const BUCKET = "payment-receipts";
const MAX_BYTES = 10 * 1024 * 1024;

// El navegador nunca es fuente de verdad para el tipo real: se valida contra esta tabla.
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

function maxAttempts(): number {
  const raw = Number(process.env.RECEIPT_MAX_ATTEMPTS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3;
}

// Datos bancarios globales que ve el cliente para transferir. No son secretos.
export function getBankDisplayInfo() {
  return {
    holder: process.env.RECEIPT_BANK_HOLDER || "",
    account: process.env.RECEIPT_BANK_ACCOUNT || "",
    bank: process.env.RECEIPT_BANK_NAME || "",
    qrImagePath: process.env.RECEIPT_BANK_QR_PATH || "",
  };
}

function tokenMatches(token: string, hash: string | null): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Resultado de UX devuelto al cliente. NUNCA expone IA, modelo, prompt ni errores técnicos.
export type ReceiptSubmitResult = {
  // approved: aprobado (Modo A confirma; Modo B queda a la espera del admin).
  // retry: no se pudo confirmar, puede reintentar.
  // review: quedó en revisión administrativa (fuera de plazo / error / dedupe).
  outcome: "approved" | "retry" | "review";
  attemptsLeft: number;
};

type PaymentRow = {
  id: string;
  booking_id: string;
  status: string;
  amount_minor: number;
  currency: string;
  created_at: string;
};

type BookingRow = {
  status: string;
  guest_id: string | null;
  access_token_hash: string | null;
  hold_expires_at: string | null;
};

async function loadAndAuthorize(params: {
  paymentId: string;
  token?: string;
  userId?: string;
}): Promise<{ payment: PaymentRow; booking: BookingRow }> {
  const supabase = createAdminClient();

  const { data: payment, error } = await supabase
    .from("payments")
    .select("id, booking_id, status, amount_minor, currency, created_at")
    .eq("id", params.paymentId)
    .maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!payment) throw new PaymentNotFoundError();

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("status, guest_id, access_token_hash, hold_expires_at")
    .eq("id", payment.booking_id)
    .maybeSingle();
  if (bErr) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!booking) throw new UnauthorizedBookingAccessError();

  const isOwner = Boolean(params.userId) && booking.guest_id === params.userId;
  const hasToken =
    Boolean(params.token) && tokenMatches(params.token as string, booking.access_token_hash);
  if (!isOwner && !hasToken) throw new UnauthorizedBookingAccessError();

  return { payment: payment as PaymentRow, booking: booking as BookingRow };
}

function outcomeFor(score: ReceiptScore, attemptsLeft: number): ReceiptSubmitResult["outcome"] {
  if (score === 2) return "approved";
  if (score === 1) return "retry";
  return "review"; // 3 (fuera de plazo) y 4 (error) → revisión.
}

// Orquesta el flujo completo: valida acceso y estado, valida el archivo, deduplica por
// hash, sube, registra, llama a la IA y aplica el resultado vía RPC. Devuelve solo un
// estado de UX. Nunca: Browser → OpenRouter; siempre Browser → aquí → OpenRouter.
export async function submitPaymentReceipt(params: {
  paymentId: string;
  token?: string;
  userId?: string;
  file: File;
}): Promise<ReceiptSubmitResult> {
  const supabase = createAdminClient();
  const { payment, booking } = await loadAndAuthorize(params);

  // Estados terminales: no se aceptan más comprobantes.
  if (payment.status === "paid" || payment.status === "ai_approved") {
    throw new PaymentAlreadyPaidError();
  }
  if (payment.status !== "pending" && payment.status !== "created") {
    throw new PaymentInvalidStateError();
  }

  // Validación del archivo (tipo real + tamaño).
  const extension = ALLOWED[params.file.type];
  if (!extension || params.file.size <= 0 || params.file.size > MAX_BYTES) {
    throw new ValidationError("El comprobante debe ser JPG, PNG o PDF y pesar hasta 10 MB");
  }

  // Límite de intentos por pago.
  const { count } = await supabase
    .from("payment_receipts")
    .select("id", { count: "exact", head: true })
    .eq("payment_id", payment.id);
  const priorAttempts = count ?? 0;
  const limit = maxAttempts();
  if (priorAttempts >= limit) {
    throw new AppError("RECEIPT_MAX_ATTEMPTS", "Alcanzaste el máximo de comprobantes", 429);
  }

  const bytes = new Uint8Array(await params.file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const attemptNo = priorAttempts + 1;
  const attemptsLeft = Math.max(0, limit - attemptNo);

  // Dedupe: el mismo archivo (por hash) no se reutiliza. Si ya existe → revisión manual
  // sin volver a llamar a la IA.
  const { data: dup } = await supabase
    .from("payment_receipts")
    .select("id")
    .eq("sha256", sha256)
    .maybeSingle();
  const isDuplicate = Boolean(dup);

  // Sube el archivo con nombre aleatorio y registra la fila.
  const path = `${payment.id}/${crypto.randomUUID()}.${extension}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, params.file, {
    contentType: params.file.type,
    upsert: false,
  });
  if (upErr) throw new AppError("INTERNAL_ERROR", "No se pudo subir el comprobante", 500);

  // Si es duplicado, se manda a revisión (resultado 4) sin llamar a la IA.
  let score: ReceiptScore = 4;
  let aiStatus: "analyzed" | "unavailable" = "analyzed";
  if (!isDuplicate) {
    const expected: ExpectedReceipt = {
      amountMinor: payment.amount_minor,
      currency: payment.currency,
      recipientName: process.env.RECEIPT_BANK_HOLDER || "",
      recipientAccount: process.env.RECEIPT_BANK_ACCOUNT || "",
      bankName: process.env.RECEIPT_BANK_NAME || "",
      createdAt: payment.created_at,
      deadlineAt: booking.hold_expires_at || payment.created_at,
    };
    const verdict = await verifyReceipt({ bytes, mimeType: params.file.type, expected });
    if (verdict.kind === "unavailable") {
      aiStatus = "unavailable";
      score = 4; // IA no disponible → revisión manual, nunca aprueba/rechaza.
    } else {
      score = verdict.value;
    }
  }

  const { data: receipt, error: insErr } = await supabase
    .from("payment_receipts")
    .insert({
      payment_id: payment.id,
      booking_id: payment.booking_id,
      file_path: path,
      mime_type: params.file.type,
      size_bytes: params.file.size,
      sha256,
      ai_result: score,
      ai_status: aiStatus,
      attempt_no: attemptNo,
    })
    .select("id")
    .single();
  if (insErr || !receipt) {
    // El índice único de sha256 es el backstop del dedupe: si dos subidas simultáneas
    // pasan la verificación previa, la segunda falla acá. Se limpia el objeto y se
    // manda a revisión.
    await supabase.storage.from(BUCKET).remove([path]);
    // Reintenta la ruta de revisión sobre el pago igual.
    const mode = await getReceiptConfirmMode();
    await supabase.rpc("apply_receipt_result", {
      p_payment_id: payment.id,
      p_receipt_id: null,
      p_result: 4,
      p_mode: mode,
    });
    return { outcome: "review", attemptsLeft };
  }

  const mode = await getReceiptConfirmMode();
  const { error: rpcErr } = await supabase.rpc("apply_receipt_result", {
    p_payment_id: payment.id,
    p_receipt_id: receipt.id,
    p_result: score,
    p_mode: mode,
  });
  if (rpcErr) throw mapPostgresError(rpcErr.message);

  return { outcome: outcomeFor(score, attemptsLeft), attemptsLeft };
}
