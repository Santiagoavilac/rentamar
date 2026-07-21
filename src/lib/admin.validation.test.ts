import { describe, expect, it } from "vitest";
import {
  availabilityBlockInputSchema,
  createUserInputSchema,
  propertyInputSchema,
  rateInputSchema,
} from "./validation";

describe("validación administrativa", () => {
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
  it("no acepta campos privilegiados en la propiedad", () => {
    const result = propertyInputSchema.safeParse({
      name: "Casa",
      slug: "casa",
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
});
