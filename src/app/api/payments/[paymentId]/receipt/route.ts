import { errorResponse, jsonResponse } from "@/lib/http";
import { paymentIdSchema } from "@/lib/validation";
import { submitPaymentReceipt } from "@/lib/receipts/upload";
import { createClient } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";

// Node.js: se usan crypto/Buffer y se maneja un archivo binario.
export const runtime = "nodejs";

// Rechaza envíos cross-site: el comprobante solo se sube desde la propia app.
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // navegación same-origin no siempre manda Origin.
  const host = request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ paymentId: string }> }) {
  try {
    if (!sameOrigin(request)) {
      return jsonResponse({ error: "FORBIDDEN" }, 403);
    }

    const limit = rateLimit(clientKey(request.headers, "receipt-upload"), 6, 60_000);
    if (!limit.ok) {
      return jsonResponse({ error: "PAYMENT_RATE_LIMITED", message: "Demasiadas solicitudes" }, 429);
    }

    const { paymentId } = await ctx.params;
    const parsed = paymentIdSchema.safeParse(paymentId);
    if (!parsed.success) {
      return jsonResponse({ error: "VALIDATION_ERROR" }, 400);
    }

    const form = await request.formData();
    const file = form.get("receipt");
    if (!(file instanceof File)) {
      return jsonResponse({ error: "VALIDATION_ERROR", message: "Adjuntá el comprobante" }, 400);
    }

    const url = new URL(request.url);
    const token =
      request.headers.get("x-booking-token") ?? url.searchParams.get("token") ?? undefined;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await submitPaymentReceipt({
      paymentId: parsed.data,
      token,
      userId: user?.id,
      file,
    });

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
