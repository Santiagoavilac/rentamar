import { errorResponse, jsonResponse } from "@/lib/http";
import { paymentIdSchema } from "@/lib/validation";
import { simulateMockPayment } from "@/lib/payments";

// Handler compartido de los endpoints dev de simulación. Solo dev (404 en prod),
// autenticado por x-dev-secret, sin token de reserva: solo mueve el estado del
// "banco" mock. La confirmación real de la reserva ocurre siempre vía verify.
export async function handleSimulate(
  request: Request,
  paymentId: string,
  status: "paid" | "expired" | "error",
) {
  try {
    if (process.env.NODE_ENV === "production") {
      return jsonResponse({ error: "NOT_FOUND" }, 404);
    }

    const secret = process.env.DEV_TASKS_SECRET;
    if (!secret || request.headers.get("x-dev-secret") !== secret) {
      return jsonResponse({ error: "UNAUTHORIZED" }, 401);
    }

    const parsed = paymentIdSchema.safeParse(paymentId);
    if (!parsed.success) {
      return jsonResponse({ error: "VALIDATION_ERROR" }, 400);
    }

    await simulateMockPayment(parsed.data, status);
    return jsonResponse({ ok: true, simulated: status });
  } catch (error) {
    return errorResponse(error);
  }
}
