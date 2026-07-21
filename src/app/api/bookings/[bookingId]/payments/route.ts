import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
import { bookingIdSchema, createPaymentSchema } from "@/lib/validation";
import { createPaymentForBooking } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, ctx: { params: Promise<{ bookingId: string }> }) {
  try {
    const limit = rateLimit(clientKey(request.headers, "create-payment"), 10, 60_000);
    if (!limit.ok) {
      return jsonResponse(
        { error: "PAYMENT_RATE_LIMITED", message: "Demasiadas solicitudes" },
        429,
      );
    }

    const { bookingId } = await ctx.params;
    const parsed = bookingIdSchema.safeParse(bookingId);
    if (!parsed.success) {
      return jsonResponse({ error: "VALIDATION_ERROR" }, 400);
    }

    const input = await parseJsonBody(request, createPaymentSchema);

    const url = new URL(request.url);
    const token =
      request.headers.get("x-booking-token") ?? url.searchParams.get("token") ?? undefined;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payment = await createPaymentForBooking({
      bookingId: parsed.data,
      token,
      userId: user?.id,
      input,
    });

    return jsonResponse({ payment }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
