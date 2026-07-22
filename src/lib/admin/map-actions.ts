"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, assertAdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildAuditContext, assertSameOrigin } from "./context";
import * as maps from "./maps";
import {
  mapItemInputSchema,
  mapItemMoveSchema,
  mapCreateSchema,
  type MapItemInput,
  type MapItemMoveInput,
  type MapCreateInput,
} from "@/lib/validation";

export type ActionResult = { ok: boolean; error: string | null; id?: string };

const OK: ActionResult = { ok: true, error: null };

// Convierte cualquier excepción en un mensaje seguro para la UI (sin internals).
function fail(error: unknown): ActionResult {
  if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
    return { ok: false, error: "Solicitud rechazada (origen inválido)." };
  }
  console.error("[map-action]", error instanceof Error ? error.message : "unknown");
  return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
}

export async function createMapAction(input: MapCreateInput): Promise<ActionResult> {
  let newId: string | null = null;
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "map.manage");
    const parsed = mapCreateSchema.parse(input);
    const { id } = await maps.createMap(parsed, session.userId);
    newId = id;
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "map.create",
      entityType: "map",
      entityId: id,
      after: parsed,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/mapa");
  return { ...OK, id: newId ?? undefined };
}

export async function createItemAction(mapId: string, input: MapItemInput): Promise<ActionResult> {
  let newId: string | null = null;
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "map.manage");
    const parsed = mapItemInputSchema.parse(input);
    const { id } = await maps.createItem(mapId, parsed, session.userId);
    newId = id;
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "map.item.create",
      entityType: "map_item",
      entityId: id,
      after: parsed,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/mapa");
  return { ...OK, id: newId ?? undefined };
}

export async function updateItemAction(itemId: string, input: MapItemInput): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "map.manage");
    const parsed = mapItemInputSchema.parse(input);
    await maps.updateItem(itemId, parsed);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "map.item.update",
      entityType: "map_item",
      entityId: itemId,
      after: parsed,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/mapa");
  return OK;
}

export async function moveItemAction(
  itemId: string,
  move: MapItemMoveInput,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "map.manage");
    const parsed = mapItemMoveSchema.parse(move);
    await maps.moveItem(itemId, parsed);
    // El drag es de alta frecuencia: no se audita cada movimiento (ruido). El estado
    // final queda auditado al Guardar/Publicar.
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/mapa");
  return OK;
}

export async function setItemVisibilityAction(
  itemId: string,
  visible: boolean,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "map.manage");
    await maps.setItemVisibility(itemId, Boolean(visible));
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "map.item.visibility",
      entityType: "map_item",
      entityId: itemId,
      after: { isVisible: Boolean(visible) },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/mapa");
  return OK;
}

export async function deleteItemAction(itemId: string): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "map.manage");
    await maps.deleteItem(itemId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "map.item.delete",
      entityType: "map_item",
      entityId: itemId,
      before: { itemId },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/mapa");
  return OK;
}

// Publicar es una acción más sensible (afecta al visor público): permiso propio.
export async function publishMapAction(mapId: string): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "map.publish");
    const { count } = await maps.publishMap(mapId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "map.publish",
      entityType: "map",
      entityId: mapId,
      after: { publishedItems: count },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/mapa");
  revalidatePath("/mapa");
  return OK;
}
