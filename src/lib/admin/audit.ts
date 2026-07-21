import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

// Lectura de la bitácora central. RLS: solo admin (audit_logs_admin_read). La UI
// además exige requireAdmin. Append-only: no hay update/delete desde el panel.
export async function listAuditLogs(params: {
  page: number;
  pageSize: number;
  entityType?: string;
}) {
  const supabase = await createClient();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase
    .from("audit_logs")
    .select(
      "id, actor_id, actor_role, action, entity_type, entity_id, before_data, after_data, reason, request_id, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.entityType) query = query.eq("entity_type", params.entityType);

  const { data, error, count } = await query;
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return {
    rows: data ?? [],
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}
