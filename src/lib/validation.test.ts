import { describe, it, expect } from "vitest";
import { quoteSchema, createBookingSchema } from "./validation";

describe("quoteSchema", () => {
  const base = {
    propertyId: "a1111111-1111-4111-8111-111111111111",
    checkIn: "2026-08-10",
    checkOut: "2026-08-13",
    guestCount: 4,
  };

  it("acepta un quote válido", () => {
    expect(quoteSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza UUID inválido", () => {
    expect(quoteSchema.safeParse({ ...base, propertyId: "no-uuid" }).success).toBe(false);
  });

  it("rechaza checkOut <= checkIn", () => {
    expect(quoteSchema.safeParse({ ...base, checkOut: "2026-08-10" }).success).toBe(false);
  });

  it("rechaza guestCount < 1", () => {
    expect(quoteSchema.safeParse({ ...base, guestCount: 0 }).success).toBe(false);
  });

  it("rechaza formato de fecha inválido", () => {
    expect(quoteSchema.safeParse({ ...base, checkIn: "10/08/2026" }).success).toBe(false);
  });
});

describe("createBookingSchema", () => {
  const valid = {
    propertyId: "a1111111-1111-4111-8111-111111111111",
    checkIn: "2026-08-10",
    checkOut: "2026-08-13",
    guestCount: 2,
    guest: {
      name: "Ana",
      email: "ana@example.com",
      phone: "70000000",
      documentId: "8452317",
      nationality: "Boliviana",
      city: "Santa Cruz",
    },
  };

  it("acepta reserva válida", () => {
    expect(createBookingSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza email inválido", () => {
    const bad = { ...valid, guest: { ...valid.guest, email: "no-email" } };
    expect(createBookingSchema.safeParse(bad).success).toBe(false);
  });

  it("no acepta montos del cliente (mass assignment)", () => {
    const withTotal = { ...valid, totalMinor: 1 } as Record<string, unknown>;
    const result = createBookingSchema.safeParse(withTotal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect("totalMinor" in result.data).toBe(false);
    }
  });
});
