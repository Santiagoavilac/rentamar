import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { SUPABASE_URL } from "./env";

// Cliente admin con service role. NUNCA importar desde código cliente:
// `server-only` hace fallar el build si algún bundle del navegador lo incluye.
// Bypassa RLS; usar solo para lógica de negocio server-side controlada.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cliente admin.",
    );
  }

  return createSupabaseClient<Database>(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
