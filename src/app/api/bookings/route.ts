import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
import { createBookingSchema } from "@/lib/validation";
import { createBooking } from "@/lib/bookings";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const limit = rateLimit(clientKey(request.headers, "create-booking"), 10, 60_000);
    if (!limit.ok) {
      return jsonResponse({ error: "RATE_LIMITED", message: "Demasiadas solicitudes" }, 429);
    }

    const input = await parseJsonBody(request, createBookingSchema);
    const booking = await createBooking(input);
    // accessToken se devuelve una única vez; no se registra en logs.
    return jsonResponse(booking, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
