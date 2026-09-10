"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, assertAdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildAuditContext, assertSameOrigin } from "./context";
import { addBannedGuest, revokeBannedGuest } from "@/lib/banned-guests";
import { bannedGuestSchema, bannedGuestRevokeSchema } from "@/lib/validation";
import type { ActionResult } from "./actions";

// Lista de huéspedes vetados. Misma cadena que el resto del panel, con `banned.manage`:
// vetar a alguien lo deja afuera por los tres canales a la vez, así que es de administración
// y no del mostrador.

const OK: ActionResult = { ok: true, error: null };
const PANEL_PATH = "/admin/vetados";

function fail(error: unknown): ActionResult {
  if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
    return { ok: false, error: "Solicitud rechazada (origen inválido)." };
  }
  console.error("[banned-action]", error instanceof Error ? error.message : "unknown");
  return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
}

async function authorize() {
  const session = await requireAdmin();
  await assertSameOrigin();
  assertAdminAction(session.role, "banned.manage");
  return session;
}

export async function addBannedGuestAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = bannedGuestSchema.parse({
      fullName: formData.get("fullName"),
      documentId: formData.get("documentId"),
      reason: (formData.get("reason") as string) || null,
    });
    await addBannedGuest(parsed, session.userId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "banned_guest.add",
      entityType: "banned_guest",
      entityId: parsed.documentId,
      after: { full_name: parsed.fullName, reason: parsed.reason },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function revokeBannedGuestAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = bannedGuestRevokeSchema.parse({ id: formData.get("id") });
    await revokeBannedGuest(parsed.id, session.userId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "banned_guest.revoke",
      entityType: "banned_guest",
      entityId: parsed.id,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}
