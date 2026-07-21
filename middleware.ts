import type { NextRequest } from "next/server";
import { updateSession } from "./src/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Solo corre sobre /admin/** (excluye assets estáticos). El landing público queda intacto.
export const config = {
  matcher: ["/admin/:path*"],
};
