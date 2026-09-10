import "server-only";
import { createAdminClient } from "./supabase/admin";
import { AppError } from "./errors";

const BUCKET = "id-documents";
const MAX_BYTES = 8 * 1024 * 1024;

// El navegador nunca es fuente de verdad para el tipo ni la extensión: se valida
// contra esta tabla y se guarda con un nombre aleatorio.
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

export type IdDocumentSide = "front" | "back";

// Una foto de carnet cuelga de una reserva o de una estadía de copropietario, nunca de
// las dos. Espeja el objetivo de `declarations` y `access_approvals`.
export type IdDocumentTarget =
  { kind: "booking"; bookingId: string } | { kind: "stay"; stayId: string };

// Dentro del registro, la foto es del titular o de un acompañante concreto.
export type IdDocumentPerson = {
  kind: "titular" | "acompanante" | "sin_asignar";
  // id de la fila en booking_companions / co_owner_stay_guests. Null salvo acompañante.
  ref?: string | null;
  name?: string | null;
};

// En el mostrador apilan todos los carnets y sacan una tanda de fotos. Pedir de quién es
// cada una antes de subirla era lo que demoraba, así que sin asignar es el caso normal.
const SIN_ASIGNAR: IdDocumentPerson = { kind: "sin_asignar", ref: null, name: null };

function validate(file: File, side: IdDocumentSide) {
  const extension = ALLOWED[file.type];
  if (!extension || file.size <= 0 || file.size > MAX_BYTES) {
    throw new AppError(
      "VALIDATION_ERROR",
      `El ${side === "front" ? "anverso" : "reverso"} del carnet debe ser JPG, PNG o PDF y pesar hasta 8 MB`,
      422,
    );
  }
  return extension;
}

// Valida sin subir: se corre antes de crear la reserva para no bloquear fechas si el
// carnet viene mal.
export function assertIdDocumentsValid(front: File, back: File) {
  validate(front, "front");
  validate(back, "back");
}

function targetColumns(target: IdDocumentTarget) {
  return target.kind === "booking"
    ? { booking_id: target.bookingId, stay_id: null }
    : { booking_id: null, stay_id: target.stayId };
}

function targetId(target: IdDocumentTarget) {
  return target.kind === "booking" ? target.bookingId : target.stayId;
}

// Sube un archivo y registra la fila. Las fotos se acumulan: una tanda trae varias del
// mismo lado, y una sola foto puede tener varios carnets sobre la mesa.
export async function uploadIdDocument(params: {
  target: IdDocumentTarget;
  person?: IdDocumentPerson;
  side: IdDocumentSide;
  file: File;
}): Promise<void> {
  const person = params.person ?? SIN_ASIGNAR;
  const extension = validate(params.file, params.side);
  const supabase = createAdminClient();
  const path = `${params.target.kind}/${targetId(params.target)}/${person.ref ?? "titular"}/${params.side}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, params.file, {
    contentType: params.file.type,
    upsert: false,
  });
  if (uploadError) throw new AppError("INTERNAL_ERROR", "No se pudo subir el carnet", 500);

  const { error: insertError } = await supabase.from("id_documents").insert({
    ...targetColumns(params.target),
    person_kind: person.kind,
    person_ref: person.ref ?? null,
    person_name: person.name ?? null,
    side: params.side,
    file_path: path,
    mime_type: params.file.type,
    size_bytes: params.file.size,
  });
  if (insertError) {
    // Evita dejar un objeto huérfano en el bucket si falla el registro.
    await supabase.storage.from(BUCKET).remove([path]);
    throw new AppError("INTERNAL_ERROR", "No se pudo registrar el carnet", 500);
  }
}

// Sube una tanda entera. Sigue de largo con las que fallen para no perder el resto del
// lote por una sola foto pesada, y devuelve el conteo para poder avisar qué pasó.
export async function uploadIdDocuments(params: {
  target: IdDocumentTarget;
  person?: IdDocumentPerson;
  side: IdDocumentSide;
  files: File[];
}): Promise<{ subidas: number; fallidas: number }> {
  let subidas = 0;
  let fallidas = 0;
  for (const file of params.files) {
    try {
      await uploadIdDocument({
        target: params.target,
        person: params.person,
        side: params.side,
        file,
      });
      subidas += 1;
    } catch {
      fallidas += 1;
    }
  }
  return { subidas, fallidas };
}

async function removeRow(id: string, filePath: string) {
  const supabase = createAdminClient();
  await supabase.from("id_documents").delete().eq("id", id);
  await supabase.storage.from(BUCKET).remove([filePath]);
}

// Borra una foto puntual. La usa el panel para corregir una carga equivocada.
export async function deleteIdDocument(documentId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("id_documents")
    .select("id, file_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!data) throw new AppError("NOT_FOUND", "La foto ya no existe", 404);
  await removeRow(data.id, data.file_path);
}

// Sube anverso y reverso del titular de una reserva. Los dos son obligatorios en el flujo
// de afiliados; se mantiene la firma para no tocar `src/app/afiliados/actions.ts`.
export async function uploadBookingIdDocuments(params: {
  bookingId: string;
  front: File;
  back: File;
}): Promise<void> {
  const target: IdDocumentTarget = { kind: "booking", bookingId: params.bookingId };
  // El afiliado sube su propio carnet desde el formulario público: ahí sí se sabe de quién es.
  const person: IdDocumentPerson = { kind: "titular", ref: null, name: null };
  await uploadIdDocument({ target, person, side: "front", file: params.front });
  await uploadIdDocument({ target, person, side: "back", file: params.back });
}

export type IdDocument = {
  id: string;
  side: IdDocumentSide;
  url: string;
  mimeType: string;
  personKind: "titular" | "acompanante" | "sin_asignar";
  personRef: string | null;
  personName: string | null;
};

// URLs firmadas de corta duración para que el staff vea los carnets en el panel.
export async function listIdDocuments(target: IdDocumentTarget): Promise<IdDocument[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("id_documents")
    .select("id, side, file_path, mime_type, person_kind, person_ref, person_name");
  query =
    target.kind === "booking"
      ? query.eq("booking_id", target.bookingId)
      : query.eq("stay_id", target.stayId);
  const { data } = await query;

  const out: IdDocument[] = [];
  for (const row of data ?? []) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path, 60 * 10);
    if (!signed?.signedUrl) continue;
    out.push({
      id: row.id,
      side: row.side as IdDocumentSide,
      url: signed.signedUrl,
      mimeType: row.mime_type,
      personKind: (row.person_kind ?? "sin_asignar") as IdDocument["personKind"],
      personRef: row.person_ref ?? null,
      personName: row.person_name ?? null,
    });
  }
  return out;
}

// Compatibilidad con los llamadores que solo miran el carnet del titular de una reserva.
export async function listBookingIdDocuments(
  bookingId: string,
): Promise<{ side: IdDocumentSide; url: string; mimeType: string }[]> {
  const all = await listIdDocuments({ kind: "booking", bookingId });
  return all
    .filter((doc) => doc.personKind === "titular")
    .map((doc) => ({ side: doc.side, url: doc.url, mimeType: doc.mimeType }));
}
