import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROPERTY = "a1111111-1111-4111-8111-111111111111";
const MARKER = "planner-integration@rentamar.test";

describe.runIf(Boolean(url && anonKey && serviceKey))("admin availability RPC", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;

  beforeAll(() => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
  });

  afterEach(async () => {
    await admin.from("bookings").delete().eq("guest_email", MARKER);
    await admin.from("availability_blocks").delete().eq("reason", "planner-integration");
  });

  it("crea pre-reserva, permite salida/entrada contigua y rechaza solape", async () => {
    const common = {
      p_property_id: PROPERTY,
      p_guest_count: 2,
      p_guest_name: "Planner Integration",
      p_guest_email: MARKER,
      p_guest_phone: null,
      p_access_token_hash: "test-hash",
      p_hold_expires_at: "2031-01-01T12:00:00Z",
      p_kind: "pre_reservation",
      p_reason: "",
      p_actor_id: null,
      p_source: "admin",
    };
    const first = await admin.rpc("create_admin_booking", {
      ...common,
      p_check_in: "2030-01-10",
      p_check_out: "2030-01-12",
    });
    expect(first.error).toBeNull();
    const adjacent = await admin.rpc("create_admin_booking", {
      ...common,
      p_check_in: "2030-01-12",
      p_check_out: "2030-01-14",
    });
    expect(adjacent.error).toBeNull();
    const overlap = await admin.rpc("create_admin_booking", {
      ...common,
      p_check_in: "2030-01-11",
      p_check_out: "2030-01-13",
    });
    expect(overlap.error?.message).toContain("BOOKING_CONFLICT");
  });

  it("marca revisión y ajuste al cambiar el precio de un alquiler pagado", async () => {
    const created = await admin.rpc("create_admin_booking", {
      p_property_id: PROPERTY,
      p_check_in: "2030-02-10",
      p_check_out: "2030-02-12",
      p_guest_count: 2,
      p_guest_name: "Planner Integration",
      p_guest_email: MARKER,
      p_guest_phone: null,
      p_access_token_hash: null,
      p_hold_expires_at: null,
      p_kind: "rental",
      p_reason: "Pago offline",
      p_actor_id: null,
      p_source: "admin",
    });
    expect(created.error).toBeNull();
    const bookingId = (created.data as { bookingId: string }).bookingId;
    const updated = await admin.rpc("update_admin_booking", {
      p_booking_id: bookingId,
      p_property_id: PROPERTY,
      p_check_in: "2030-02-10",
      p_check_out: "2030-02-13",
      p_guest_count: 2,
      p_guest_name: "Planner Integration",
      p_guest_email: MARKER,
      p_guest_phone: null,
      p_hold_expires_at: null,
      p_reason: "Cambio de estadía",
      p_actor_id: null,
      p_source: "admin",
    });
    expect(updated.error).toBeNull();
    expect(updated.data).toMatchObject({
      status: "manual_review",
      paymentStatus: "refund_required",
      priceAdjustmentRequired: true,
    });
  });

  it("edita y libera un bloqueo sin eliminarlo", async () => {
    const created = await admin.rpc("create_availability_block", {
      p_property_id: PROPERTY,
      p_from: "2030-04-10",
      p_to: "2030-04-12",
      p_type: "maintenance",
      p_reason: "planner-integration",
      p_actor_id: null,
    });
    expect(created.error).toBeNull();
    const blockId = (created.data as { blockId: string }).blockId;

    const updated = await admin.rpc("update_availability_block", {
      p_block_id: blockId,
      p_property_id: PROPERTY,
      p_from: "2030-04-11",
      p_to: "2030-04-14",
      p_type: "owner_use",
      p_reason: "planner-integration",
      p_actor_id: null,
    });
    expect(updated.error).toBeNull();

    const released = await admin.rpc("release_availability_block", {
      p_block_id: blockId,
      p_reason: "planner-integration",
      p_actor_id: null,
    });
    expect(released.error).toBeNull();

    const { data } = await admin
      .from("availability_blocks")
      .select("status,type,stay_range")
      .eq("id", blockId)
      .single();
    expect(data).toMatchObject({ status: "released", type: "owner_use" });
  });

  it("no expone las nuevas RPC al rol anon", async () => {
    const result = await anon.rpc("create_admin_booking", {
      p_property_id: PROPERTY,
      p_check_in: "2030-03-10",
      p_check_out: "2030-03-11",
      p_guest_count: 1,
      p_guest_name: "Anon Test",
      p_guest_email: MARKER,
      p_guest_phone: null,
      p_access_token_hash: "test-hash",
      p_hold_expires_at: "2031-01-01T12:00:00Z",
      p_kind: "pre_reservation",
      p_reason: "",
      p_actor_id: null,
      p_source: "admin",
    });
    expect(result.error).not.toBeNull();
  });
});
