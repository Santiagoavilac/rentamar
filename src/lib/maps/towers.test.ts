import { describe, expect, it } from "vitest";
import {
  buildPublishedTowers,
  filterItemsForActiveTowers,
  findIncompleteTowerPlacements,
} from "./towers";
import type { PublishedMapItem } from "./snapshot";

describe("torres publicadas", () => {
  it("agrupa solo propiedades publicadas y las ordena por nombre", () => {
    const towers = buildPublishedTowers(
      [{ id: "tower-1", name: "Torre 1", description: null }],
      [
        {
          id: "p2",
          name: "Departamento B",
          slug: "departamento-b",
          tower_id: "tower-1",
          status: "published",
        },
        {
          id: "p1",
          name: "Departamento A",
          slug: "departamento-a",
          tower_id: "tower-1",
          status: "published",
        },
        {
          id: "draft",
          name: "Departamento privado",
          slug: "privado",
          tower_id: "tower-1",
          status: "draft",
        },
      ],
    );
    expect(towers[0].departments.map((property) => property.slug)).toEqual([
      "departamento-a",
      "departamento-b",
    ]);
  });

  it("oculta marcadores de torres inactivas y conserva snapshots antiguos", () => {
    const base: PublishedMapItem = {
      id: "item",
      type: "tower",
      icon_key: "tower",
      name: "Torre",
      description: null,
      normalized_x: 0.5,
      normalized_y: 0.5,
      normalized_width: 0.04,
      normalized_height: 0.04,
      rotation: 0,
      linked_property_id: null,
      metadata: {},
    };
    expect(filterItemsForActiveTowers([base], [])).toHaveLength(1);
    expect(filterItemsForActiveTowers([{ ...base, linked_tower_id: "inactive" }], [])).toHaveLength(
      0,
    );
  });

  it("bloquea la publicación si una torre falta, está oculta o está repetida", () => {
    const towers = [
      { id: "t1", name: "Torre 1" },
      { id: "t2", name: "Torre 2" },
      { id: "t3", name: "Torre 3" },
    ];
    const items = [
      { type: "tower", linked_tower_id: "t1", is_visible: true, status: "draft" },
      { type: "tower", linked_tower_id: "t2", is_visible: false, status: "draft" },
      { type: "tower", linked_tower_id: "t3", is_visible: true, status: "draft" },
      { type: "tower", linked_tower_id: "t3", is_visible: true, status: "published" },
    ];
    expect(findIncompleteTowerPlacements(towers, items).map((tower) => tower.id)).toEqual([
      "t2",
      "t3",
    ]);
  });
});
