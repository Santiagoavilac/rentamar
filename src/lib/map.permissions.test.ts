import { describe, expect, it } from "vitest";
import { canPerformAdminAction } from "./permissions";

describe("permisos del mapa", () => {
  it("admin puede gestionar y publicar", () => {
    expect(canPerformAdminAction("admin", "map.manage")).toBe(true);
    expect(canPerformAdminAction("admin", "map.publish")).toBe(true);
  });

  it("operator puede gestionar y publicar (no son acciones admin-only)", () => {
    expect(canPerformAdminAction("operator", "map.manage")).toBe(true);
    expect(canPerformAdminAction("operator", "map.publish")).toBe(true);
  });

  it("operator sigue sin poder cambiar roles (control de regresión)", () => {
    expect(canPerformAdminAction("operator", "role.change")).toBe(false);
  });
});
