import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = process.env.RUN_STAY_PRICING_INTEGRATION === "true";

describe.runIf(Boolean(enabled && url && anonKey && serviceKey))("stay pricing RPC", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let authenticated: SupabaseClient;
  let propertyId = "";
  let userId = "";

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    authenticated = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const email = `stay-pricing-auth-${Date.now()}@rentamar.test`;
    const password = `Tmp-${crypto.randomUUID()}-Aa1!`;
    const createdUser = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (createdUser.error) throw createdUser.error;
    userId = createdUser.data.user.id;
    const signedIn = await authenticated.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    const { data, error } = await admin
      .from("properties")
      .insert({
        name: "Stay Pricing Integration",
        slug: `stay-pricing-${Date.now()}`,
        status: "published",
        base_price_minor: 50000,
        max_guests: 4,
        minimum_nights: 1,
      })
      .select("id")
      .single();
    if (error) throw error;
    propertyId = data.id;
  });

  afterAll(async () => {
    if (propertyId) {
      await admin.from("bookings").delete().eq("property_id", propertyId);
      await admin.from("properties").delete().eq("id", propertyId);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("guarda el paquete, cotiza descuento y congela importes en la reserva", async () => {
    const saved = await admin.rpc("save_property_pricing", {
      p_property_id: propertyId,
      p_base_price_minor: 50000,
      p_duration_pricing_enabled: true,
      p_prices: [{ nights: 2, totalMinor: 95000 }],
      p_actor_id: null,
      p_reason: "Prueba de integración",
    });
    expect(saved.error).toBeNull();

    const quoted = await admin.rpc("calculate_booking_price", {
      p_property_id: propertyId,
      p_check_in: "2032-02-10",
      p_check_out: "2032-02-12",
      p_guest_count: 2,
    });
    expect(quoted.error).toBeNull();
    expect(quoted.data).toMatchObject({
      originalSubtotalMinor: 100000,
      discountMinor: 5000,
      discountPercent: 5,
      pricingMode: "duration",
      totalMinor: 95000,
    });

    const created = await admin.rpc("create_booking_with_hold", {
      p_property_id: propertyId,
      p_check_in: "2032-02-10",
      p_check_out: "2032-02-12",
      p_guest_count: 2,
      p_guest_name: "Pricing Integration",
      p_guest_email: "stay-pricing@rentamar.test",
      p_guest_phone: null,
      p_access_token_hash: "integration-hash",
      p_hold_minutes: 30,
    });
    expect(created.error).toBeNull();
    const bookingId = (created.data as { bookingId: string }).bookingId;
    const { data: booking } = await admin
      .from("bookings")
      .select("subtotal_minor,discount_minor,total_minor")
      .eq("id", bookingId)
      .single();
    expect(booking).toMatchObject({
      subtotal_minor: 100000,
      discount_minor: 5000,
      total_minor: 95000,
    });
  });

  it("da prioridad a la tarifa estacional", async () => {
    const { error } = await admin.from("property_rates").insert({
      property_id: propertyId,
      start_date: "2032-03-01",
      end_date: "2032-03-10",
      nightly_price_minor: 60000,
    });
    expect(error).toBeNull();
    const quoted = await admin.rpc("calculate_booking_price", {
      p_property_id: propertyId,
      p_check_in: "2032-03-02",
      p_check_out: "2032-03-04",
      p_guest_count: 2,
    });
    expect(quoted.data).toMatchObject({
      originalSubtotalMinor: 120000,
      discountMinor: 0,
      pricingMode: "nightly",
      totalMinor: 120000,
    });
  });

  it("incluye bloqueos administrativos y no expone la RPC de escritura a anon", async () => {
    const block = await admin.rpc("create_availability_block", {
      p_property_id: propertyId,
      p_from: "2032-04-10",
      p_to: "2032-04-12",
      p_type: "maintenance",
      p_reason: "stay-pricing-integration",
      p_actor_id: null,
    });
    expect(block.error).toBeNull();
    const availability = await anon.rpc("get_property_availability", {
      p_property_id: propertyId,
      p_from: "2032-04-01",
      p_to: "2032-05-01",
    });
    expect(availability.data).toEqual(
      expect.arrayContaining([{ stay_range: "[2032-04-10,2032-04-12)" }]),
    );

    const denied = await anon.rpc("save_property_pricing", {
      p_property_id: propertyId,
      p_base_price_minor: 50000,
      p_duration_pricing_enabled: true,
      p_prices: [],
      p_actor_id: null,
      p_reason: "Debe fallar",
    });
    expect(denied.error).not.toBeNull();
    const deniedAuthenticated = await authenticated.rpc("save_property_pricing", {
      p_property_id: propertyId,
      p_base_price_minor: 50000,
      p_duration_pricing_enabled: true,
      p_prices: [],
      p_actor_id: userId,
      p_reason: "También debe fallar",
    });
    expect(deniedAuthenticated.error).not.toBeNull();
  });
});
