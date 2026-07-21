import { errorResponse, jsonResponse } from "@/lib/http";
import { expireStalePayments } from "@/lib/payments";

// Endpoint interno para probar el barrido de pagos vencidos.
// Deshabilitado en producción. Requiere el header x-dev-secret.
export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return jsonResponse({ error: "NOT_FOUND" }, 404);
    }

    const secret = process.env.DEV_TASKS_SECRET;
    if (!secret || request.headers.get("x-dev-secret") !== secret) {
      return jsonResponse({ error: "UNAUTHORIZED" }, 401);
    }

    const expired = await expireStalePayments();
    return jsonResponse({ expired });
  } catch (error) {
    return errorResponse(error);
  }
}
