import { describe, expect, it } from "vitest";
import { buildPublishedData, type SnapshotSourceItem } from "./snapshot";

function item(overrides: Partial<SnapshotSourceItem>): SnapshotSourceItem {
  return {
    id: "1",
    type: "house",
    icon_key: "house",
    name: "Casa 1",
    description: null,
    normalized_x: 0.5,
    normalized_y: 0.5,
    normalized_width: 0.04,
    normalized_height: 0.04,
    rotation: 0,
    linked_property_id: null,
    linked_tower_id: null,
    metadata: {},
    status: "draft",
    is_visible: true,
    ...overrides,
  };
}

describe("buildPublishedData", () => {
  it("incluye solo los visibles y no archivados", () => {
    const snapshot = buildPublishedData([
      item({ id: "visible-draft", is_visible: true, status: "draft" }),
      item({ id: "visible-published", is_visible: true, status: "published" }),
      item({ id: "hidden", is_visible: false, status: "published" }),
      item({ id: "archived", is_visible: true, status: "archived" }),
    ]);
    expect(snapshot.map((i) => i.id)).toEqual(["visible-draft", "visible-published"]);
  });

  it("no expone status ni is_visible en el snapshot", () => {
    const [entry] = buildPublishedData([item({ id: "x" })]);
    expect(entry).not.toHaveProperty("status");
    expect(entry).not.toHaveProperty("is_visible");
  });

  it("conserva la relación de una torre en el snapshot", () => {
    const towerId = "11111111-1111-4111-8111-111111111111";
    const [entry] = buildPublishedData([item({ type: "tower", linked_tower_id: towerId })]);
    expect(entry.linked_tower_id).toBe(towerId);
  });

  it("devuelve arreglo vacío si no hay marcadores publicables", () => {
    expect(buildPublishedData([item({ is_visible: false })])).toEqual([]);
  });
});
