"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, requireAdmin, assertAdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildAuditContext, assertSameOrigin } from "./context";
import { uploadIdDocuments, deleteIdDocument, type IdDocumentTarget } from "@/lib/id-documents";
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

    // El formulario manda un solo campo: "" (sin asignar), "titular" o el id del
    // acompañante. Acá se traduce al par kind/ref que guarda la tabla.
    const person = (formData.get("person") as string) || "";
    const personKind =
      person === "" ? "sin_asignar" : person === "titular" ? "titular" : "acompanante";

    const parsed = idDocumentUploadSchema.parse({
      bookingId: (formData.get("bookingId") as string) || null,
      stayId: (formData.get("stayId") as string) || null,
      personKind,
      personRef: personKind === "acompanante" ? person : null,
      personName: (formData.get("personName") as string) || null,
      side: (formData.get("side") as string) || "front",
    });

    // La oficina sube una tanda entera de una vez, no de a una foto.
    const files = formData.getAll("photo").filter((item): item is File => item instanceof File);
    if (!files.length) {
      throw new AppError("VALIDATION_ERROR", "Elegí al menos una foto", 422);
    }

    target = parsed.bookingId
      ? { kind: "booking", bookingId: parsed.bookingId }
      : { kind: "stay", stayId: parsed.stayId as string };

    const resultado = await uploadIdDocuments({
      target,
      person: { kind: parsed.personKind, ref: parsed.personRef, name: parsed.personName },
      side: parsed.side,
      files,
    });

    await writeAudit({
      ...(await buildAuditContext(session)),
      action: "id_document.upload",
      entityType: parsed.bookingId ? "booking" : "co_owner_stay",
      entityId: parsed.bookingId ?? parsed.stayId ?? "",
      // Nunca el archivo ni la ruta: alcanza con saber de quién, qué lado y cuántas.
      after: {
        person_kind: parsed.personKind,
        person_ref: parsed.personRef,
        side: parsed.side,
        subidas: resultado.subidas,
      },
    });

    if (!resultado.subidas) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Ninguna foto se pudo subir. Tienen que ser JPG, PNG o PDF de hasta 8 MB.",
        422,
      );
    }
    if (resultado.fallidas) {
      // El lote sirvió igual: se avisa qué quedó afuera sin borrar lo que sí entró.
      revalidateTargets(target);
      return {
        ok: true,
        error: `Se subieron ${resultado.subidas}. Quedaron ${resultado.fallidas} afuera por formato o peso.`,
      };
    }
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
