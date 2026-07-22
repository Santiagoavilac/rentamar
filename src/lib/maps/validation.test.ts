import { describe, expect, it } from "vitest";
import { mapItemInputSchema, mapItemMoveSchema, mapCreateSchema } from "../validation";

const base = {
  type: "house",
  name: "Casa 1",
  description: "",
  normalizedX: 0.5,
  normalizedY: 0.5,
  normalizedWidth: 0.04,
  normalizedHeight: 0.04,
  rotation: 0,
  isVisible: true,
  linkedPropertyId: null,
};

describe("validación de marcadores del mapa", () => {
  it("acepta un marcador válido", () => {
    expect(mapItemInputSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza coordenadas fuera de 0..1", () => {
    expect(mapItemInputSchema.safeParse({ ...base, normalizedX: 1.2 }).success).toBe(false);
    expect(mapItemInputSchema.safeParse({ ...base, normalizedY: -0.1 }).success).toBe(false);
  });

  it("rechaza ancho/alto de 0 o mayores a 1", () => {
    expect(mapItemInputSchema.safeParse({ ...base, normalizedWidth: 0 }).success).toBe(false);
    expect(mapItemInputSchema.safeParse({ ...base, normalizedHeight: 1.5 }).success).toBe(false);
  });

  it("rechaza tipos inválidos", () => {
    expect(mapItemInputSchema.safeParse({ ...base, type: "castle" }).success).toBe(false);
  });

  it("rechaza un linkedPropertyId que no es uuid", () => {
    expect(mapItemInputSchema.safeParse({ ...base, linkedPropertyId: "abc" }).success).toBe(false);
  });

  it("el movimiento solo admite coordenadas unitarias", () => {
    expect(mapItemMoveSchema.safeParse({ normalizedX: 0.2, normalizedY: 0.9 }).success).toBe(true);
    expect(mapItemMoveSchema.safeParse({ normalizedX: 2, normalizedY: 0.9 }).success).toBe(false);
  });

  it("el alta de mapa exige slug válido", () => {
    expect(mapCreateSchema.safeParse({ slug: "mar-adentro", name: "Mar Adentro" }).success).toBe(
      true,
    );
    expect(mapCreateSchema.safeParse({ slug: "Mar Adentro", name: "x" }).success).toBe(false);
  });
});
