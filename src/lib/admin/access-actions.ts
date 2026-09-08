"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, assertAdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildAuditContext, assertSameOrigin } from "./context";
import * as access from "./access";
import { accessApprovalSchema, accessCompanionsSchema, accessRevokeSchema } from "@/lib/validation";
import type { ActionResult } from "./actions";

// Aprobar y desaprobar el ingreso. Misma cadena que el resto del panel:
// requireStaff → assertSameOrigin → assertAdminAction("access.review") → RPC → auditoría.

const OK: ActionResult = { ok: true, error: null };
const PANEL_PATH = "/admin/accesos";

function fail(error: unknown): ActionResult {
  if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
    return { ok: false, error: "Solicitud rechazada (origen inválido)." };
  }
  console.error("[access-action]", error instanceof Error ? error.message : "unknown");
  return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
}

async function authorize() {
  const session = await requireStaff();
  await assertSameOrigin();
  assertAdminAction(session.role, "access.review");
  return session;
}

// Un formulario por fila: los campos vacíos vienen como null y el par reserva/estadía es
// excluyente, igual que en la declaración jurada.
function readTarget(formData: FormData) {
  return {
    bookingId: (formData.get("bookingId") as string) || null,
    stayId: (formData.get("stayId") as string) || null,
  };
}

export async function approveAccessAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = accessApprovalSchema.parse({
      ...readTarget(formData),
      declarationSigned: formData.get("declarationSigned") === "on",
      depositReceived: formData.get("depositReceived") === "on",
      wristbandsDelivered: formData.get("wristbandsDelivered") === "on",
      notes: (formData.get("notes") as string) || null,
    });
    await access.approveAccess(parsed, session.userId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "access.approve",
      entityType: parsed.bookingId ? "booking" : "co_owner_stay",
      entityId: parsed.bookingId ?? parsed.stayId ?? "",
      after: {
        declaration_signed: parsed.declarationSigned,
        deposit_received: parsed.depositReceived,
        wristbands_delivered: parsed.wristbandsDelivered,
      },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

export async function revokeAccessAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const parsed = accessRevokeSchema.parse(readTarget(formData));
    await access.revokeAccess(parsed);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "access.revoke",
      entityType: parsed.bookingId ? "booking" : "co_owner_stay",
      entityId: parsed.bookingId ?? parsed.stayId ?? "",
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}

// Nombres de los acompañantes de un alquiler del canal directo, que la reserva no pide.
// Llegan como pares paralelos fullName[]/documentId[]; las filas vacías se descartan.
export async function setAccessCompanionsAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await authorize();
    const names = formData.getAll("companionName").map(String);
    const documents = formData.getAll("companionDocument").map(String);
    const companions = names
      .map((fullName, index) => ({
        fullName: fullName.trim(),
        documentId: (documents[index] ?? "").trim(),
      }))
      .filter((companion) => companion.fullName !== "" || companion.documentId !== "");

    const parsed = accessCompanionsSchema.parse({
      bookingId: formData.get("bookingId"),
      companions,
    });
    await access.setAccessCompanions(parsed.bookingId, parsed.companions, session.userId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "access.companions",
      entityType: "booking",
      entityId: parsed.bookingId,
      after: { companions: parsed.companions.length },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PANEL_PATH);
  return OK;
}
