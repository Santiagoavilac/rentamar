import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, NotFoundError, mapPostgresError } from "@/lib/errors";

// El detalle de reserva NUNCA expone access_token_hash. Solo columnas de negocio.
const BOOKING_DETAIL_COLUMNS =
  "id, booking_code, status, payment_status, property_id, check_in, check_out, guests, nights, currency, subtotal_minor, cleaning_fee_minor, service_fee_minor, discount_minor, total_minor, guest_name, guest_email, guest_phone, hold_expires_at, confirmed_at, cancelled_at, completed_at, created_at";

export type BookingListRow = {
  id: string;
  booking_code: string;
  status: string;
  payment_status: string;
  check_in: string;
  check_out: string;
  guest_name: string;
  total_minor: number;
  currency: string;
  created_at: string;
};

export async function listBookings(params: {
  page: number;
  pageSize: number;
  status?: string;
  propertyId?: string;
  search?: string;
}) {
  const supabase = await createClient();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase
    .from("bookings")
    .select(
      "id, booking_code, status, payment_status, check_in, check_out, guest_name, total_minor, currency, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) query = query.eq("status", params.status as never);
  if (params.propertyId) query = query.eq("property_id", params.propertyId);
  if (params.search) query = query.ilike("booking_code", `%${params.search}%`);

  const { data, error, count } = await query;
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return {
    rows: (data ?? []) as BookingListRow[],
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function getBookingDetail(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!data) throw new NotFoundError("Reserva no encontrada");

  const { data: items } = await supabase
    .from("booking_price_items")
    .select("type, description, quantity, unit_amount_minor, total_amount_minor")
    .eq("booking_id", id);

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, slug")
    .eq("id", data.property_id)
    .maybeSingle();

  return { booking: data, items: items ?? [], property };
}

export async function listBookingEvents(bookingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_events")
    .select("id, source, event_type, old_status, new_status, reason, metadata, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return data ?? [];
}

type BookingActionResult = { ok: boolean; status: string; refundRequired?: boolean };

async function callBookingRpc(
  fn:
    | "cancel_booking"
    | "expire_booking_admin"
    | "mark_booking_manual_review"
    | "confirm_booking_manual",
  bookingId: string,
  reason: string,
  actorId: string,
  source: "admin" | "operator",
): Promise<BookingActionResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(fn, {
    p_booking_id: bookingId,
    p_reason: reason,
    p_actor_id: actorId,
    p_source: source,
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as BookingActionResult;
}

export function cancelBooking(
  id: string,
  reason: string,
  actorId: string,
  source: "admin" | "operator",
) {
  return callBookingRpc("cancel_booking", id, reason, actorId, source);
}
export function expireBooking(
  id: string,
  reason: string,
  actorId: string,
  source: "admin" | "operator",
) {
  return callBookingRpc("expire_booking_admin", id, reason, actorId, source);
}
export function markManualReview(
  id: string,
  reason: string,
  actorId: string,
  source: "admin" | "operator",
) {
  return callBookingRpc("mark_booking_manual_review", id, reason, actorId, source);
}
export function confirmManual(
  id: string,
  reason: string,
  actorId: string,
  source: "admin" | "operator",
) {
  return callBookingRpc("confirm_booking_manual", id, reason, actorId, source);
}
