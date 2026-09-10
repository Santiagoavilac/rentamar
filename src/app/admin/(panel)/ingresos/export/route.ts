import { getStaffSession } from "@/lib/auth";
import { canPerformAdminAction } from "@/lib/permissions";
import { listOfficeCheckins } from "@/lib/admin/access";
import {
  boliviaDayRange,
  buildCheckinsCsv,
  checkinsFilename,
  todayInBolivia,
} from "@/lib/admin/checkins-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Descarga de los ingresos del rango que se está viendo en pantalla. Reemplaza el pedido
// de volcar cada check-in a una hoja de Google: los datos ya están acá y salen en CSV.
export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session || !canPerformAdminAction(session.role, "access.review")) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(request.url);
  const today = todayInBolivia();
  const from = url.searchParams.get("from") || today;
  const to = url.searchParams.get("to") || from;
  const range = boliviaDayRange(from, to);

  const rows = await listOfficeCheckins(range);
  return new Response(buildCheckinsCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${checkinsFilename(from, to)}"`,
      // Son datos personales: no se cachean en ningún lado.
      "cache-control": "private, no-store",
    },
  });
}
