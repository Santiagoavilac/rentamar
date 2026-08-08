import { describe, expect, it } from "vitest";
import {
  dateIsOccupied,
  nightsBetween,
  parsePostgresDateRange,
  stayOverlapsRange,
} from "./date-ranges";

describe("rangos exclusivos de disponibilidad", () => {
  const ranges = [{ from: "2026-08-10", to: "2026-08-13" }];

  it("interpreta un daterange de Postgres", () => {
    expect(parsePostgresDateRange('["2026-08-10","2026-08-13")')).toEqual(ranges[0]);
    expect(parsePostgresDateRange("valor-inválido")).toBeNull();
  });

  it("considera ocupadas las noches pero no la salida", () => {
    expect(dateIsOccupied("2026-08-10", ranges)).toBe(true);
    expect(dateIsOccupied("2026-08-12", ranges)).toBe(true);
    expect(dateIsOccupied("2026-08-13", ranges)).toBe(false);
  });

  it("permite una salida y una entrada el mismo día", () => {
    expect(stayOverlapsRange("2026-08-07", "2026-08-10", ranges)).toBe(false);
    expect(stayOverlapsRange("2026-08-13", "2026-08-15", ranges)).toBe(false);
    expect(stayOverlapsRange("2026-08-09", "2026-08-11", ranges)).toBe(true);
  });

  it("calcula noches sin incluir el check-out", () => {
    expect(nightsBetween("2026-08-10", "2026-08-13")).toBe(3);
  });
});
