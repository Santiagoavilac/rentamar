import "server-only";
import { createClient } from "./supabase/server";
import { mapPostgresError } from "./errors";

// Control de acceso: quién puede entrar y quién todavía no. Toda la unión de los tres
// orígenes (alquiler, afiliado y copropietario) vive en la RPC list_access_entries; acá
// solo se la llama y se traduce a camelCase.
//
// La lectura usa el cliente de sesión: la RPC decide con is_staff()/is_guard() y así el
// guardia puede usar exactamente la misma función sin ver nada de más.

export type AccessPerson = {
  nombre: string;
  carnet: string;
  /** Se presentó en la oficina y quedó registrado. */
  registrado: boolean;
  /** Ya retiró su manilla. */
  manilla: boolean;
};

export type AccessEntry = {
  /** "alquiler" | "afiliado" | "copropietario" */
  source: string;
  entryId: string;
  /** Es una reserva (canal directo o afiliado) en vez de una estadía de copropietario. */
  isBooking: boolean;
  titular: string;
  documentId: string | null;
  lugar: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  approved: boolean;
  approvedAt: string | null;
  people: AccessPerson[];
  /** El titular pasó por el mostrador. */
  titularCheckedIn: boolean;
  /** Cuántas personas del grupo se registraron, titular incluido. */
  checkedInCount: number;
};

export type AccessTarget = { bookingId: string | null; stayId: string | null };

export const SOURCE_LABELS: Record<string, string> = {
  alquiler: "Alquiler",
  afiliado: "Afiliado",
  copropietario: "Copropietario",
};

// El jsonb llega sin tipar: se filtra a los objetos que realmente traen nombre.
function toPeople(value: unknown): AccessPerson[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const person = item as Record<string, unknown>;
    const nombre = typeof person.nombre === "string" ? person.nombre : "";
    if (!nombre) return [];
    return [
      {
        nombre,
        carnet: typeof person.carnet === "string" ? person.carnet : "",
        registrado: person.registrado === true,
        manilla: person.manilla === true,
      },
    ];
  });
}

export async function listAccessEntries(params: {
  date?: string | null;
  search?: string | null;
}): Promise<AccessEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_access_entries", {
    p_date: params.date ?? null,
    p_search: params.search ?? null,
  });
  if (error) throw mapPostgresError(error.message);

  return (data ?? []).map((row) => ({
    source: row.source,
    entryId: row.entry_id,
    isBooking: row.source !== "copropietario",
    titular: row.titular,
    documentId: row.document_id,
    lugar: row.lugar,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guestCount: row.guest_count,
    approved: row.approved,
    approvedAt: row.approved_at,
    people: toPeople(row.people),
    titularCheckedIn: row.titular_checked_in,
    checkedInCount: row.checked_in_count,
  }));
}
