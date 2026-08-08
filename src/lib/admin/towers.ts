import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, NotFoundError } from "@/lib/errors";
import type { TowerInput } from "@/lib/validation";

const TOWER_COLUMNS = "id, name, description, sort_order, is_active, created_at, updated_at";

export type TowerRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TowerOption = Pick<TowerRow, "id" | "name" | "is_active">;

export type TowerPropertyRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  tower_id: string | null;
};

export async function listTowerOptions(): Promise<TowerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("towers")
    .select("id, name, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return (data ?? []) as TowerOption[];
}

export async function listTowerAdminData(): Promise<{
  towers: TowerRow[];
  properties: TowerPropertyRow[];
}> {
  const supabase = await createClient();
  const [towerResult, propertyResult] = await Promise.all([
    supabase
      .from("towers")
      .select(TOWER_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("properties")
      .select("id, name, slug, status, tower_id")
      .order("name", { ascending: true }),
  ]);
  if (towerResult.error || propertyResult.error) {
    throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  }
  return {
    towers: (towerResult.data ?? []) as TowerRow[],
    properties: (propertyResult.data ?? []) as TowerPropertyRow[],
  };
}

function towerWriteError(message: string | undefined): never {
  if (message && /duplicate key|unique/i.test(message)) {
    throw new AppError("TOWER_NAME_TAKEN", "Ya existe una torre con ese nombre", 409);
  }
  throw new AppError("INTERNAL_ERROR", "Error interno", 500);
}

export async function createTower(input: TowerInput): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("towers")
    .insert({
      name: input.name,
      description: input.description || null,
      sort_order: input.sortOrder,
    })
    .select("id")
    .single();
  if (error) towerWriteError(error.message);
  return { id: data.id };
}

export async function updateTower(
  towerId: string,
  input: TowerInput,
): Promise<{ before: TowerRow; after: TowerRow }> {
  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("towers")
    .select(TOWER_COLUMNS)
    .eq("id", towerId)
    .maybeSingle();
  if (!before) throw new NotFoundError("Torre no encontrada");

  const { data: after, error } = await supabase
    .from("towers")
    .update({
      name: input.name,
      description: input.description || null,
      sort_order: input.sortOrder,
    })
    .eq("id", towerId)
    .select(TOWER_COLUMNS)
    .single();
  if (error) towerWriteError(error.message);
  return { before: before as TowerRow, after: after as TowerRow };
}

export async function setTowerActive(
  towerId: string,
  isActive: boolean,
): Promise<{ before: TowerRow; after: TowerRow }> {
  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("towers")
    .select(TOWER_COLUMNS)
    .eq("id", towerId)
    .maybeSingle();
  if (!before) throw new NotFoundError("Torre no encontrada");
  const { data: after, error } = await supabase
    .from("towers")
    .update({ is_active: isActive })
    .eq("id", towerId)
    .select(TOWER_COLUMNS)
    .single();
  if (error) towerWriteError(error.message);
  return { before: before as TowerRow, after: after as TowerRow };
}

export async function assignPropertyToTower(
  propertyId: string,
  towerId: string | null,
): Promise<{ before: TowerPropertyRow; after: TowerPropertyRow }> {
  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("properties")
    .select("id, name, slug, status, tower_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!before) throw new NotFoundError("Propiedad no encontrada");

  if (towerId) {
    const { data: tower } = await supabase
      .from("towers")
      .select("id")
      .eq("id", towerId)
      .maybeSingle();
    if (!tower) throw new NotFoundError("Torre no encontrada");
  }

  const { data: after, error } = await supabase
    .from("properties")
    .update({ tower_id: towerId })
    .eq("id", propertyId)
    .select("id, name, slug, status, tower_id")
    .single();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return { before: before as TowerPropertyRow, after: after as TowerPropertyRow };
}
