"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, assertAdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildAuditContext, assertSameOrigin } from "./context";
import * as access from "./access";
import {
  accessApprovalSchema,
  accessCompanionsSchema,
  accessRevokeSchema,
  checkinPersonSchema,
  undoCheckinSchema,
} from "@/lib/validation";
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

// ---------- Registro de ingreso, persona por persona ----------
// Aprobar es el permiso del grupo; esto es el hecho físico de cada persona en el mostrador.
// Va con el mismo permiso `access.review`: lo hace recepción, no un administrador.

// Cada detalle de registro tiene su propia pantalla; se revalidan todas las que muestran el
// verde/rojo para que el cambio se vea sin recargar a mano.
function revalidateCheckinViews(bookingId: string | null, stayId: string | null) {
  revalidatePath(PANEL_PATH);
  revalidatePath("/admin/ingresos");
  if (bookingId) {
    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath(`/admin/affiliates/${bookingId}`);
    revalidatePath("/admin/registros/huespedes");
    revalidatePath("/admin/registros/afiliados");
  }
  if (stayId) {
    revalidatePath(`/admin/copropietarios/registros/${stayId}`);
    revalidatePath("/admin/copropietarios/registros");
  }
}

export async function checkInPersonAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let target = { bookingId: null as string | null, stayId: null as string | null };
  try {
    const session = await authorize();
    const parsed = checkinPersonSchema.parse({
      ...readTarget(formData),
      personKind: (formData.get("personKind") as string) || "titular",
      personRef: (formData.get("personRef") as string) || null,
      personName: formData.get("personName"),
      personDocumentId: (formData.get("personDocumentId") as string) || null,
      wristbandDelivered: formData.get("wristbandDelivered") === "on",
    });
    target = { bookingId: parsed.bookingId, stayId: parsed.stayId };
    await access.checkInPerson(
      {
        bookingId: parsed.bookingId,
        stayId: parsed.stayId,
        personKind: parsed.personKind,
        personRef: parsed.personRef,
        personName: parsed.personName,
        personDocumentId: parsed.personDocumentId,
        wristbandDelivered: parsed.wristbandDelivered,
      },
      session.userId,
    );
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "access.checkin",
      entityType: parsed.bookingId ? "booking" : "co_owner_stay",
      entityId: parsed.bookingId ?? parsed.stayId ?? "",
      after: {
        person_ref: parsed.personRef,
        person_name: parsed.personName,
        wristband_delivered: parsed.wristbandDelivered,
      },
    });
  } catch (error) {
    return fail(error);
  }
  revalidateCheckinViews(target.bookingId, target.stayId);
  return OK;
}

export async function undoCheckInAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let target = { bookingId: null as string | null, stayId: null as string | null };
  try {
    const session = await authorize();
    const parsed = undoCheckinSchema.parse({
      ...readTarget(formData),
      personRef: (formData.get("personRef") as string) || null,
    });
    target = { bookingId: parsed.bookingId, stayId: parsed.stayId };
    await access.undoCheckIn(
      { bookingId: parsed.bookingId, stayId: parsed.stayId },
      parsed.personRef,
    );
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "access.checkin_undo",
      entityType: parsed.bookingId ? "booking" : "co_owner_stay",
      entityId: parsed.bookingId ?? parsed.stayId ?? "",
      before: { person_ref: parsed.personRef },
    });
  } catch (error) {
    return fail(error);
  }
  revalidateCheckinViews(target.bookingId, target.stayId);
  return OK;
}
