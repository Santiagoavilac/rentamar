import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

// Refresca la sesión de Supabase en cookies (patrón estándar @supabase/ssr) y
// protege las rutas /admin: sin sesión de staff redirige a /admin/login.
// La verificación de rol fina (admin vs operator) se hace en cada página/acción.
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isLogin = path === "/admin/login";

  // Sin credenciales configuradas no podemos validar sesión; dejamos pasar para no
  // romper el build/preview. Las rutas admin igual fallarán al leer datos.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  // Ya autenticado y en el login: mandarlo al panel.
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
