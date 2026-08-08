import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// El test crea su propia propiedad para no depender de datos semilla.
const SLUG = "afiliados-integration-fixture";
const NIGHTLY_MINOR = 25_000;
const BASE_MINOR = 40_000;

describe.runIf(Boolean(url && anonKey && serviceKey))("affiliate booking RPC", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let propertyId: string;

  const request = (overrides: Record<string, unknown> = {}) =>
    anon.rpc("create_affiliate_booking_request", {
      p_property_id: propertyId,
      p_check_in: "2031-04-10",
      p_check_out: "2031-04-13",
      p_guest_count: 2,
      p_affiliate_name: "Ana Integration",
      p_affiliate_document_id: "AF-INT-1",
      p_affiliate_phone: "78013406",
      p_affiliate_email: null,
      p_companions: [{ fullName: "Luis Integration", documentId: "AF-INT-2" }],
      ...overrides,
    });

  const clearBookings = () =>
    admin.from("bookings").delete().eq("property_id", propertyId).eq("channel", "affiliate");

  // La propiedad no se puede borrar mientras tenga reservas, así que la purga
  // arranca por las filas hijas. Sin esto un test fallido deja el fixture vivo y
  // la corrida siguiente choca contra properties_slug_key.
  const purgeFixture = async () => {
    const { data } = await admin.from("properties").select("id").eq("slug", SLUG).maybeSingle();
    if (!data) return;
    await admin.from("bookings").delete().eq("property_id", data.id);
    await admin.from("availability_blocks").delete().eq("property_id", data.id);
    await admin.from("property_rates").delete().eq("property_id", data.id);
    await admin.from("property_stay_prices").delete().eq("property_id", data.id);
    await admin.from("properties").delete().eq("id", data.id);
  };

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    await purgeFixture();
    const { data, error } = await admin
      .from("properties")
      .insert({
        name: "Fixture Afiliados",
        slug: SLUG,
        status: "published",
        max_guests: 6,
        base_price_minor: BASE_MINOR,
        minimum_nights: 1,
        affiliate_nightly_price_minor: NIGHTLY_MINOR,
      })
      .select("id")
      .single();
    if (error) throw error;
    propertyId = data.id;
  });

  afterAll(purgeFixture);

  it("aplica tarifa plana, deja hold activo y guarda acompañantes", async () => {
    await clearBookings();
    const { data, error } = await request();
    expect(error).toBeNull();
    const result = data as {
      bookingId: string;
      nights: number;
      totalMinor: number;
      nightlyMinor: number;
    };
    expect(result.nights).toBe(3);
    expect(result.totalMinor).toBe(NIGHTLY_MINOR * 3);

    const { data: booking } = await admin
      .from("bookings")
      .select("channel, status, payment_status, guest_email, affiliate_document_id")
      .eq("id", result.bookingId)
      .single();
    expect(booking?.channel).toBe("affiliate");
    expect(booking?.status).toBe("pending_payment");
    expect(booking?.guest_email).toBeNull();

    const { data: hold } = await admin
      .from("booking_holds")
      .select("status, expires_at")
      .eq("booking_id", result.bookingId)
      .single();
    expect(hold?.status).toBe("active");
    // El bloqueo vive hasta la hora de salida, no unos minutos.
    expect(new Date(hold!.expires_at).getFullYear()).toBe(2031);

    const { data: companions } = await admin
      .from("booking_companions")
      .select("full_name, sort_order")
      .eq("booking_id", result.bookingId);
    expect(companions).toHaveLength(1);
    expect(companions![0].full_name).toBe("Luis Integration");
  });

  it("rechaza una segunda solicitud solapada", async () => {
    await clearBookings();
    expect((await request()).error).toBeNull();
    const overlap = await request({
      p_affiliate_document_id: "AF-INT-9",
      p_affiliate_phone: "78013499",
      p_check_in: "2031-04-11",
      p_check_out: "2031-04-14",
    });
    expect(overlap.error?.message).toContain("BOOKING_CONFLICT");
  });

  it("ignora tarifas estacionales y precios por duración", async () => {
    await clearBookings();
    await admin.from("property_rates").insert({
      property_id: propertyId,
      start_date: "2031-04-01",
      end_date: "2031-05-01",
      nightly_price_minor: 99_000,
      label: "afiliados-integration",
    });
    await admin
      .from("properties")
      .update({ duration_pricing_enabled: true })
      .eq("id", propertyId);
    await admin.from("property_stay_prices").insert({
      property_id: propertyId,
      nights: 3,
      total_price_minor: 10_000,
    });

    const { data, error } = await request();
    expect(error).toBeNull();
    expect((data as { totalMinor: number }).totalMinor).toBe(NIGHTLY_MINOR * 3);

    await admin.from("property_rates").delete().eq("property_id", propertyId);
    await admin.from("property_stay_prices").delete().eq("property_id", propertyId);
    await admin
      .from("properties")
      .update({ duration_pricing_enabled: false })
      .eq("id", propertyId);
  });

  it("frena al superar el tope de solicitudes pendientes con el mismo CI", async () => {
    await clearBookings();
    for (const [checkIn, checkOut] of [
      ["2031-06-01", "2031-06-03"],
      ["2031-06-05", "2031-06-07"],
      ["2031-06-10", "2031-06-12"],
    ]) {
      const attempt = await request({ p_check_in: checkIn, p_check_out: checkOut });
      expect(attempt.error).toBeNull();
    }
    const blocked = await request({ p_check_in: "2031-06-20", p_check_out: "2031-06-22" });
    expect(blocked.error?.message).toContain("AFFILIATE_PENDING_LIMIT");
  });

  // Sin precio de reserva cargado la propiedad se lista igual, pero no se puede reservar.
  it("rechaza propiedades sin precio de afiliado", async () => {
    await clearBookings();
    await admin
      .from("properties")
      .update({ affiliate_nightly_price_minor: null })
      .eq("id", propertyId);
    const attempt = await request();
    expect(attempt.error?.message).toContain("AFFILIATE_DISABLED");
    await admin
      .from("properties")
      .update({ affiliate_nightly_price_minor: NIGHTLY_MINOR })
      .eq("id", propertyId);
  });

  it("confirma dejando el pago pendiente y cancela liberando las fechas", async () => {
    await clearBookings();
    const created = await request();
    const bookingId = (created.data as { bookingId: string }).bookingId;

    const confirmed = await admin.rpc("confirm_booking_manual", {
      p_booking_id: bookingId,
      p_reason: "Acordado por WhatsApp",
      p_actor_id: null,
      p_source: "admin",
    });
    expect(confirmed.error).toBeNull();
    const { data: afterConfirm } = await admin
      .from("bookings")
      .select("status, payment_status")
      .eq("id", bookingId)
      .single();
    expect(afterConfirm?.status).toBe("confirmed");
    // El afiliado no paga por la pasarela: confirmar no puede marcarlo como pagado.
    expect(afterConfirm?.payment_status).toBe("unpaid");

    const cancelled = await admin.rpc("cancel_booking", {
      p_booking_id: bookingId,
      p_reason: "El afiliado desistió",
      p_actor_id: null,
      p_source: "admin",
    });
    expect(cancelled.error).toBeNull();

    const { data: occupied } = await anon.rpc("get_property_availability", {
      p_property_id: propertyId,
      p_from: "2031-04-01",
      p_to: "2031-05-01",
    });
    expect(occupied ?? []).toHaveLength(0);
  });
});
