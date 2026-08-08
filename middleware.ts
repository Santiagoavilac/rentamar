import type { NextRequest } from "next/server";
import { updateSession } from "./src/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Solo corre sobre las áreas autenticadas (excluye assets estáticos). El landing público
// y el catálogo quedan intactos.
export const config = {
  matcher: ["/admin/:path*", "/copropietarios/:path*", "/limpieza/:path*"],
};
