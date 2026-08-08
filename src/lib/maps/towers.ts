import type { PublishedMapItem } from "./snapshot";

export type PublishedTowerDepartment = {
  id: string;
  name: string;
  slug: string;
};

export type PublishedTower = {
  id: string;
  name: string;
  description: string | null;
  departments: PublishedTowerDepartment[];
};

type TowerSource = {
  id: string;
  name: string;
  description: string | null;
};

type PropertySource = {
  id: string;
  name: string;
  slug: string;
  tower_id: string | null;
  status: string;
};

export function buildPublishedTowers(
  towerRows: TowerSource[],
  propertyRows: PropertySource[],
): PublishedTower[] {
  return towerRows.map((tower) => ({
    id: tower.id,
    name: tower.name,
    description: tower.description,
    departments: propertyRows
      .filter((property) => property.tower_id === tower.id && property.status === "published")
      .sort((left, right) => left.name.localeCompare(right.name, "es"))
      .map(({ id, name, slug }) => ({ id, name, slug })),
  }));
}

export function filterItemsForActiveTowers(
  items: PublishedMapItem[],
  towers: PublishedTower[],
): PublishedMapItem[] {
  const activeTowerIds = new Set(towers.map((tower) => tower.id));
  return items.filter(
    (item) =>
      item.type !== "tower" || !item.linked_tower_id || activeTowerIds.has(item.linked_tower_id),
  );
}

export function findIncompleteTowerPlacements(
  towers: { id: string; name: string }[],
  items: { type: string; linked_tower_id?: string | null; is_visible: boolean; status: string }[],
): { id: string; name: string }[] {
  return towers.filter(
    (tower) =>
      items.filter(
        (item) =>
          item.type === "tower" &&
          item.linked_tower_id === tower.id &&
          item.is_visible &&
          item.status !== "archived",
      ).length !== 1,
  );
}
