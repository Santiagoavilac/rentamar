import "server-only";
import { createClient } from "@/lib/supabase/server";

// Métricas reales agregadas desde Supabase (count exact, sin traer filas). No se
// inventan cifras financieras: los ingresos confirmados suman total_minor de las
// reservas confirmadas/completadas.

async function countBookings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  status: string,
): Promise<number> {
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", status as never);
  return count ?? 0;
}

async function countPayments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  status: string,
): Promise<number> {
  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("status", status as never);
  return count ?? 0;
}

export type DashboardMetrics = {
  bookings: { pendingPayment: number; confirmed: number; expired: number; manualReview: number };
  payments: { pending: number; paid: number; error: number };
  publishedProperties: number;
  confirmedRevenueMinor: number;
  upcomingArrivals: {
    booking_code: string;
    check_in: string;
    guest_name: string;
    id: string;
  }[];
  attentionBookings: {
    id: string;
    booking_code: string;
    status: string;
    payment_status: string;
  }[];
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    pendingPayment,
    confirmed,
    expired,
    manualReview,
    payPending,
    payPaid,
    payError,
    publishedRes,
    revenueRes,
    arrivalsRes,
    attentionRes,
  ] = await Promise.all([
    countBookings(supabase, "pending_payment"),
    countBookings(supabase, "confirmed"),
    countBookings(supabase, "expired"),
    countBookings(supabase, "manual_review"),
    countPayments(supabase, "pending"),
    countPayments(supabase, "paid"),
    countPayments(supabase, "error"),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase.from("bookings").select("total_minor").in("status", ["confirmed", "completed"]),
    supabase
      .from("bookings")
      .select("id, booking_code, check_in, guest_name")
      .eq("status", "confirmed")
      .gte("check_in", today)
      .order("check_in", { ascending: true })
      .limit(8),
    supabase
      .from("bookings")
      .select("id, booking_code, status, payment_status")
      .in("status", ["manual_review"])
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const confirmedRevenueMinor = (revenueRes.data ?? []).reduce(
    (sum, r) => sum + (r.total_minor ?? 0),
    0,
  );

  return {
    bookings: { pendingPayment, confirmed, expired, manualReview },
    payments: { pending: payPending, paid: payPaid, error: payError },
    publishedProperties: publishedRes.count ?? 0,
    confirmedRevenueMinor,
    upcomingArrivals: arrivalsRes.data ?? [],
    attentionBookings: attentionRes.data ?? [],
  };
}
