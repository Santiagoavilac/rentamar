"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, requireAdmin, assertAdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildAuditContext, assertSameOrigin } from "./context";
import { uploadIdDocument, deleteIdDocument, type IdDocumentTarget } from "@/lib/id-documents";
import { idDocumentDeleteSchema, idDocumentUploadSchema } from "@/lib/validation";
import type { ActionResult } from "./actions";

// Fotos de carnet cargadas desde el panel. Misma cadena que el resto:
// requireStaff → assertSameOrigin → assertAdminAction → validación → helper → auditoría.
//
// Sube con `declaration.read`, no con un permiso de administrador: quien tiene el carnet
// en la mano es recepción, y ya ve los mismos datos del huésped en la ficha. Borrar sí es
// admin-only, porque destruye evidencia.

const OK: ActionResult = { ok: true, error: null };

function fail(error: unknown): ActionResult {
  if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
    return { ok: false, error: "Solicitud rechazada (origen inválido)." };
  }
  console.error("[id-document-action]", error instanceof Error ? error.message : "unknown");
  return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
}

// Cada registro se ve desde su propia pantalla; se revalidan todas las que muestran la
// foto para que el cambio se note sin recargar a mano.
function revalidateTargets(target: IdDocumentTarget) {
  if (target.kind === "booking") {
    revalidatePath(`/admin/bookings/${target.bookingId}`);
    revalidatePath(`/admin/affiliates/${target.bookingId}`);
  } else {
    revalidatePath(`/admin/copropietarios/registros/${target.stayId}`);
  }
}

export async function uploadIdDocumentAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let target: IdDocumentTarget | null = null;
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "declaration.read");

    const parsed = idDocumentUploadSchema.parse({
      bookingId: (formData.get("bookingId") as string) || null,
      stayId: (formData.get("stayId") as string) || null,
      personKind: (formData.get("personKind") as string) || "titular",
      personRef: (formData.get("personRef") as string) || null,
      personName: (formData.get("personName") as string) || null,
      side: (formData.get("side") as string) || "front",
    });

    const file = formData.get("photo");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "Elegí una foto del carnet", 422);
    }

    target = parsed.bookingId
      ? { kind: "booking", bookingId: parsed.bookingId }
      : { kind: "stay", stayId: parsed.stayId as string };

    await uploadIdDocument({
      target,
      person: { kind: parsed.personKind, ref: parsed.personRef, name: parsed.personName },
      side: parsed.side,
      file,
    });

    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "id_document.upload",
      entityType: parsed.bookingId ? "booking" : "co_owner_stay",
      entityId: parsed.bookingId ?? parsed.stayId ?? "",
      // Nunca el archivo ni la ruta: alcanza con saber de quién y qué lado.
      after: { person_kind: parsed.personKind, person_ref: parsed.personRef, side: parsed.side },
    });
  } catch (error) {
    return fail(error);
  }
  if (target) revalidateTargets(target);
  return OK;
}

export async function deleteIdDocumentAction(
  _state: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let target: IdDocumentTarget | null = null;
  try {
    const session = await requireAdmin();
    await assertSameOrigin();
    const parsed = idDocumentDeleteSchema.parse({ documentId: formData.get("documentId") });
    const bookingId = (formData.get("bookingId") as string) || null;
    const stayId = (formData.get("stayId") as string) || null;
    target = bookingId ? { kind: "booking", bookingId } : stayId ? { kind: "stay", stayId } : null;

    await deleteIdDocument(parsed.documentId);
    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "id_document.delete",
      entityType: bookingId ? "booking" : "co_owner_stay",
      entityId: bookingId ?? stayId ?? "",
      before: { documentId: parsed.documentId },
    });
  } catch (error) {
    return fail(error);
  }
  if (target) revalidateTargets(target);
  return OK;
}
