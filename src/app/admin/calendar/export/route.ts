import { getStaffSession } from "@/lib/auth";
import { canPerformAdminAction } from "@/lib/permissions";
import { listPlannerData } from "@/lib/admin/availability";
import { parsePlannerQuery } from "@/lib/admin/planner-query";
import {
  availabilityFilename,
  buildAvailabilityCsv,
  buildAvailabilityWorkbook,
} from "@/lib/admin/availability-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session || !canPerformAdminAction(session.role, "availability.export")) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const url = new URL(request.url);
  const query = parsePlannerQuery(Object.fromEntries(url.searchParams), 366);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const data = await listPlannerData(query);
  const filename = availabilityFilename(query, format);
  if (format === "csv") {
    return new Response(buildAvailabilityCsv(data), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
      },
    });
  }
  const workbook = await buildAvailabilityWorkbook(data, query);
  const body = new Uint8Array(workbook.byteLength);
  body.set(workbook);
  return new Response(body, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
