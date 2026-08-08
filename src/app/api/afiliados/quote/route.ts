import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
import { affiliateQuoteSchema } from "@/lib/validation";
import { getAffiliateQuote } from "@/lib/affiliates";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const limit = rateLimit(clientKey(request.headers, "affiliate-quote"), 30, 60_000);
    if (!limit.ok) {
      return jsonResponse({ error: "RATE_LIMITED", message: "Demasiadas solicitudes" }, 429);
    }

    const input = await parseJsonBody(request, affiliateQuoteSchema);
    const quote = await getAffiliateQuote(input);
    return jsonResponse(quote);
  } catch (error) {
    return errorResponse(error);
  }
}
