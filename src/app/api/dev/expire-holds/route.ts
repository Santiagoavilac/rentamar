import { errorResponse, jsonResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

// Endpoint interno para probar el barrido de holds vencidos.
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

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("expire_stale_holds");
    if (error) throw error;

    return jsonResponse({ expired: data });
  } catch (error) {
    return errorResponse(error);
  }
}
