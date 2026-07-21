import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LAGUNA = "a1111111-1111-4111-8111-111111111111"; // min_nights 2, base 52000
const VILLA = "a4444444-4444-4444-8444-444444444444"; // rate especial 190000 en dic
const MARKER = "itest@rentamar.test";

// Se salta si no hay credenciales (p. ej. CI sin secrets).
const run = url && anonKey && serviceKey ? describe : describe.skip;

run("integración Supabase (Fase 1)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;

  // Fechas base únicas y futuras para evitar colisiones entre corridas.
  const d = (offset: number) => {
    const base = new Date();
    base.setUTCFullYear(base.getUTCFullYear() + 1);
    base.setUTCDate(base.getUTCDate() + offset);
    return base.toISOString().slice(0, 10);
  };

  const createBooking = (propertyId: string, checkIn: string, checkOut: string, guests: number) =>
    admin.rpc("create_booking_with_hold", {
      p_property_id: propertyId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guest_count: guests,
      p_guest_name: "Integration",
      p_guest_email: MARKER,
      p_guest_phone: "70000000",
      p_access_token_hash: createHash("sha256").update("secret-token").digest("hex"),
      p_hold_minutes: 30,
    });

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    await admin.from("bookings").delete().eq("guest_email", MARKER);
  });

  afterAll(async () => {
    await admin.from("bookings").delete().eq("guest_email", MARKER);
  });

  describe("pricing", () => {
    it("calcula precio base (3 noches x 52000)", async () => {
      const { data, error } = await anon.rpc("calculate_booking_price", {
        p_property_id: LAGUNA,
        p_check_in: d(10),
        p_check_out: d(13),
        p_guest_count: 4,
      });
      expect(error).toBeNull();
      expect(data.nights).toBe(3);
      expect(data.totalMinor).toBe(156000);
    });

    it("aplica tarifa especial de temporada", async () => {
      const { data, error } = await anon.rpc("calculate_booking_price", {
        p_property_id: VILLA,
        p_check_in: "2026-12-21",
        p_check_out: "2026-12-24",
        p_guest_count: 4,
      });
      expect(error).toBeNull();
      expect(data.totalMinor).toBe(570000); // 3 x 190000
    });

    it("rechaza noches insuficientes (min 2)", async () => {
      const { error } = await anon.rpc("calculate_booking_price", {
        p_property_id: LAGUNA,
        p_check_in: d(10),
        p_check_out: d(11),
        p_guest_count: 2,
      });
      expect(error?.message).toContain("MINIMUM_NIGHTS");
    });

    it("rechaza exceso de huéspedes", async () => {
      const { error } = await anon.rpc("calculate_booking_price", {
        p_property_id: LAGUNA,
        p_check_in: d(10),
        p_check_out: d(13),
        p_guest_count: 99,
      });
      expect(error?.message).toContain("GUEST_CAPACITY");
    });
  });

  describe("disponibilidad y doble reserva", () => {
    it("crea reserva y bloquea las fechas", async () => {
      const { data, error } = await createBooking(LAGUNA, d(40), d(43), 2);
      expect(error).toBeNull();
      expect(data.bookingCode).toMatch(/^RM-\d{4}-\d{6}$/);
      expect(data.totalMinor).toBe(156000);
    });

    it("rechaza fechas solapadas", async () => {
      const { error } = await createBooking(LAGUNA, d(41), d(44), 2);
      expect(error?.message).toContain("BOOKING_CONFLICT");
    });

    it("permite reserva adyacente (entra el día de salida)", async () => {
      const { error } = await createBooking(LAGUNA, d(43), d(45), 2);
      expect(error).toBeNull();
    });
  });

  describe("RLS", () => {
    it("público puede leer propiedades publicadas", async () => {
      const { data, error } = await anon.from("properties").select("id").eq("status", "published");
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    });

    it("público NO lee reservas", async () => {
      const { data } = await anon.from("bookings").select("id");
      expect((data ?? []).length).toBe(0);
    });

    it("público NO lee booking_holds", async () => {
      const { data } = await anon.from("booking_holds").select("id");
      expect((data ?? []).length).toBe(0);
    });
  });
});
