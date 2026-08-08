import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, NotFoundError } from "@/lib/errors";

const RECEIPTS_BUCKET = "payment-receipts";

// El detalle de pago NUNCA expone create_response_raw, last_status_response_raw ni
// idempotency_key (columnas revocadas a authenticated en 017; el select explícito
// las omite igual). Tampoco el QR completo se necesita en el panel administrativo.
const PAYMENT_DETAIL_COLUMNS =
  "id, booking_id, provider, provider_mode, method, status, amount_minor, currency, external_id, provider_status_code, expires_at, paid_at, failed_at, last_provider_check_at, created_at, updated_at";

export type PaymentListRow = {
  id: string;
  booking_id: string;
  status: string;
  amount_minor: number;
  currency: string;
  provider: string;
  created_at: string;
};

export async function listPayments(params: { page: number; pageSize: number; status?: string }) {
  const supabase = await createClient();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase
    .from("payments")
    .select("id, booking_id, status, amount_minor, currency, provider, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) query = query.eq("status", params.status as never);

  const { data, error, count } = await query;
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return {
    rows: (data ?? []) as PaymentListRow[],
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function getPaymentDetail(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(PAYMENT_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!data) throw new NotFoundError("Pago no encontrado");

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, booking_code, status, payment_status, guest_name")
    .eq("id", data.booking_id)
    .maybeSingle();

  return { payment: data, booking };
}

export type ReceiptRow = {
  id: string;
  attemptNo: number;
  aiResult: number | null;
  aiStatus: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
};

// Comprobantes subidos por el cliente. La URL es firmada de corta duración (bucket
// privado); solo el staff la ve. El hash y el resultado IA permiten auditar.
export async function listPaymentReceipts(paymentId: string): Promise<ReceiptRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_receipts")
    .select("id, attempt_no, ai_result, ai_status, sha256, mime_type, size_bytes, file_path, created_at")
    .eq("payment_id", paymentId)
    .order("attempt_no", { ascending: false });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);

  const out: ReceiptRow[] = [];
  for (const row of data ?? []) {
    const { data: signed } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(row.file_path, 60 * 10);
    out.push({
      id: row.id,
      attemptNo: row.attempt_no,
      aiResult: row.ai_result,
      aiStatus: row.ai_status,
      sha256: row.sha256,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      url: signed?.signedUrl ?? null,
    });
  }
  return out;
}

// Bitácora de pago: se omiten error_message crudos largos; se muestra el tipo/estado.
export async function listPaymentEvents(paymentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_events")
    .select(
      "id, source, event_type, old_status, new_status, provider_status_code, error_code, created_at",
    )
    .eq("payment_id", paymentId)
    .order("created_at", { ascending: false });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return data ?? [];
}
