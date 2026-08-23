import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";

// Lectura de las declaraciones ya emitidas para el panel. El bucket es privado, así que
// el PDF se sirve con URL firmada de corta duración, igual que los comprobantes de pago
// (ver listPaymentReceipts en payments.ts). Emitir una declaración nueva sigue pasando
// por /api/declaraciones; acá solo se muestra lo que ya existe.

const BUCKET = "declarations";
const SIGNED_URL_TTL = 60 * 10;

export type DeclarationSummary = {
  url: string | null;
  generatedAt: string;
  acceptedAt: string;
};

type Column = "booking_id" | "stay_id";

async function listByColumn(
  column: Column,
  ids: string[],
): Promise<Map<string, DeclarationSummary>> {
  const out = new Map<string, DeclarationSummary>();
  if (ids.length === 0) return out;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("declarations")
    .select("booking_id, stay_id, pdf_path, generated_at, accepted_at")
    .in(column, ids);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);

  const rows = data ?? [];
  if (rows.length === 0) return out;

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      rows.map((row) => row.pdf_path),
      SIGNED_URL_TTL,
    );
  const urlByPath = new Map((signed ?? []).map((item) => [item.path ?? "", item.signedUrl]));

  for (const row of rows) {
    const key = column === "booking_id" ? row.booking_id : row.stay_id;
    if (!key) continue;
    out.set(key, {
      url: urlByPath.get(row.pdf_path) ?? null,
      generatedAt: row.generated_at,
      acceptedAt: row.accepted_at,
    });
  }
  return out;
}

export function listDeclarationsByBooking(bookingIds: string[]) {
  return listByColumn("booking_id", bookingIds);
}

export function listDeclarationsByStay(stayIds: string[]) {
  return listByColumn("stay_id", stayIds);
}

export async function getDeclarationForBooking(
  bookingId: string,
): Promise<DeclarationSummary | null> {
  return (await listDeclarationsByBooking([bookingId])).get(bookingId) ?? null;
}

export async function getDeclarationForStay(stayId: string): Promise<DeclarationSummary | null> {
  return (await listDeclarationsByStay([stayId])).get(stayId) ?? null;
}
