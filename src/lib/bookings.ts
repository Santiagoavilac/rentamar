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
  subtotalMinor: number;
  cleaningFeeMinor: number;
  serviceFeeMinor: number;
  discountMinor: number;
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
  return { ...result, accessToken: token };
}

export type BookingView = {
  id: string;
  bookingCode: string;
  status: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  currency: string;
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
      "id, booking_code, status, property_id, check_in, check_out, guests, nights, currency, total_minor, hold_expires_at, guest_name, guest_id, access_token_hash",
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
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    guests: booking.guests,
    nights: booking.nights,
    currency: booking.currency,
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
