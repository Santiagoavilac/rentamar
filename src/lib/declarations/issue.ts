import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, NotFoundError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { Database } from "@/lib/supabase/types";
import {
  BOLIVIA_TIME_ZONE,
  DECLARATION_VERSION,
  buildDeclarationPdf,
  type DeclarationPerson,
  type DeclarationReference,
} from "./pdf";

const BUCKET = "declarations";

// Las estadías guardan timestamptz; el papel tiene que decir la fecha y la hora que
// declaró el copropietario, no su equivalente en UTC.
function boliviaDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOLIVIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function boliviaTime(iso: string): string {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: BOLIVIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

type UserRole = Database["public"]["Enums"]["user_role"];

export type DeclarationTarget = { kind: "booking"; id: string } | { kind: "stay"; id: string };

type Gathered = { person: DeclarationPerson; reference: DeclarationReference };

// Los datos salen siempre de la base con service_role, nunca del cuerpo de la petición:
// el cliente solo dice de qué reserva o estadía habla.
async function gather(target: DeclarationTarget): Promise<Gathered> {
  const supabase = createAdminClient();

  if (target.kind === "booking") {
    const { data: booking } = await supabase
      .from("bookings")
      .select(
        "booking_code, guest_name, guest_phone, guest_document_id, guest_nationality, guest_city, check_in, check_out, guests, properties(name)",
      )
      .eq("id", target.id)
      .maybeSingle();
    if (!booking) throw new NotFoundError("Reserva no encontrada");

    const { data: companions } = await supabase
      .from("booking_companions")
      .select("full_name, document_id, phone")
      .eq("booking_id", target.id)
      .order("sort_order");

    return {
      person: {
        fullName: booking.guest_name,
        documentId: booking.guest_document_id ?? "",
        nationality: booking.guest_nationality ?? "",
        city: booking.guest_city ?? "",
        phone: booking.guest_phone ?? "",
      },
      reference: {
        code: booking.booking_code,
        propertyName: booking.properties?.name ?? "Propiedad",
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        // Las reservas cuentan huéspedes sin separar menores; los acompañantes cargados
        // van en la tabla del anexo.
        adults: booking.guests,
        minors: 0,
        minorsLabel: "Menores",
        companions: (companions ?? []).map((c) => ({
          fullName: c.full_name,
          documentId: c.document_id,
          phone: c.phone ?? "",
        })),
      },
    };
  }

  const { data: stay } = await supabase
    .from("co_owner_stays")
    .select(
      "property_name, full_name, document_id, phone, nationality, city, check_in_at, check_out_at, adults, minors",
    )
    .eq("id", target.id)
    .maybeSingle();
  if (!stay) throw new NotFoundError("Estadía no encontrada");

  // Del huésped 2 en adelante: el 1 es quien firma y ya sale en la página 1.
  const { data: stayGuests } = await supabase
    .from("co_owner_stay_guests")
    .select("full_name, document_id, birth_date")
    .eq("stay_id", target.id)
    .order("sort_order");

  return {
    person: {
      fullName: stay.full_name,
      documentId: stay.document_id,
      nationality: stay.nationality ?? "",
      city: stay.city ?? "",
      phone: stay.phone,
    },
    reference: {
      // La estadía no tiene código propio: se usa un prefijo sobre su id para que el
      // papel impreso se pueda rastrear hasta la fila.
      code: `CO-${target.id.slice(0, 8).toUpperCase()}`,
      propertyName: stay.property_name,
      // check_in_at es timestamptz y llega en UTC: cortar el string daba el día siguiente
      // en toda entrada declarada después de las 20:00 hora de Bolivia.
      checkIn: boliviaDate(stay.check_in_at),
      checkOut: boliviaDate(stay.check_out_at),
      checkInTime: boliviaTime(stay.check_in_at),
      checkOutTime: boliviaTime(stay.check_out_at),
      adults: stay.adults,
      minors: stay.minors,
      minorsLabel: "Menores de 2 años",
      companions: (stayGuests ?? []).map((g) => ({
        fullName: g.full_name,
        documentId: g.document_id,
        birthDate: g.birth_date,
      })),
    },
  };
}

export type IssuedDeclaration = { bytes: Uint8Array; fileName: string };

// Una sola declaración por reserva o estadía. Si ya existe, se devuelve el archivo tal
// como se emitió: cambiar después un teléfono no debe cambiar un documento ya entregado.
export async function issueDeclaration(params: {
  target: DeclarationTarget;
  actorId: string | null;
  actorRole: UserRole | null;
}): Promise<IssuedDeclaration> {
  const { target, actorId, actorRole } = params;
  const supabase = createAdminClient();
  const column = target.kind === "booking" ? "booking_id" : "stay_id";

  const { data: existing } = await supabase
    .from("declarations")
    .select("pdf_path, data_snapshot")
    .eq(column, target.id)
    .maybeSingle();

  if (existing) {
    const { data: file, error } = await supabase.storage.from(BUCKET).download(existing.pdf_path);
    if (error || !file) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
    const snapshot = existing.data_snapshot as { reference?: { code?: string } };
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: `declaracion-${snapshot.reference?.code ?? "reserva"}.pdf`,
    };
  }

  const { person, reference } = await gather(target);
  const issuedAt = new Date();
  const bytes = await buildDeclarationPdf({ person, reference, issuedAt });

  const id = randomUUID();
  const pdfPath = `${issuedAt.getFullYear()}/${reference.code}-${id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(pdfPath, bytes, { contentType: "application/pdf" });
  if (uploadError) throw new AppError("INTERNAL_ERROR", "Error interno", 500);

  const { error: insertError } = await supabase.from("declarations").insert({
    id,
    booking_id: target.kind === "booking" ? target.id : null,
    stay_id: target.kind === "stay" ? target.id : null,
    accepted_at: issuedAt.toISOString(),
    pdf_path: pdfPath,
    document_version: DECLARATION_VERSION,
    data_snapshot: { person, reference } as never,
  });
  if (insertError) {
    // Si la fila no entra, el objeto huérfano quedaría ocupando el bucket sin registro.
    await supabase.storage.from(BUCKET).remove([pdfPath]);
    throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  }

  await writeAudit({
    actorId,
    actorRole,
    action: "declaration.generate",
    entityType: "declaration",
    entityId: id,
    after: { target, reference },
  });

  return { bytes, fileName: `declaracion-${reference.code}.pdf` };
}
