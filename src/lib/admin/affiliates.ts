import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AppError, NotFoundError } from "@/lib/errors";

const REQUEST_COLUMNS =
  "id, booking_code, status, payment_status, property_id, check_in, check_out, guests, nights, currency, total_minor, guest_name, guest_email, guest_phone, affiliate_document_id, hold_expires_at, confirmed_at, cancelled_at, created_at";

export type AffiliateRequestRow = {
  id: string;
  booking_code: string;
  status: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  guest_name: string;
  guest_phone: string | null;
  affiliate_document_id: string | null;
  total_minor: number;
  currency: string;
  property_id: string;
  created_at: string;
};

export async function listAffiliateRequests(params: {
  page: number;
  pageSize: number;
  status?: string;
  propertyId?: string;
}) {
  const supabase = await createClient();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase
    .from("bookings")
    .select(
      "id, booking_code, status, check_in, check_out, nights, guests, guest_name, guest_phone, affiliate_document_id, total_minor, currency, property_id, created_at",
      { count: "exact" },
    )
    .eq("channel", "affiliate")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) query = query.eq("status", params.status as never);
  if (params.propertyId) query = query.eq("property_id", params.propertyId);

  const { data, error, count } = await query;
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return {
    rows: (data ?? []) as AffiliateRequestRow[],
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function getAffiliateRequestDetail(id: string) {
  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(REQUEST_COLUMNS)
    .eq("id", id)
    .eq("channel", "affiliate")
    .maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!booking) throw new NotFoundError("Solicitud de afiliado no encontrada");

  const [{ data: companions }, { data: property }] = await Promise.all([
    supabase
      .from("booking_companions")
      .select("id, full_name, document_id, phone, sort_order")
      .eq("booking_id", id)
      .order("sort_order", { ascending: true }),
    supabase.from("properties").select("id, name, slug").eq("id", booking.property_id).maybeSingle(),
  ]);

  return { booking, companions: companions ?? [], property };
}

export async function listAffiliateEnabledProperties() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name")
    .not("affiliate_nightly_price_minor", "is", null)
    .order("name", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return data ?? [];
}
