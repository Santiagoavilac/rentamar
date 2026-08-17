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
  propertyRatesSchema,
  weekendPricingSchema,
} from "./validation";

describe("validación administrativa", () => {
  it("acepta la lista de tarifas del editor completo y rechaza rangos al revés", () => {
    const fila = {
      id: null,
      startDate: "2026-12-24",
      endDate: "2026-12-26",
      price: "850.00",
      minimumNights: null,
      label: "Navidad",
    };
    expect(propertyRatesSchema.safeParse([fila]).success).toBe(true);
    expect(
      propertyRatesSchema.safeParse([
        { ...fila, id: "a1111111-1111-4111-8111-111111111111", minimumNights: 2 },
      ]).success,
    ).toBe(true);
    // minimumNights tiene que llegar numérico, no como el string del input.
    expect(propertyRatesSchema.safeParse([{ ...fila, minimumNights: "" }]).success).toBe(false);
    expect(
      propertyRatesSchema.safeParse([{ ...fila, startDate: "2026-12-26", endDate: "2026-12-24" }])
        .success,
    ).toBe(false);
  });

  it("valida los días y el recargo de fin de semana", () => {
    expect(weekendPricingSchema.safeParse({ days: [5, 6], surchargePercent: 30 }).success).toBe(
      true,
    );
    expect(weekendPricingSchema.safeParse({ days: [], surchargePercent: 0 }).success).toBe(true);
    expect(weekendPricingSchema.safeParse({ days: [8], surchargePercent: 10 }).success).toBe(false);
    expect(weekendPricingSchema.safeParse({ days: [5], surchargePercent: -5 }).success).toBe(false);
  });

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
