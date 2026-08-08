import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAccessToken } from "@/lib/bookings";
import { AppError, mapPostgresError } from "@/lib/errors";
import { PLANNER_STATE_LABELS } from "@/lib/admin/planner-query";
import type {
  AdminBookingInput,
  AdminBookingUpdateInput,
  AvailabilityBlockInput,
  AvailabilityBlockUpdateInput,
  PlannerQueryInput,
} from "@/lib/validation";
import type { Database } from "@/lib/supabase/types";

type BlockType = Database["public"]["Enums"]["availability_block_type"];
type HoldStatus = Database["public"]["Enums"]["hold_status"];
type BookingStatus = Database["public"]["Enums"]["booking_status"];
type BookingPaymentStatus = Database["public"]["Enums"]["booking_payment_status"];
type BookingEventSource = Database["public"]["Enums"]["booking_event_source"];
type BookingChannel = Database["public"]["Enums"]["booking_channel"];

export function parseDateRange(range: string): { from: string; to: string } | null {
  const match = /^[\[(]\s*"?(\d{4}-\d{2}-\d{2})"?\s*,\s*"?(\d{4}-\d{2}-\d{2})"?\s*[\])]$/.exec(
    range,
  );
  if (!match) return null;
  return { from: match[1], to: match[2] };
}

export type PlannerProperty = {
  id: string;
  name: string;
  slug: string;
  status: Database["public"]["Enums"]["property_status"];
  zone: string | null;
};

export type PlannerState =
  | "pre_reservation"
  | "rental"
  | "blocked"
  | "affiliate_pending"
  | "affiliate_confirmed";

export type PlannerEvent = {
  id: string;
  entity: "booking" | "block";
  state: PlannerState;
  propertyId: string;
  from: string;
  to: string;
  title: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCount: number | null;
  channel: BookingChannel | null;
  reason: string | null;
  blockType: BlockType | null;
  bookingStatus: BookingStatus | null;
  paymentStatus: BookingPaymentStatus | null;
  holdStatus: HoldStatus | null;
  holdExpiresAt: string | null;
  totalMinor: number | null;
  currency: string | null;
  createdAt: string;
};

export type PlannerData = {
  properties: PlannerProperty[];
  events: PlannerEvent[];
};

export async function listPlannerProperties(): Promise<PlannerProperty[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, slug, status, zone")
    .neq("status", "archived")
    .order("name", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return (data ?? []) as PlannerProperty[];
}

type RawBooking = {
  id: string;
  property_id: string;
  booking_code: string;
  status: BookingStatus;
  payment_status: BookingPaymentStatus;
  check_in: string;
  check_out: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  guests: number;
  channel: BookingChannel;
  total_minor: number;
  currency: string;
  hold_expires_at: string | null;
  created_at: string;
  booking_holds: Array<{
    status: HoldStatus;
    expires_at: string;
    stay_range: unknown;
  }>;
};

export async function listPlannerData(input: PlannerQueryInput): Promise<PlannerData> {
  const supabase = await createClient();
  let propertiesQuery = supabase
    .from("properties")
    .select("id, name, slug, status, zone")
    .neq("status", "archived")
    .order("name", { ascending: true });
  if (input.propertyIds.length) propertiesQuery = propertiesQuery.in("id", input.propertyIds);

  let bookingsQuery = supabase
    .from("bookings")
    .select(
      "id, property_id, booking_code, status, payment_status, check_in, check_out, guest_name, guest_email, guest_phone, guests, channel, total_minor, currency, hold_expires_at, created_at, booking_holds(status, expires_at, stay_range)",
    )
    .lt("check_in", input.to)
    .gt("check_out", input.from)
    .in("status", ["pending_payment", "confirmed", "manual_review", "completed"])
    .order("check_in", { ascending: true });
  if (input.propertyIds.length) bookingsQuery = bookingsQuery.in("property_id", input.propertyIds);

  let blocksQuery = supabase
    .from("availability_blocks")
    .select("id, property_id, stay_range, type, status, reason, created_at")
    .eq("status", "active")
    .overlaps("stay_range", `[${input.from},${input.to})`)
    .order("created_at", { ascending: false });
  if (input.propertyIds.length) blocksQuery = blocksQuery.in("property_id", input.propertyIds);

  const [propertiesResult, bookingsResult, blocksResult] = await Promise.all([
    propertiesQuery,
    bookingsQuery,
    blocksQuery,
  ]);
  if (propertiesResult.error || bookingsResult.error || blocksResult.error) {
    console.error(
      "[planner-query]",
      propertiesResult.error?.message,
      bookingsResult.error?.message,
      blocksResult.error?.message,
    );
    throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  }

  const properties = (propertiesResult.data ?? []) as PlannerProperty[];
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const normalizedSearch = input.search.toLocaleLowerCase("es");
  const stateFilter = new Set<PlannerState>(input.states);
  const matchesSearch = (event: PlannerEvent) => {
    if (!normalizedSearch) return true;
    const property = propertyById.get(event.propertyId);
    return [property?.name, property?.slug, event.guestName, event.title, event.reason]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("es").includes(normalizedSearch));
  };

  const bookingEvents = ((bookingsResult.data ?? []) as unknown as RawBooking[]).flatMap(
    (booking): PlannerEvent[] => {
      const hold = booking.booking_holds.find(
        (item) => item.status === "active" || item.status === "converted",
      );
      if (!hold) return [];
      const isAffiliate = booking.channel === "affiliate";
      const converted = hold.status === "converted";
      const state: PlannerState = isAffiliate
        ? converted
          ? "affiliate_confirmed"
          : "affiliate_pending"
        : converted
          ? "rental"
          : "pre_reservation";
      const event: PlannerEvent = {
        id: booking.id,
        entity: "booking",
        state,
        propertyId: booking.property_id,
        from: booking.check_in,
        to: booking.check_out,
        title: PLANNER_STATE_LABELS[state],
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        guestPhone: booking.guest_phone,
        guestCount: booking.guests,
        channel: booking.channel,
        reason: null,
        blockType: null,
        bookingStatus: booking.status,
        paymentStatus: booking.payment_status,
        holdStatus: hold.status,
        holdExpiresAt: booking.hold_expires_at ?? hold.expires_at,
        totalMinor: booking.total_minor,
        currency: booking.currency,
        createdAt: booking.created_at,
      };
      return (!stateFilter.size || stateFilter.has(state)) && matchesSearch(event) ? [event] : [];
    },
  );

  const blockEvents = (blocksResult.data ?? []).flatMap<PlannerEvent>((block) => {
    const range = parseDateRange(String(block.stay_range));
    if (!range) return [];
    const event: PlannerEvent = {
      id: block.id,
      entity: "block",
      state: "blocked",
      propertyId: block.property_id,
      from: range.from,
      to: range.to,
      title: "Bloqueado",
      guestName: null,
      guestEmail: null,
      guestPhone: null,
      guestCount: null,
      channel: null,
      reason: block.reason,
      blockType: block.type,
      bookingStatus: null,
      paymentStatus: null,
      holdStatus: null,
      holdExpiresAt: null,
      totalMinor: null,
      currency: null,
      createdAt: block.created_at,
    };
    return (!stateFilter.size || stateFilter.has("blocked")) && matchesSearch(event) ? [event] : [];
  });

  return {
    properties,
    events: [...bookingEvents, ...blockEvents].sort(
      (a, b) => a.from.localeCompare(b.from) || a.createdAt.localeCompare(b.createdAt),
    ),
  };
}

export type CalendarBlock = {
  id: string;
  from: string;
  to: string;
  type: BlockType;
  reason: string | null;
};

export type CalendarBooking = {
  from: string;
  to: string;
  status: HoldStatus;
};

export async function listActiveBlocks(propertyId: string): Promise<CalendarBlock[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_blocks")
    .select("id, stay_range, type, reason")
    .eq("property_id", propertyId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return (data ?? []).flatMap<CalendarBlock>((block) => {
    const range = parseDateRange(String(block.stay_range));
    return range ? [{ id: block.id, ...range, type: block.type, reason: block.reason }] : [];
  });
}

export async function listOccupiedRanges(propertyId: string): Promise<CalendarBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_holds")
    .select("stay_range, status")
    .eq("property_id", propertyId)
    .in("status", ["active", "converted"]);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return (data ?? []).flatMap<CalendarBooking>((hold) => {
    const range = parseDateRange(String(hold.stay_range));
    return range ? [{ ...range, status: hold.status }] : [];
  });
}

export async function createBlock(input: AvailabilityBlockInput, actorId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_availability_block", {
    p_property_id: input.propertyId,
    p_from: input.from,
    p_to: input.to,
    p_type: input.type,
    p_reason: input.reason || "",
    p_actor_id: actorId,
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as { blockId: string; status: string };
}

export async function updateBlock(input: AvailabilityBlockUpdateInput, actorId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("update_availability_block", {
    p_block_id: input.blockId,
    p_property_id: input.propertyId,
    p_from: input.from,
    p_to: input.to,
    p_type: input.type,
    p_reason: input.reason || "",
    p_actor_id: actorId,
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as { blockId: string; status: string };
}

export async function releaseBlock(blockId: string, reason: string, actorId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("release_availability_block", {
    p_block_id: blockId,
    p_reason: reason,
    p_actor_id: actorId,
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as { blockId: string; status: string };
}

function holdExpirationIso(input: { kind?: string; holdExpiresLocal?: string }): string | null {
  if (input.kind === "rental" || !input.holdExpiresLocal) return null;
  return new Date(`${input.holdExpiresLocal}:00-04:00`).toISOString();
}

export async function createAdminBooking(
  input: AdminBookingInput,
  actorId: string,
  source: BookingEventSource,
) {
  const supabase = createAdminClient();
  const access = input.kind === "pre_reservation" ? generateAccessToken() : null;
  const { data, error } = await supabase.rpc("create_admin_booking", {
    p_property_id: input.propertyId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guest_count: input.guestCount,
    p_guest_name: input.guestName,
    p_guest_email: input.guestEmail,
    p_guest_phone: input.guestPhone || null,
    p_access_token_hash: access?.hash ?? null,
    p_hold_expires_at: holdExpirationIso(input),
    p_kind: input.kind,
    p_reason: input.reason || "",
    p_actor_id: actorId,
    p_source: source,
  });
  if (error) throw mapPostgresError(error.message);
  return {
    ...(data as unknown as {
      bookingId: string;
      bookingCode: string;
      status: string;
      paymentStatus: string;
    }),
    accessToken: access?.token ?? null,
  };
}

export async function updateAdminBooking(
  input: AdminBookingUpdateInput,
  actorId: string,
  source: BookingEventSource,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("update_admin_booking", {
    p_booking_id: input.bookingId,
    p_property_id: input.propertyId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guest_count: input.guestCount,
    p_guest_name: input.guestName,
    p_guest_email: input.guestEmail,
    p_guest_phone: input.guestPhone || null,
    p_hold_expires_at: input.holdExpiresLocal
      ? new Date(`${input.holdExpiresLocal}:00-04:00`).toISOString()
      : null,
    p_reason: input.reason,
    p_actor_id: actorId,
    p_source: source,
  });
  if (error) throw mapPostgresError(error.message);
  return data as unknown as {
    bookingId: string;
    status: string;
    paymentStatus: string;
    priceAdjustmentRequired: boolean;
  };
}
