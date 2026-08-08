import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  currentMonthRange,
  dateRange,
  daysBetween,
  parsePlannerQuery,
  todayInLaPaz,
} from "./planner-query";

describe("planner query", () => {
  it("mantiene rangos semiabiertos y permite rotación el mismo día", () => {
    expect(dateRange("2026-07-26", "2026-07-29")).toEqual([
      "2026-07-26",
      "2026-07-27",
      "2026-07-28",
    ]);
    expect(daysBetween("2026-07-26", "2026-07-29")).toBe(3);
    expect(addDaysIso("2026-07-31", 1)).toBe("2026-08-01");
  });

  it("limita el rango visual a 62 días", () => {
    const query = parsePlannerQuery({ from: "2026-01-01", to: "2026-12-31" });
    expect(daysBetween(query.from, query.to)).toBe(62);
  });

  it("calcula hoy y el mes usando America/La_Paz", () => {
    const instant = new Date("2026-07-27T02:00:00Z");
    expect(todayInLaPaz(instant)).toBe("2026-07-26");
    expect(currentMonthRange(instant)).toEqual({ from: "2026-07-01", to: "2026-08-01" });
  });
});
