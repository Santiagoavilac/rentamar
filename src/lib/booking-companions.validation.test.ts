import { describe, expect, it } from "vitest";
import { createBookingSchema } from "./validation";

const base = {
  propertyId: "11111111-1111-4111-8111-111111111111",
  checkIn: "2026-10-01",
  checkOut: "2026-10-04",
  guestCount: 3,
  guest: {
    name: "Raúl Pazbauer",
    email: "raul@example.com",
    documentId: "1234567-1B",
    nationality: "Boliviana",
    city: "Santa Cruz",
  },
};

describe("acompañantes en el canal directo", () => {
  it("una reserva sin acompañantes sigue siendo válida", () => {
    const parsed = createBookingSchema.parse(base);
    expect(parsed.companions).toEqual([]);
  });

  it("acepta acompañantes con nombre y carnet", () => {
    const parsed = createBookingSchema.parse({
      ...base,
      companions: [{ fullName: "Ana Suárez", documentId: "7654321" }],
    });
    expect(parsed.companions).toHaveLength(1);
  });

  it("no deja cargar más acompañantes que huéspedes: el titular ocupa un lugar", () => {
    const result = createBookingSchema.safeParse({
      ...base,
      guestCount: 2,
      companions: [
        { fullName: "Ana Suárez", documentId: "7654321" },
        { fullName: "Luis Roca", documentId: "7654322" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un acompañante sin carnet: recepción no lo puede registrar", () => {
    const result = createBookingSchema.safeParse({
      ...base,
      companions: [{ fullName: "Ana Suárez", documentId: "" }],
    });
    expect(result.success).toBe(false);
  });
});
