import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABELS,
  describeAction,
  diffChangedFields,
  entityHref,
} from "./audit-labels";

// Vocabulario que escribe writeAudit hoy. Si se agrega una acción nueva sin etiqueta,
// este test la delata antes de que un admin vea el código crudo en pantalla.
const ACTIONS_IN_USE = [
  "availability.block",
  "availability.release",
  "availability.update",
  "booking.cancel",
  "booking.confirm_manual",
  "booking.expire",
  "booking.manual_review",
  "booking.update",
  "affiliate.cancel",
  "affiliate.confirm",
  "map.create",
  "map.item.create",
  "map.item.delete",
  "map.item.update",
  "map.item.visibility",
  "map.publish",
  "property.amenities",
  "property.base_price",
  "property.create",
  "property.image.add",
  "property.image.cover",
  "property.image.delete",
  "property.image.upload",
  "property.pricing",
  "property.update",
  "rate.create",
  "rate.remove",
  "rate.update",
  "user.create",
  "user.role_change",
  "coowner.account.create",
  "coowner.account.password",
  "coowner.account.active",
  "coowner.account.delete",
];

describe("describeAction", () => {
  it("traduce todas las acciones que se registran hoy", () => {
    const missing = ACTIONS_IN_USE.filter((action) => !AUDIT_ACTION_LABELS[action]);
    expect(missing).toEqual([]);
  });

  it("degrada a algo legible con una acción desconocida", () => {
    expect(describeAction("map.item.foo_bar")).toBe("Map · item · foo bar");
  });
});

describe("entityHref", () => {
  it("enlaza a la pantalla de la entidad cuando existe", () => {
    expect(entityHref("property", "abc")).toBe("/admin/properties/abc");
    expect(entityHref("map_item", "abc")).toBe("/admin/mapa");
  });

  it("devuelve null sin pantalla propia o sin id", () => {
    expect(entityHref("property_rate", "abc")).toBeNull();
    expect(entityHref("property", null)).toBeNull();
  });
});

describe("diffChangedFields", () => {
  it("solo lista lo que cambió y formatea los montos", () => {
    const changes = diffChangedFields(
      { name: "Depto 1", base_price_minor: 35_000, bedrooms: 2 },
      { name: "Depto 1", base_price_minor: 42_000, bedrooms: 3 },
    );
    expect(changes).toHaveLength(2);
    expect(changes[0].label).toBe("Precio base");
    expect(changes[0].from).toContain("350");
    expect(changes[0].to).toContain("420");
    expect(changes[1]).toEqual({ label: "Dormitorios", from: "2", to: "3" });
  });

  it("ignora valores redactados y corta en seis campos", () => {
    expect(diffChangedFields({ token: "[redacted]" }, { token: "[redacted]" })).toEqual([]);
    const before = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`f${i}`, i]));
    const after = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`f${i}`, i + 1]));
    expect(diffChangedFields(before, after)).toHaveLength(6);
  });

  it("no muestra nada cuando falta la foto previa", () => {
    expect(diffChangedFields(null, { name: "Depto 1" })).toEqual([]);
  });
});
