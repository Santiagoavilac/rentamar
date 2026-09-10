import { describe, expect, it } from "vitest";
import {
  isPropertyClass,
  propertyClassLabel,
  propertyClassRank,
  PROPERTY_CLASSES,
} from "./property-classes";

describe("clases de inmueble", () => {
  it("ordena de la mejor a la más económica", () => {
    expect(propertyClassRank("lujo")).toBeLessThan(propertyClassRank("a"));
    expect(propertyClassRank("a")).toBeLessThan(propertyClassRank("b"));
    expect(propertyClassRank("b")).toBeLessThan(propertyClassRank("c"));
  });

  it("manda las sin clasificar al final, no al principio", () => {
    expect(propertyClassRank(null)).toBeGreaterThan(propertyClassRank("c"));
    expect(propertyClassRank("premium")).toBeGreaterThan(propertyClassRank("c"));
  });

  it("no inventa un nombre para una clase que no existe", () => {
    expect(propertyClassLabel(null)).toBeNull();
    expect(propertyClassLabel("")).toBeNull();
    expect(propertyClassLabel("A")).toBeNull();
    expect(propertyClassLabel("lujo")).toBe("Lujo");
  });

  it("reconoce exactamente los valores del enum de la base", () => {
    expect([...PROPERTY_CLASSES]).toEqual(["lujo", "a", "b", "c"]);
    for (const value of PROPERTY_CLASSES) expect(isPropertyClass(value)).toBe(true);
    expect(isPropertyClass("d")).toBe(false);
  });
});
