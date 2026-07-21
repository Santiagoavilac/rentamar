import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, mapPostgresError } from "@/lib/errors";
import type { AvailabilityBlockInput } from "@/lib/validation";

// Un daterange de Postgres llega serializado como texto "[2026-01-01,2026-01-05)".
export function parseDateRange(range: string): { from: string; to: string } | null {
  const m = /^[\[(]\s*"?(\d{4}-\d{2}-\d{2})"?\s*,\s*"?(\d{4}-\d{2}-\d{2})"?\s*[\])]$/.exec(range);
  if (!m) return null;
  return { from: m[1], to: m[2] };
}

export type CalendarBlock = {
  id: string;
  from: string;
  to: string;
  type: string;
  reason: string | null;
};

export type CalendarBooking = {
  from: string;
  to: string;
  status: string;
};

export async function listActiveBlocks(propertyId: string): Promise<CalendarBlock[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_blocks")
    .select("id, stay_range, type, reason, status")
    .eq("property_id", propertyId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return (data ?? [])
    .map((b) => {
      const range = parseDateRange(String(b.stay_range));
      if (!range) return null;
      return { id: b.id, from: range.from, to: range.to, type: b.type, reason: b.reason };
    })
    .filter((b): b is CalendarBlock => b !== null);
}

// Holds que ocupan fechas (reservas vigentes o confirmadas), para pintar el calendario.
export async function listOccupiedRanges(propertyId: string): Promise<CalendarBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_holds")
    .select("stay_range, status, expires_at")
    .eq("property_id", propertyId)
    .in("status", ["active", "converted"]);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  const now = Date.now();
  return (data ?? [])
    .filter((h) => h.status === "converted" || new Date(h.expires_at).getTime() > now)
    .map((h) => {
      const range = parseDateRange(String(h.stay_range));
      if (!range) return null;
      return { from: range.from, to: range.to, status: h.status };
    })
    .filter((b): b is CalendarBooking => b !== null);
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
