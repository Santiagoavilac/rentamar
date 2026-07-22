import { describe, expect, it } from "vitest";
import {
  clampScale,
  clampTranslate,
  clampUnit,
  normalizedToPixel,
  pixelToNormalized,
  zoomToPoint,
} from "./coords";

describe("coords", () => {
  it("recorta al rango unitario en 0 y 1", () => {
    expect(clampUnit(-0.5)).toBe(0);
    expect(clampUnit(0)).toBe(0);
    expect(clampUnit(1)).toBe(1);
    expect(clampUnit(1.7)).toBe(1);
    expect(clampUnit(0.42)).toBe(0.42);
    expect(clampUnit(NaN)).toBe(0);
  });

  it("convierte normalizado -> píxel", () => {
    expect(normalizedToPixel(0.5, 800)).toBe(400);
    expect(normalizedToPixel(0, 800)).toBe(0);
    expect(normalizedToPixel(1, 800)).toBe(800);
  });

  it("hace ida y vuelta normalizado <-> píxel", () => {
    const size = 1280;
    for (const unit of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      const px = normalizedToPixel(unit, size);
      expect(pixelToNormalized(px, size)).toBeCloseTo(unit, 10);
    }
  });

  it("pixelToNormalized recorta fuera de rango y evita división por cero", () => {
    expect(pixelToNormalized(-40, 800)).toBe(0);
    expect(pixelToNormalized(1600, 800)).toBe(1);
    expect(pixelToNormalized(100, 0)).toBe(0);
  });

  it("clampScale recorta al rango [min, max]", () => {
    expect(clampScale(0.2, 1, 6)).toBe(1);
    expect(clampScale(9, 1, 6)).toBe(6);
    expect(clampScale(3, 1, 6)).toBe(3);
    expect(clampScale(NaN, 1, 6)).toBe(1);
  });

  it("zoomToPoint deja fijo el punto bajo el cursor", () => {
    // Con tx=ty=0, scale=1: el punto (200,100) debe seguir apuntando al mismo local.
    const { tx, ty } = zoomToPoint(1, 0, 0, 2, 200, 100);
    // local = (200-0)/1 = 200; tras zoom: screen = tx + 2*local ⇒ 200 = tx + 400 ⇒ tx = -200
    expect(tx).toBe(-200);
    expect(ty).toBe(-100);
  });

  it("zoomToPoint sin cambio de escala no mueve la traslación", () => {
    expect(zoomToPoint(2, -50, -30, 2, 123, 45)).toEqual({ tx: -50, ty: -30 });
  });

  it("clampTranslate mantiene la imagen dentro de los bordes", () => {
    // scale=1 ⇒ único valor posible es 0 (sin paneo).
    expect(clampTranslate(120, -80, 1, 800, 600)).toEqual({ tx: 0, ty: 0 });
    // scale=2, viewport 800x600 ⇒ tx ∈ [-800, 0], ty ∈ [-600, 0].
    expect(clampTranslate(50, -900, 2, 800, 600)).toEqual({ tx: 0, ty: -600 });
    expect(clampTranslate(-400, -300, 2, 800, 600)).toEqual({ tx: -400, ty: -300 });
  });
});
