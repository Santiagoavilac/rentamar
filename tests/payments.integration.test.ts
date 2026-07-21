import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LAGUNA = "a1111111-1111-4111-8111-111111111111"; // min_nights 2, base 52000
const MARKER = "ptest@rentamar.test";

const run = url && anonKey && serviceKey ? describe : describe.skip;

run("integración pagos (Fase 2)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let dayCursor = 100;

  // Rango de fechas único por reserva para evitar solapes entre casos.
  const nextDates = () => {
    const base = new Date();
    base.setUTCFullYear(base.getUTCFullYear() + 1);
    const start = new Date(base);
    start.setUTCDate(start.getUTCDate() + dayCursor);
    const end = new Date(base);
    end.setUTCDate(end.getUTCDate() + dayCursor + 3);
    dayCursor += 10;
    return { checkIn: start.toISOString().slice(0, 10), checkOut: end.toISOString().slice(0, 10) };
  };

  const createBooking = async (): Promise<{ bookingId: string; totalMinor: number }> => {
    const { checkIn, checkOut } = nextDates();
    const { data, error } = await admin.rpc("create_booking_with_hold", {
      p_property_id: LAGUNA,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guest_count: 2,
      p_guest_name: "Payment Test",
      p_guest_email: MARKER,
      p_guest_phone: "70000000",
      p_access_token_hash: createHash("sha256").update("secret-token").digest("hex"),
      p_hold_minutes: 30,
    });
    if (error) throw new Error(error.message);
    return { bookingId: data.bookingId, totalMinor: data.totalMinor };
  };

  const intent = (bookingId: string, expiresAt: string) =>
    admin.rpc("create_payment_intent", {
      p_booking_id: bookingId,
      p_provider: "mock",
      p_provider_mode: "sandbox",
      p_method: "qr",
      p_idempotency_key: `k_${Math.random().toString(36).slice(2)}`,
      p_expires_at: expiresAt,
    });

  const future = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
  const past = () => new Date(Date.now() - 60_000).toISOString();

  const getHold = async (bookingId: string) => {
    const { data } = await admin
      .from("booking_holds")
      .select("id, status")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    await admin.from("bookings").delete().eq("guest_email", MARKER);
  });

  afterAll(async () => {
    await admin.from("bookings").delete().eq("guest_email", MARKER);
  });

  describe("creación e idempotencia", () => {
    it("crea un pago usando total_minor de la reserva", async () => {
      const { bookingId, totalMinor } = await createBooking();
      const { data, error } = await intent(bookingId, future(20));
      expect(error).toBeNull();
      expect(data.isNew).toBe(true);

      const { data: pay } = await admin
        .from("payments")
        .select("amount_minor, status, currency")
        .eq("id", data.paymentId)
        .single();
      expect(pay!.amount_minor).toBe(totalMinor);
      expect(pay!.status).toBe("created");
      expect(pay!.currency).toBe("BOB");
    });

    it("reutiliza el pago activo ante retry (mismo paymentId)", async () => {
      const { bookingId } = await createBooking();
      const first = await intent(bookingId, future(20));
      const second = await intent(bookingId, future(20));
      expect(first.data.isNew).toBe(true);
      expect(second.data.isNew).toBe(false);
      expect(second.data.paymentId).toBe(first.data.paymentId);
    });

    it("dos creaciones simultáneas producen un solo pago activo", async () => {
      const { bookingId } = await createBooking();
      const [a, b] = await Promise.all([
        intent(bookingId, future(20)),
        intent(bookingId, future(20)),
      ]);
      // Ninguna falla y ambas apuntan al mismo pago.
      expect(a.error).toBeNull();
      expect(b.error).toBeNull();
      expect(a.data.paymentId).toBe(b.data.paymentId);

      const { data: rows } = await admin
        .from("payments")
        .select("id")
        .eq("booking_id", bookingId)
        .in("status", ["created", "pending"]);
      expect((rows ?? []).length).toBe(1);
    });

    it("no crea pago para una reserva expirada", async () => {
      const { bookingId } = await createBooking();
      await admin.from("bookings").update({ status: "expired" }).eq("id", bookingId);
      const { error } = await intent(bookingId, future(20));
      expect(error?.message).toContain("PAYMENT_INVALID_STATE");
    });
  });

  describe("confirmación transaccional", () => {
    it("confirma la reserva y convierte el hold", async () => {
      const { bookingId } = await createBooking();
      const { data: i } = await intent(bookingId, future(20));
      const { data: result, error } = await admin.rpc("confirm_booking_payment", {
        p_payment_id: i.paymentId,
      });
      expect(error).toBeNull();
      expect(result.ok).toBe(true);
      expect(result.bookingStatus).toBe("confirmed");

      const { data: booking } = await admin
        .from("bookings")
        .select("status, payment_status")
        .eq("id", bookingId)
        .single();
      expect(booking!.status).toBe("confirmed");
      expect(booking!.payment_status).toBe("paid");

      const hold = await getHold(bookingId);
      expect(hold!.status).toBe("converted");
    });

    it("es idempotente ante doble confirmación", async () => {
      const { bookingId } = await createBooking();
      const { data: i } = await intent(bookingId, future(20));
      const one = await admin.rpc("confirm_booking_payment", { p_payment_id: i.paymentId });
      const two = await admin.rpc("confirm_booking_payment", { p_payment_id: i.paymentId });
      expect(one.data.ok).toBe(true);
      expect(two.data.ok).toBe(true);

      const { data: events } = await admin
        .from("payment_events")
        .select("id")
        .eq("payment_id", i.paymentId)
        .eq("event_type", "payment_confirmed");
      expect((events ?? []).length).toBe(1);
    });

    it("dos confirmaciones simultáneas producen una sola transición", async () => {
      const { bookingId } = await createBooking();
      const { data: i } = await intent(bookingId, future(20));
      const [a, b] = await Promise.all([
        admin.rpc("confirm_booking_payment", { p_payment_id: i.paymentId }),
        admin.rpc("confirm_booking_payment", { p_payment_id: i.paymentId }),
      ]);
      expect(a.data.ok).toBe(true);
      expect(b.data.ok).toBe(true);

      const { data: events } = await admin
        .from("payment_events")
        .select("id")
        .eq("payment_id", i.paymentId)
        .eq("event_type", "payment_confirmed");
      expect((events ?? []).length).toBe(1);
    });

    it("ante mismatch de monto marca manual_review sin confirmar", async () => {
      const { bookingId } = await createBooking();
      const { data: i } = await intent(bookingId, future(20));
      await admin.from("payments").update({ amount_minor: 1 }).eq("id", i.paymentId);

      const { data: result } = await admin.rpc("confirm_booking_payment", {
        p_payment_id: i.paymentId,
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("PAYMENT_AMOUNT_MISMATCH");

      const { data: booking } = await admin
        .from("bookings")
        .select("status")
        .eq("id", bookingId)
        .single();
      expect(booking!.status).toBe("manual_review");

      const hold = await getHold(bookingId);
      expect(hold!.status).toBe("active"); // no se convirtió
    });

    it("no confirma si el hold está vencido", async () => {
      const { bookingId } = await createBooking();
      const { data: i } = await intent(bookingId, future(20));
      await admin.from("booking_holds").update({ expires_at: past() }).eq("booking_id", bookingId);

      const { error } = await admin.rpc("confirm_booking_payment", { p_payment_id: i.paymentId });
      expect(error?.message).toContain("PAYMENT_INVALID_STATE");
    });
  });

  describe("expiración", () => {
    it("expira el pago y libera el hold cuando no hay otro pago activo", async () => {
      const { bookingId } = await createBooking();
      const { data: i } = await intent(bookingId, past());

      const { data: ok } = await admin.rpc("expire_payment", { p_payment_id: i.paymentId });
      expect(ok).toBe(true);

      const { data: pay } = await admin
        .from("payments")
        .select("status")
        .eq("id", i.paymentId)
        .single();
      expect(pay!.status).toBe("expired");

      const { data: booking } = await admin
        .from("bookings")
        .select("status, payment_status")
        .eq("id", bookingId)
        .single();
      expect(booking!.status).toBe("expired");
      expect(booking!.payment_status).toBe("expired");

      const hold = await getHold(bookingId);
      expect(hold!.status).toBe("expired");
    });

    it("expire_stale_holds NO toca reservas con pago activo", async () => {
      const { bookingId } = await createBooking();
      await intent(bookingId, future(20)); // pago activo
      await admin.from("booking_holds").update({ expires_at: past() }).eq("booking_id", bookingId);

      await admin.rpc("expire_stale_holds");

      const hold = await getHold(bookingId);
      expect(hold!.status).toBe("active"); // gobernado por expire_stale_payments, no por holds
    });
  });

  describe("seguridad RLS", () => {
    it("anon no lee payments", async () => {
      const { bookingId } = await createBooking();
      await intent(bookingId, future(20));
      const { data } = await anon.from("payments").select("id");
      expect((data ?? []).length).toBe(0);
    });

    it("anon no lee payment_events", async () => {
      const { data } = await anon.from("payment_events").select("id");
      expect((data ?? []).length).toBe(0);
    });

    it("anon no lee mock_payment_state", async () => {
      const { data } = await anon.from("mock_payment_state").select("external_id");
      expect((data ?? []).length).toBe(0);
    });

    it("anon no puede ejecutar create_payment_intent", async () => {
      const { error } = await anon.rpc("create_payment_intent", {
        p_booking_id: LAGUNA,
        p_provider: "mock",
        p_provider_mode: "sandbox",
        p_method: "qr",
        p_idempotency_key: "x",
        p_expires_at: future(20),
      });
      expect(error).not.toBeNull();
    });

    it("anon no puede ejecutar confirm_booking_payment", async () => {
      const { error } = await anon.rpc("confirm_booking_payment", {
        p_payment_id: "a1111111-1111-4111-8111-111111111111",
      });
      expect(error).not.toBeNull();
    });
  });
});
