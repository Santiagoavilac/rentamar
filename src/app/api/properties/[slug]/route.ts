import { errorResponse, jsonResponse } from "@/lib/http";
import { slugSchema } from "@/lib/validation";
import { getPropertyBySlug } from "@/lib/queries";

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const parsed = slugSchema.safeParse(slug);
    if (!parsed.success) {
      return jsonResponse({ error: "VALIDATION_ERROR" }, 400);
    }

    const property = await getPropertyBySlug(parsed.data);
    if (!property) {
      return jsonResponse({ error: "PROPERTY_NOT_FOUND", message: "Propiedad no encontrada" }, 404);
    }

    return jsonResponse({ property });
  } catch (error) {
    return errorResponse(error);
  }
}
