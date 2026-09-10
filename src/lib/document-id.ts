// Normalización del carnet de identidad. Módulo puro para poder testearlo aislado.
//
// Tiene que dar exactamente lo mismo que `public.normalize_document` en la base:
//   nullif(upper(regexp_replace(coalesce(p_document, ''), '[^A-Za-z0-9]', '', 'g')), '')
//
// Si las dos se separan, alguien vetado se cuela escribiendo el carnet distinto.

export function normalizeDocumentId(document: string | null | undefined): string | null {
  const normalized = (document ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return normalized === "" ? null : normalized;
}
