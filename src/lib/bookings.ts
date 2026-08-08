import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import {
  AppError,
  BookingExpiredError,
  UnauthorizedBookingAccessError,
  mapPostgresError,
} from "./errors";
import type { CreateBookingInput, QuoteInput } from "./validation";

const HOLD_MINUTES = 30;

export type PriceItem = {
  type: string;
  description: string;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
};

export type Quote = {
  currency: string;
  nights: number;
  originalSubtotalMinor: number;
  subtotalMinor: number;
  cleaningFeeMinor: number;
  serviceFeeMinor: number;
  discountMinor: number;
  discountPercent: number;
  pricingMode: "nightly" | "duration";
  durationPriceMinor: number | null;
  totalMinor: number;
  items: PriceItem[];
};

// Token de acceso a reserva de invitado. Se guarda solo el hash; el token en
// claro se entrega una única vez al crear la reserva.
export function generateAccessToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(token: string, hash: string | null): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getQuote(input: QuoteInput): Promise<Quote> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("calculate_booking_price", {
    p_property_id: input.propertyId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guest_count: input.guestCount,
  });

  if (error) throw mapPostgresError(error.message);
  return data as unknown as Quote;
}

export type CreatedBooking = {
  bookingId: string;
  bookingCode: string;
  status: string;
  currency: string;
  totalMinor: number;
  holdExpiresAt: string;
  accessToken: string;
};

export async function createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const supabase = createAdminClient();
  const { token, hash } = generateAccessToken();

  const { data, error } = await supabase.rpc("create_booking_with_hold", {
    p_property_id: input.propertyId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guest_count: input.guestCount,
    p_guest_name: input.guest.name,
    p_guest_email: input.guest.email,
    p_guest_phone: input.guest.phone ?? null,
    p_access_token_hash: hash,
    p_hold_minutes: HOLD_MINUTES,
  });

  if (error) throw mapPostgresError(error.message);

  const result = data as unknown as Omit<CreatedBooking, "accessToken">;

  // Los datos de la declaración jurada se guardan aparte en vez de sumar parámetros a la
  // RPC: recrear una función `security definer` de este tamaño en producción es más
  // riesgoso que un update acotado a la fila que la propia RPC acaba de devolver.
  await supabase
    .from("bookings")
    .update({
      guest_document_id: input.guest.documentId,
      guest_nationality: input.guest.nationality,
      guest_city: input.guest.city,
    })
    .eq("id", result.bookingId);

  return { ...result, accessToken: token };
}

export type BookingView = {
  id: string;
  bookingCode: string;
  status: string;
  propertyId: string;
  propertyName: string;
  checkInTime: string;
  checkOutTime: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  currency: string;
  subtotalMinor: number;
  cleaningFeeMinor: number;
  serviceFeeMinor: number;
  discountMinor: number;
  totalMinor: number;
  holdExpiresAt: string | null;
  guestName: string;
  items: PriceItem[];
};

// Acceso seguro a una reserva: exige sesión del dueño (userId) o token válido.
// Nunca permite acceso solo por UUID o booking_code.
export async function getBookingForAccess(params: {
  bookingId: string;
  token?: string;
  userId?: string;
}): Promise<BookingView> {
  const supabase = createAdminClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, status, property_id, check_in, check_out, guests, nights, currency, subtotal_minor, cleaning_fee_minor, service_fee_minor, discount_minor, total_minor, hold_expires_at, guest_name, guest_id, access_token_hash, properties(name, check_in_time, check_out_time)",
    )
    .eq("id", params.bookingId)
    .maybeSingle();

  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!booking) throw new UnauthorizedBookingAccessError();

  const isOwner = Boolean(params.userId) && booking.guest_id === params.userId;
  const hasValidToken =
    Boolean(params.token) && tokenMatches(params.token as string, booking.access_token_hash);

  if (!isOwner && !hasValidToken) throw new UnauthorizedBookingAccessError();

  if (booking.status === "expired") throw new BookingExpiredError();

  const { data: items } = await supabase
    .from("booking_price_items")
    .select("type, description, quantity, unit_amount_minor, total_amount_minor")
    .eq("booking_id", booking.id);

  return {
    id: booking.id,
    bookingCode: booking.booking_code,
    status: booking.status,
    propertyId: booking.property_id,
    propertyName: booking.properties?.name ?? "Propiedad",
    checkInTime: booking.properties?.check_in_time?.slice(0, 5) ?? "15:00",
    checkOutTime: booking.properties?.check_out_time?.slice(0, 5) ?? "11:00",
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    guests: booking.guests,
    nights: booking.nights,
    currency: booking.currency,
    subtotalMinor: booking.subtotal_minor,
    cleaningFeeMinor: booking.cleaning_fee_minor,
    serviceFeeMinor: booking.service_fee_minor,
    discountMinor: booking.discount_minor,
    totalMinor: booking.total_minor,
    holdExpiresAt: booking.hold_expires_at,
    guestName: booking.guest_name,
    items: (items ?? []).map((i) => ({
      type: i.type,
      description: i.description ?? "",
      quantity: i.quantity,
      unitAmountMinor: i.unit_amount_minor,
      totalAmountMinor: i.total_amount_minor,
    })),
  };
}
