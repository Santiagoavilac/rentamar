import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
import { quoteSchema } from "@/lib/validation";
import { getQuote } from "@/lib/bookings";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const limit = rateLimit(clientKey(request.headers, "quote"), 30, 60_000);
    if (!limit.ok) {
      return jsonResponse({ error: "RATE_LIMITED", message: "Demasiadas solicitudes" }, 429);
    }

    const input = await parseJsonBody(request, quoteSchema);
    const quote = await getQuote(input);
    return jsonResponse(quote);
  } catch (error) {
    return errorResponse(error);
  }
}
