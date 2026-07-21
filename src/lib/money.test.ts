import { describe, it, expect } from "vitest";
import { minorToDecimalString, decimalStringToMinor, formatCurrency } from "./money";

describe("money helpers", () => {
  it("convierte minor a string decimal", () => {
    expect(minorToDecimalString(50000)).toBe("500.00");
    expect(minorToDecimalString(52050)).toBe("520.50");
    expect(minorToDecimalString(5)).toBe("0.05");
    expect(minorToDecimalString(0)).toBe("0.00");
    expect(minorToDecimalString(-1250)).toBe("-12.50");
  });

  it("convierte string decimal a minor", () => {
    expect(decimalStringToMinor("500")).toBe(50000);
    expect(decimalStringToMinor("520.50")).toBe(52050);
    expect(decimalStringToMinor("0.05")).toBe(5);
    expect(decimalStringToMinor("-12.5")).toBe(-1250);
  });

  it("rechaza decimales inválidos", () => {
    expect(() => decimalStringToMinor("12.345")).toThrow();
    expect(() => decimalStringToMinor("abc")).toThrow();
  });

  it("round-trip minor -> string -> minor", () => {
    for (const v of [0, 5, 100, 52050, 145000]) {
      expect(decimalStringToMinor(minorToDecimalString(v))).toBe(v);
    }
  });

  it("formatea moneda BOB", () => {
    expect(formatCurrency(52000, "BOB")).toBe("Bs 520,00");
  });
});
