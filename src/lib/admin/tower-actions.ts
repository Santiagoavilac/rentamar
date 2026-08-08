"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStaff, assertAdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { entityIdSchema, towerAssignmentSchema, towerInputSchema } from "@/lib/validation";
import { assertSameOrigin, buildAuditContext } from "./context";
import * as towers from "./towers";

export type TowerActionResult = { ok: boolean; error: string | null };
const OK: TowerActionResult = { ok: true, error: null };

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function parseTowerForm(formData: FormData) {
  return towerInputSchema.parse({
    name: stringValue(formData.get("name")),
    description: stringValue(formData.get("description")),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  });
}

function fail(error: unknown): TowerActionResult {
  if (error instanceof ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
    return { ok: false, error: "Solicitud rechazada (origen inválido)." };
  }
  console.error("[tower-action]", error instanceof Error ? error.message : "unknown");
  return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
}

function revalidateTowerConsumers(propertyId?: string) {
  revalidatePath("/admin/towers");
  revalidatePath("/admin/mapa");
  revalidatePath("/mapa");
  if (propertyId) revalidatePath(`/admin/properties/${propertyId}`);
}

export async function createTowerAction(
  _previous: TowerActionResult,
  formData: FormData,
): Promise<TowerActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    const input = parseTowerForm(formData);
    const { id } = await towers.createTower(input);
    const context = await buildAuditContext(session);
    await writeAudit({
      ...context,
      action: "tower.create",
      entityType: "tower",
      entityId: id,
      after: input,
    });
  } catch (error) {
    return fail(error);
  }
  revalidateTowerConsumers();
  return OK;
}

export async function updateTowerAction(
  towerId: string,
  _previous: TowerActionResult,
  formData: FormData,
): Promise<TowerActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    const id = entityIdSchema.parse(towerId);
    const input = parseTowerForm(formData);
    const { before, after } = await towers.updateTower(id, input);
    const context = await buildAuditContext(session);
    await writeAudit({
      ...context,
      action: "tower.update",
      entityType: "tower",
      entityId: id,
      before,
      after,
    });
  } catch (error) {
    return fail(error);
  }
  revalidateTowerConsumers();
  return OK;
}

export async function setTowerActiveAction(
  towerId: string,
  isActive: boolean,
  _previous: TowerActionResult,
  _formData: FormData,
): Promise<TowerActionResult> {
  void _previous;
  void _formData;
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    const id = entityIdSchema.parse(towerId);
    const { before, after } = await towers.setTowerActive(id, Boolean(isActive));
    const context = await buildAuditContext(session);
    await writeAudit({
      ...context,
      action: "tower.active",
      entityType: "tower",
      entityId: id,
      before,
      after,
    });
  } catch (error) {
    return fail(error);
  }
  revalidateTowerConsumers();
  return OK;
}

export async function assignPropertyTowerAction(
  propertyId: string,
  _previous: TowerActionResult,
  formData: FormData,
): Promise<TowerActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    const rawTowerId = stringValue(formData.get("towerId"));
    const input = towerAssignmentSchema.parse({
      propertyId,
      towerId: rawTowerId || null,
    });
    const { before, after } = await towers.assignPropertyToTower(input.propertyId, input.towerId);
    const context = await buildAuditContext(session);
    await writeAudit({
      ...context,
      action: "property.tower",
      entityType: "property",
      entityId: input.propertyId,
      before,
      after,
    });
  } catch (error) {
    return fail(error);
  }
  revalidateTowerConsumers(propertyId);
  return OK;
}
