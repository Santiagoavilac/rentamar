"use server";

import { headers } from "next/headers";
import { assertSameOrigin } from "@/lib/admin/context";
import { createAffiliateRequest, buildWhatsappMessage, buildWhatsappUrl } from "@/lib/affiliates";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertIdDocumentsValid, uploadBookingIdDocuments } from "@/lib/id-documents";
import { AppError } from "@/lib/errors";
import { createAffiliateRequestSchema } from "@/lib/validation";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export type AffiliateRequestState = {
  ok: boolean;
  message: string;
  whatsappUrl?: string;
  bookingCode?: string;
};

// Flujo anónimo: sin sesión que respalde al solicitante, la única defensa antes de
// bloquear inventario son el mismo origen, los dos buckets de rate limit y el tope
// por teléfono/CI que aplica la RPC.
export async function createAffiliateRequestAction(
  _prev: AffiliateRequestState,
  formData: FormData,
): Promise<AffiliateRequestState> {
  try {
    await assertSameOrigin();

    const h = await headers();
    const burst = rateLimit(clientKey(h, "affiliate-create"), 3, 60_000);
    if (!burst.ok) {
      return { ok: false, message: "Demasiadas solicitudes seguidas. Esperá un momento." };
    }
    const hourly = rateLimit(clientKey(h, "affiliate-create-hour"), 10, 3_600_000);
    if (!hourly.ok) {
      return { ok: false, message: "Alcanzaste el límite de solicitudes por hora." };
    }

    // El carnet (anverso y reverso) es obligatorio. Se valida antes de crear la
    // solicitud para no bloquear fechas si viene mal.
    const idFront = formData.get("idFront");
    const idBack = formData.get("idBack");
    if (!(idFront instanceof File) || !(idBack instanceof File)) {
      return { ok: false, message: "Subí el anverso y el reverso del carnet." };
    }
    assertIdDocumentsValid(idFront, idBack);

    const parsed = createAffiliateRequestSchema.safeParse({
      propertyId: formData.get("propertyId"),
      checkIn: formData.get("checkIn"),
      checkOut: formData.get("checkOut"),
      guestCount: Number(formData.get("guestCount")),
      affiliate: {
        fullName: formData.get("fullName"),
        documentId: formData.get("documentId"),
        phone: formData.get("phone"),
        email: formData.get("email") ?? "",
        nationality: formData.get("nationality"),
        city: formData.get("city"),
      },
      companions: JSON.parse(String(formData.get("companions") || "[]")),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const supabase = createAdminClient();
    const { data: property } = await supabase
      .from("properties")
      .select("name")
      .eq("id", parsed.data.propertyId)
      .maybeSingle();

    const result = await createAffiliateRequest(parsed.data);

    // Las fechas ya quedaron bloqueadas: si el carnet falla al subir, la reserva no se
    // pierde, pero el error se propaga para que el afiliado reintente.
    await uploadBookingIdDocuments({
      bookingId: result.bookingId,
      front: idFront,
      back: idBack,
    });

    const message = buildWhatsappMessage({
      propertyName: property?.name ?? "Propiedad",
      result,
      affiliate: parsed.data.affiliate,
      companions: parsed.data.companions,
      guestCount: parsed.data.guestCount,
    });

    return {
      ok: true,
      message: "Solicitud registrada. Las fechas quedaron bloqueadas hasta que la confirmemos.",
      whatsappUrl: buildWhatsappUrl(message),
      bookingCode: result.bookingCode,
    };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message };
    console.error("[affiliate-request]", error instanceof Error ? error.message : "unknown");
    return { ok: false, message: "No se pudo registrar la solicitud" };
  }
}
