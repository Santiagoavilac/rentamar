import { z } from "zod";
import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { getBookingForAccess } from "@/lib/bookings";
import { getCoOwnerSession, getStaffSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { UnauthorizedBookingAccessError } from "@/lib/errors";
import { issueDeclaration, type DeclarationTarget } from "@/lib/declarations/issue";

// pdf-lib y la lectura de la plantilla necesitan Node, no el runtime edge.
export const runtime = "nodejs";

// El cuerpo nunca trae los datos que se imprimen: solo dice de qué reserva o estadía se
// trata. Todo lo que aparece en el PDF se lee de la base del lado del servidor.
const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("booking"),
    bookingId: z.uuid(),
    token: z.string().min(10).max(200).optional(),
    accept: z.literal(true),
  }),
  z.object({
    kind: z.literal("stay"),
    stayId: z.uuid(),
    accept: z.literal(true),
  }),
]);

export async function POST(request: Request) {
  try {
    const limit = rateLimit(clientKey(request.headers, "declaration"), 10, 60_000);
    if (!limit.ok) {
      return jsonResponse({ error: "RATE_LIMITED", message: "Demasiadas solicitudes" }, 429);
    }

    const body = await parseJsonBody(request, bodySchema);
    const staff = await getStaffSession();

    let target: DeclarationTarget;

    if (body.kind === "booking") {
      if (!staff) {
        // Reutiliza el control de acceso de la reserva: token válido o sesión del dueño.
        // Nunca alcanza con conocer el UUID.
        await getBookingForAccess({ bookingId: body.bookingId, token: body.token });
      }
      target = { kind: "booking", id: body.bookingId };
    } else {
      if (!staff) {
        const session = await getCoOwnerSession();
        if (!session) throw new UnauthorizedBookingAccessError();
        const { data: stay } = await createAdminClient()
          .from("co_owner_stays")
          .select("account_id")
          .eq("id", body.stayId)
          .maybeSingle();
        if (stay?.account_id !== session.userId) throw new UnauthorizedBookingAccessError();
      }
      target = { kind: "stay", id: body.stayId };
    }

    const { bytes, fileName } = await issueDeclaration({
      target,
      actorId: staff?.userId ?? null,
      actorRole: staff?.role ?? null,
    });

    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        // Contiene cédula y teléfono: no debe quedar en ninguna caché intermedia.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
