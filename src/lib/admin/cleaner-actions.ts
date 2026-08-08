"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff, assertAdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildAuditContext, assertSameOrigin } from "./context";
import * as cleaners from "./cleaners";
import { cleanerAccountSchema, cleanerActiveSchema, cleanerPasswordSchema } from "@/lib/validation";
import type { ActionResult } from "./actions";

// Acciones del panel para las cuentas de limpieza. Todas siguen la cadena
// requireStaff → assertSameOrigin → assertAdminAction("cleaning.manage") → capa de datos →
// writeAudit → revalidatePath. La contraseña nunca llega a la auditoría.

const OK: ActionResult = { ok: true, error: null };
const PANEL_PATH = "/admin/users";

function fail(error: unknown): ActionResult {
  if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
    return { ok: false, error: "Solicitud rechazada (origen inválido)." };
  }
  console.error("[cleaner-action]", error instanceof Error ? error.message : "unknown");
  return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
}

async function authorize() {
  const session = await requireStaff();
  await assertSameOrigin();
  assertAdminAction(session.role, "cleaning.manage");
  return session;
}

export async function createCleanerAccountAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = cleanerAccountSchema.parse({
      username: formData.get("username"),
      password: formData.get("password"),
      fullName: formData.get("fullName"),
    });
    const { accountId } = await cleaners.createCleanerAccount(parsed, session.userId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "cleaner.account.create",
      entityType: "cleaner_account",
      entityId: accountId,
      after: { username: parsed.username, full_name: parsed.fullName },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function setCleanerPasswordAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = cleanerPasswordSchema.parse({
      accountId: formData.get("accountId"),
      password: formData.get("password"),
    });
    await cleaners.setCleanerPassword(parsed.accountId, parsed.password);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "cleaner.account.password",
      entityType: "cleaner_account",
      entityId: parsed.accountId,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function setCleanerActiveAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = cleanerActiveSchema.parse({
      accountId: formData.get("accountId"),
      isActive: formData.get("isActive") === "true",
    });
    await cleaners.setCleanerActive(parsed.accountId, parsed.isActive);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "cleaner.account.active",
      entityType: "cleaner_account",
      entityId: parsed.accountId,
      after: { is_active: parsed.isActive },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function deleteCleanerAccountAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const accountId = z.uuid().parse(formData.get("accountId"));
    await cleaners.deleteCleanerAccount(accountId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "cleaner.account.delete",
      entityType: "cleaner_account",
      entityId: accountId,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}
