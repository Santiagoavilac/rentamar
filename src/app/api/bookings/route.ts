import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
import { createBookingSchema } from "@/lib/validation";
import { createBooking } from "@/lib/bookings";
import { clientIp, clientKey, rateLimit } from "@/lib/rate-limit";
import { isBannedGuestError, recordBannedAttempt } from "@/lib/banned-guests";

export async function POST(request: Request) {
  try {
    const limit = rateLimit(clientKey(request.headers, "create-booking"), 10, 60_000);
    if (!limit.ok) {
      return jsonResponse({ error: "RATE_LIMITED", message: "Demasiadas solicitudes" }, 429);
    }

    const input = await parseJsonBody(request, createBookingSchema);
    try {
      const booking = await createBooking(input);
      // accessToken se devuelve una única vez; no se registra en logs.
      return jsonResponse(booking, 201);
    } catch (error) {
      // El intento se registra desde acá y no desde el trigger: la excepción del trigger
      // hace rollback de su propia transacción, así que la fila se perdería.
      if (isBannedGuestError(error)) {
        await recordBannedAttempt({
          channel: "alquiler",
          submitted: [{ nombre: input.guest.name, carnet: input.guest.documentId }],
          ip: clientIp(request.headers),
        });
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
