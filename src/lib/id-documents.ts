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

async function uploadOne(bookingId: string, side: IdDocumentSide, file: File) {
  const extension = validate(file, side);
  const supabase = createAdminClient();
  const path = `${bookingId}/${side}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new AppError("INTERNAL_ERROR", "No se pudo subir el carnet", 500);

  const { error: insertError } = await supabase.from("id_documents").insert({
    booking_id: bookingId,
    side,
    file_path: path,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (insertError) {
    // Evita dejar un objeto huérfano en el bucket si falla el registro.
    await supabase.storage.from(BUCKET).remove([path]);
    throw new AppError("INTERNAL_ERROR", "No se pudo registrar el carnet", 500);
  }
}

// Sube anverso y reverso de una reserva. Los dos son obligatorios en el flujo de afiliados.
export async function uploadBookingIdDocuments(params: {
  bookingId: string;
  front: File;
  back: File;
}): Promise<void> {
  await uploadOne(params.bookingId, "front", params.front);
  await uploadOne(params.bookingId, "back", params.back);
}

// URL firmada de corta duración para que el staff vea el carnet en el panel.
export async function listBookingIdDocuments(
  bookingId: string,
): Promise<{ side: IdDocumentSide; url: string; mimeType: string }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("id_documents")
    .select("side, file_path, mime_type")
    .eq("booking_id", bookingId);

  const rows = data ?? [];
  const out: { side: IdDocumentSide; url: string; mimeType: string }[] = [];
  for (const row of rows) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path, 60 * 10);
    if (signed?.signedUrl) {
      out.push({ side: row.side as IdDocumentSide, url: signed.signedUrl, mimeType: row.mime_type });
    }
  }
  return out;
}
