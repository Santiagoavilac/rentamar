import { describe, expect, it } from "vitest";
import {
  adminBookingInputSchema,
  availabilityBlockInputSchema,
  bookingOpSchema,
  cleaningReportSchema,
  createUserInputSchema,
  entityIdSchema,
  propertyInputSchema,
  propertyPricingInputSchema,
  rateInputSchema,
} from "./validation";

describe("validación administrativa", () => {
  it("exige vencimiento en pre-reserva y motivo en alquiler", () => {
    const base = {
      propertyId: "a1111111-1111-4111-8111-111111111111",
      checkIn: "2026-08-10",
      checkOut: "2026-08-12",
      guestCount: 2,
      guestName: "Ana Pérez",
      guestEmail: "ana@example.com",
      guestPhone: "",
    };
    expect(
      adminBookingInputSchema.safeParse({ ...base, kind: "pre_reservation", holdExpiresLocal: "" })
        .success,
    ).toBe(false);
    expect(
      adminBookingInputSchema.safeParse({
        ...base,
        kind: "rental",
        holdExpiresLocal: "",
        reason: "",
      }).success,
    ).toBe(false);
  });
  it("rechaza un bloqueo con rango inválido", () => {
    expect(
      availabilityBlockInputSchema.safeParse({
        propertyId: "a1111111-1111-4111-8111-111111111111",
        from: "2026-10-10",
        to: "2026-10-10",
        type: "manual",
        reason: "",
      }).success,
    ).toBe(false);
  });
  it("rechaza identificadores y operaciones manipuladas", () => {
    expect(entityIdSchema.safeParse("no-es-un-uuid").success).toBe(false);
    expect(bookingOpSchema.safeParse("confirm_manual_forzado").success).toBe(false);
  });
  it("no acepta campos privilegiados en la propiedad", () => {
    const result = propertyInputSchema.safeParse({
      name: "Casa",
      slug: "casa",
      towerId: null,
      status: "draft",
      featured: false,
      basePrice: "100.00",
      bedrooms: 1,
      bathrooms: 1,
      beds: 1,
      maxGuests: 2,
      minimumNights: 1,
      checkInTime: "15:00",
      checkOutTime: "11:00",
      id: "forged",
      created_at: "x",
    });
    expect(result.success).toBe(true);
    if (result.success) expect("id" in result.data).toBe(false);
  });
  it("requiere una contraseña fuerte para staff", () => {
    expect(
      createUserInputSchema.safeParse({
        email: "admin@example.com",
        password: "corta",
        fullName: "Admin Uno",
        role: "admin",
      }).success,
    ).toBe(false);
  });
  it("rechaza tarifas sin rango válido", () => {
    expect(
      rateInputSchema.safeParse({
        startDate: "2026-10-12",
        endDate: "2026-10-10",
        price: "200",
        minimumNights: null,
        label: "",
      }).success,
    ).toBe(false);
  });
  it("valida precios únicos y descuentos respecto al precio base", () => {
    const valid = {
      basePrice: "500.00",
      durationPricingEnabled: true,
      prices: [
        { nights: 2, total: "950.00" },
        { nights: 3, total: "1350.00" },
      ],
      reason: "Nueva promoción",
    };
    expect(propertyPricingInputSchema.safeParse(valid).success).toBe(true);
    expect(
      propertyPricingInputSchema.safeParse({
        ...valid,
        prices: [
          { nights: 2, total: "950.00" },
          { nights: 2, total: "900.00" },
        ],
      }).success,
    ).toBe(false);
    expect(
      propertyPricingInputSchema.safeParse({
        ...valid,
        prices: [{ nights: 2, total: "1100.00" }],
      }).success,
    ).toBe(false);
  });

  it("exige que la salida de limpieza sea posterior a la entrada", () => {
    const base = {
      propertyId: "a1111111-1111-4111-8111-111111111111",
      workDate: "2026-08-03",
      entryTime: "08:00",
      exitTime: "11:30",
    };
    expect(cleaningReportSchema.safeParse(base).success).toBe(true);
    expect(cleaningReportSchema.safeParse({ ...base, exitTime: "08:00" }).success).toBe(false);
    expect(cleaningReportSchema.safeParse({ ...base, exitTime: "07:30" }).success).toBe(false);
    expect(cleaningReportSchema.safeParse({ ...base, propertyId: "no-uuid" }).success).toBe(false);
  });
});
