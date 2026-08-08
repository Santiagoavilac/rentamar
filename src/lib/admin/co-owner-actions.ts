"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff, assertAdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildAuditContext, assertSameOrigin } from "./context";
import * as coOwners from "./co-owners";
import { coOwnerAccountSchema, coOwnerActiveSchema, coOwnerPasswordSchema } from "@/lib/validation";
import type { ActionResult } from "./actions";

// Acciones del panel para el módulo de copropietarios. Todas siguen la cadena
// requireStaff → assertSameOrigin → assertAdminAction("coowner.manage") → capa de datos →
// writeAudit → revalidatePath. La contraseña nunca llega a la auditoría: solo se registra
// el username (y el sanitizador de audit.ts redacta la clave `password` de todos modos).

const OK: ActionResult = { ok: true, error: null };
const PANEL_PATH = "/admin/users";

function fail(error: unknown): ActionResult {
  if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
    return { ok: false, error: "Solicitud rechazada (origen inválido)." };
  }
  console.error("[coowner-action]", error instanceof Error ? error.message : "unknown");
  return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
}

async function authorize() {
  const session = await requireStaff();
  await assertSameOrigin();
  assertAdminAction(session.role, "coowner.manage");
  return session;
}

export async function createCoOwnerAccountAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = coOwnerAccountSchema.parse({
      username: formData.get("username"),
      password: formData.get("password"),
      propertyName: formData.get("propertyName"),
      roomCount: formData.get("roomCount"),
    });
    const { accountId } = await coOwners.createCoOwnerAccount(parsed, session.userId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "coowner.account.create",
      entityType: "co_owner_account",
      entityId: accountId,
      after: {
        username: parsed.username,
        property_name: parsed.propertyName,
        room_count: parsed.roomCount,
      },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function setCoOwnerPasswordAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = coOwnerPasswordSchema.parse({
      accountId: formData.get("accountId"),
      password: formData.get("password"),
    });
    await coOwners.setCoOwnerPassword(parsed.accountId, parsed.password);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "coowner.account.password",
      entityType: "co_owner_account",
      entityId: parsed.accountId,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function setCoOwnerActiveAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = coOwnerActiveSchema.parse({
      accountId: formData.get("accountId"),
      isActive: formData.get("isActive") === "true",
    });
    await coOwners.setCoOwnerActive(parsed.accountId, parsed.isActive);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "coowner.account.active",
      entityType: "co_owner_account",
      entityId: parsed.accountId,
      after: { is_active: parsed.isActive },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function deleteCoOwnerAccountAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const accountId = z.uuid().parse(formData.get("accountId"));
    await coOwners.deleteCoOwnerAccount(accountId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "coowner.account.delete",
      entityType: "co_owner_account",
      entityId: accountId,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

