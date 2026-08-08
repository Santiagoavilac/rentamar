import { describe, expect, it } from "vitest";
import { canPerformAdminAction } from "./permissions";

describe("permisos del módulo de disponibilidad", () => {
  it("permite al operator pre-reservas, bloqueos, exportación y edición no pagada", () => {
    expect(canPerformAdminAction("operator", "booking.create")).toBe(true);
    expect(canPerformAdminAction("operator", "booking.edit")).toBe(true);
    expect(canPerformAdminAction("operator", "availability.manage")).toBe(true);
    expect(canPerformAdminAction("operator", "availability.export")).toBe(true);
  });

  it("reserva la confirmación manual para admin", () => {
    expect(canPerformAdminAction("operator", "booking.confirm_manual")).toBe(false);
    expect(canPerformAdminAction("admin", "booking.confirm_manual")).toBe(true);
  });

  it("reserva la gestión de limpieza para admin", () => {
    expect(canPerformAdminAction("operator", "cleaning.manage")).toBe(false);
    expect(canPerformAdminAction("admin", "cleaning.manage")).toBe(true);
  });
});
