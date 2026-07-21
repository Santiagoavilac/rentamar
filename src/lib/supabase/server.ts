import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

// Cliente server (anon key) para Server Components y route handlers. Respeta RLS
// y la sesión del usuario a través de cookies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component sin respuesta mutable: ignorable
          // cuando hay middleware refrescando la sesión.
        }
      },
    },
  });
}
