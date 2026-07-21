import { errorResponse, jsonResponse } from "@/lib/http";
import { bookingIdSchema } from "@/lib/validation";
import { getBookingForAccess } from "@/lib/bookings";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, ctx: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await ctx.params;
    const parsed = bookingIdSchema.safeParse(bookingId);
    if (!parsed.success) {
      return jsonResponse({ error: "VALIDATION_ERROR" }, 400);
    }

    // Token de invitado por header o query. Sesión del dueño vía Supabase Auth.
    const url = new URL(request.url);
    const token =
      request.headers.get("x-booking-token") ?? url.searchParams.get("token") ?? undefined;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const booking = await getBookingForAccess({
      bookingId: parsed.data,
      token,
      userId: user?.id,
    });

    return jsonResponse({ booking });
  } catch (error) {
    return errorResponse(error);
  }
}
