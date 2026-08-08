import { describe, expect, it } from "vitest";
import { USERNAME_PATTERN, coOwnerEmail, normalizeUsername } from "./co-owners";
import { coOwnerAccountSchema, coOwnerStaySchema } from "./validation";

describe("normalizeUsername", () => {
  it("recorta y pasa a minúsculas", () => {
    expect(normalizeUsername("  Juan.Perez  ")).toBe("juan.perez");
  });
});

describe("USERNAME_PATTERN", () => {
  it("acepta minúsculas, números, punto, guion y guion bajo", () => {
    for (const value of ["juan.perez", "unidad_4b", "a1-2", "abc"]) {
      expect(USERNAME_PATTERN.test(value)).toBe(true);
    }
  });

  it("rechaza mayúsculas, espacios, muy corto y símbolos", () => {
    for (const value of ["Juan", "juan perez", "ab", "juan@perez", ".juan"]) {
      expect(USERNAME_PATTERN.test(value)).toBe(false);
    }
  });
});

describe("coOwnerEmail", () => {
  it("es determinístico e independiente del formato ingresado", () => {
    expect(coOwnerEmail("  Juan.Perez ")).toBe("juan.perez@copropietarios.local");
    expect(coOwnerEmail("juan.perez")).toBe(coOwnerEmail("JUAN.PEREZ"));
  });
});

describe("coOwnerAccountSchema", () => {
  const valid = {
    username: "juan.perez",
    password: "clave-larga-1",
    propertyName: "Edificio Coral",
    roomCount: "3",
  };

  it("normaliza el usuario y convierte las habitaciones a número", () => {
    const parsed = coOwnerAccountSchema.parse({ ...valid, username: " Juan.Perez " });
    expect(parsed.username).toBe("juan.perez");
    expect(parsed.roomCount).toBe(3);
  });

  it("exige propiedad y al menos una habitación", () => {
    expect(coOwnerAccountSchema.safeParse({ ...valid, propertyName: "  " }).success).toBe(false);
    expect(coOwnerAccountSchema.safeParse({ ...valid, roomCount: "0" }).success).toBe(false);
  });
});

const validStay = {
  fullName: "Ana Gómez",
  documentId: "1234567",
  phone: "70011223",
  birthDate: "1990-05-14",
  nationality: "Boliviana",
  city: "Santa Cruz",
  checkInDate: "2026-08-01",
  checkInTime: "14:00",
  checkOutDate: "2026-08-03",
  checkOutTime: "10:00",
  guests: [
    { fullName: "Luis Gómez", documentId: "7654321", phone: "70099887", birthDate: "1992-01-02" },
  ],
  minors: "1",
};

describe("coOwnerStaySchema", () => {
  it("compone fecha y hora en timestamps con el offset de Bolivia", () => {
    const parsed = coOwnerStaySchema.parse(validStay);
    expect(parsed.checkInAt).toBe("2026-08-01T14:00:00-04:00");
    expect(parsed.checkOutAt).toBe("2026-08-03T10:00:00-04:00");
    expect(parsed.guests).toHaveLength(1);
    expect(parsed.minors).toBe(1);
  });

  it("rechaza una salida anterior o igual a la entrada", () => {
    const sameMoment = { ...validStay, checkOutDate: "2026-08-01", checkOutTime: "14:00" };
    expect(coOwnerStaySchema.safeParse(sameMoment).success).toBe(false);
    const before = { ...validStay, checkOutDate: "2026-07-31" };
    expect(coOwnerStaySchema.safeParse(before).success).toBe(false);
  });

  it("no admite menores negativos", () => {
    expect(coOwnerStaySchema.safeParse({ ...validStay, minors: "-1" }).success).toBe(false);
  });

  it("acepta cero menores", () => {
    const parsed = coOwnerStaySchema.parse({ ...validStay, minors: "0" });
    expect(parsed.minors).toBe(0);
  });

  it("acepta una estadía sin huéspedes adicionales", () => {
    const parsed = coOwnerStaySchema.parse({ ...validStay, guests: [] });
    expect(parsed.guests).toEqual([]);
  });

  it("rechaza fechas de nacimiento futuras", () => {
    expect(coOwnerStaySchema.safeParse({ ...validStay, birthDate: "2999-01-01" }).success).toBe(
      false,
    );
    const futureGuest = [{ ...validStay.guests[0], birthDate: "2999-01-01" }];
    expect(coOwnerStaySchema.safeParse({ ...validStay, guests: futureGuest }).success).toBe(false);
  });

  it("rechaza un huésped sin CI", () => {
    const badGuest = [{ ...validStay.guests[0], documentId: "" }];
    expect(coOwnerStaySchema.safeParse({ ...validStay, guests: badGuest }).success).toBe(false);
  });
});
