import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

// Cada área autenticada tiene su propio login y su propio destino. El middleware solo
// exige "hay sesión"; el rol lo verifica cada página/acción (requireStaff, requireCoOwner),
// así un copropietario no entra al panel ni un staff a la ruta de copropietarios.
const AREAS = [
  { prefix: "/copropietarios", login: "/copropietarios/login", home: "/copropietarios" },
  { prefix: "/limpieza", login: "/limpieza/login", home: "/limpieza" },
  { prefix: "/admin", login: "/admin/login", home: "/admin" },
];

// Refresca la sesión de Supabase en cookies (patrón estándar @supabase/ssr) y protege
// las rutas autenticadas: sin sesión redirige al login del área correspondiente.
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const area = AREAS.find((candidate) => path.startsWith(candidate.prefix));
  if (!area) return response;
  const isLogin = path === area.login;

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
    url.pathname = area.login;
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  // Ya autenticado y en el login: mandarlo a su área.
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = area.home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
