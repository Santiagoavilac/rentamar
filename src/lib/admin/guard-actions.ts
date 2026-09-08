"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff, assertAdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildAuditContext, assertSameOrigin } from "./context";
import * as guards from "./guards";
import { guardAccountSchema, guardActiveSchema, guardPasswordSchema } from "@/lib/validation";
import type { ActionResult } from "./actions";

// Acciones del panel para las cuentas de guardia. Espejo de cleaner-actions.ts: todas siguen
// la cadena requireStaff → assertSameOrigin → assertAdminAction("guard.manage") → capa de
// datos → writeAudit → revalidatePath. La contraseña nunca llega a la auditoría.

const OK: ActionResult = { ok: true, error: null };
const PANEL_PATH = "/admin/users";

function fail(error: unknown): ActionResult {
  if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
    return { ok: false, error: "Solicitud rechazada (origen inválido)." };
  }
  console.error("[guard-action]", error instanceof Error ? error.message : "unknown");
  return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
}

async function authorize() {
  const session = await requireStaff();
  await assertSameOrigin();
  assertAdminAction(session.role, "guard.manage");
  return session;
}

export async function createGuardAccountAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = guardAccountSchema.parse({
      username: formData.get("username"),
      password: formData.get("password"),
      fullName: formData.get("fullName"),
    });
    const { accountId } = await guards.createGuardAccount(parsed, session.userId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "guard.account.create",
      entityType: "guard_account",
      entityId: accountId,
      after: { username: parsed.username, full_name: parsed.fullName },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function setGuardPasswordAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = guardPasswordSchema.parse({
      accountId: formData.get("accountId"),
      password: formData.get("password"),
    });
    await guards.setGuardPassword(parsed.accountId, parsed.password);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "guard.account.password",
      entityType: "guard_account",
      entityId: parsed.accountId,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function setGuardActiveAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = guardActiveSchema.parse({
      accountId: formData.get("accountId"),
      isActive: formData.get("isActive") === "true",
    });
    await guards.setGuardActive(parsed.accountId, parsed.isActive);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "guard.account.active",
      entityType: "guard_account",
      entityId: parsed.accountId,
      after: { is_active: parsed.isActive },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function deleteGuardAccountAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const accountId = z.uuid().parse(formData.get("accountId"));
    await guards.deleteGuardAccount(accountId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "guard.account.delete",
      entityType: "guard_account",
      entityId: accountId,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}
