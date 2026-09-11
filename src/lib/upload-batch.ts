import type { ActionResult } from "@/lib/admin/actions";

// Vercel corta cualquier request de más de 4,5 MB con un 413 antes de llegar a Next, y eso
// en el navegador se ve como "Application error". Por eso un lote nunca viaja entero: se
// manda de a un archivo, y cada foto se achica antes en el navegador.
// Un poco menos que los 4 MB del límite de Next: el resto del formulario también ocupa.
export const MAX_REQUEST_BYTES = 3.8 * 1024 * 1024;

// Por debajo de esto la foto ya es liviana y se manda tal cual, sin perder calidad.
const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024;

// Achica la imagen para que entre en un request. Los PDF (carnets) no se tocan.
export async function shrinkImage(file: File, maxEdge: number): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= KEEP_AS_IS_BYTES) return file;
  try {
    // createImageBitmap respeta la orientación EXIF: las fotos de celular no salen giradas.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG no tiene transparencia: sin fondo blanco un PNG transparente saldría negro.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // Si el navegador no puede decodificarla, que el servidor diga por qué la rechaza.
    return file;
  }
}

export type BatchOutcome = { subidas: number; total: number; error: string | null };

// Sube en orden, uno por uno, para que el orden de la galería respete el de la selección.
// Una foto que falla no frena al resto.
export async function uploadOneByOne({
  files,
  maxEdge,
  buildFormData,
  action,
  onProgress,
}: {
  files: File[];
  maxEdge: number;
  buildFormData: (file: File) => FormData;
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  onProgress: (done: number) => void;
}): Promise<BatchOutcome> {
  let subidas = 0;
  let error: string | null = null;
  for (const [index, original] of files.entries()) {
    onProgress(index);
    try {
      const file = await shrinkImage(original, maxEdge);
      if (file.size > MAX_REQUEST_BYTES) {
        error = `"${original.name}" pesa más de 4 MB y no se puede subir.`;
        continue;
      }
      const result = await action({ ok: false, error: null }, buildFormData(file));
      if (result.ok) subidas += 1;
      else error = result.error ?? "No se pudo subir.";
    } catch {
      error = "Se cortó la conexión con el servidor.";
    }
  }
  onProgress(files.length);
  return { subidas, total: files.length, error };
}

// Texto único para el resultado del lote, igual en galería y carnets.
export function describeOutcome({ subidas, total, error }: BatchOutcome): ActionResult {
  if (subidas === total) return { ok: true, error: null };
  if (subidas === 0) return { ok: false, error: error ?? "No se pudo subir ninguna." };
  return {
    ok: true,
    error: `Se subieron ${subidas} de ${total}. ${error ?? ""}`.trim(),
  };
}
