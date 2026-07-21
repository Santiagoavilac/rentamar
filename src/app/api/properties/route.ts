import { errorResponse, jsonResponse } from "@/lib/http";
import { propertiesQuerySchema } from "@/lib/validation";
import { getPublishedProperties } from "@/lib/queries";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = propertiesQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return jsonResponse({ error: "VALIDATION_ERROR", details: parsed.error.issues }, 400);
    }

    const properties = await getPublishedProperties({
      featured: parsed.data.featured,
      guests: parsed.data.guests,
    });

    return jsonResponse({ properties });
  } catch (error) {
    return errorResponse(error);
  }
}
