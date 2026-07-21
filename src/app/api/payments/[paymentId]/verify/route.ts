import { errorResponse, jsonResponse } from "@/lib/http";
import { paymentIdSchema } from "@/lib/validation";
import { verifyPayment } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, ctx: { params: Promise<{ paymentId: string }> }) {
  try {
    const limit = rateLimit(clientKey(request.headers, "verify-payment"), 12, 60_000);
    if (!limit.ok) {
      return jsonResponse(
        { error: "PAYMENT_RATE_LIMITED", message: "Demasiadas solicitudes" },
        429,
      );
    }

    const { paymentId } = await ctx.params;
    const parsed = paymentIdSchema.safeParse(paymentId);
    if (!parsed.success) {
      return jsonResponse({ error: "VALIDATION_ERROR" }, 400);
    }

    const url = new URL(request.url);
    const token =
      request.headers.get("x-booking-token") ?? url.searchParams.get("token") ?? undefined;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payment = await verifyPayment({ paymentId: parsed.data, token, userId: user?.id });
    return jsonResponse({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}
