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

type AuditRow = Awaited<ReturnType<typeof listAuditLogs>>["rows"][number];

export type AuditFeedRow = AuditRow & {
  actorName: string | null;
  entityTitle: string | null;
};

// Resuelve los UUID de la página a nombres legibles. Se consulta una tabla por cada
// entity_type presente, así que son unas pocas consultas para las 20 filas visibles.
export async function listAuditFeed(params: {
  page: number;
  pageSize: number;
  entityType?: string;
}) {
  const result = await listAuditLogs(params);
  const supabase = await createClient();

  const idsOf = (entityType: string) => [
    ...new Set(
      result.rows
        .filter((row) => row.entity_type === entityType && row.entity_id)
        .map((row) => row.entity_id as string),
    ),
  ];
  const actorIds = [
    ...new Set(result.rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))),
  ];
  const profileIds = [...new Set([...actorIds, ...idsOf("user")])];

  const lookup = async <T extends { id: string }>(
    table: "properties" | "bookings" | "maps" | "map_items" | "property_rates" | "profiles",
    columns: string,
    ids: string[],
  ): Promise<T[]> => {
    if (!ids.length) return [];
    const { data } = await supabase.from(table).select(columns).in("id", ids);
    return (data ?? []) as unknown as T[];
  };

  const [properties, bookings, maps, mapItems, rates, profiles] = await Promise.all([
    lookup<{ id: string; name: string }>("properties", "id, name", idsOf("property")),
    lookup<{ id: string; booking_code: string; guest_name: string | null }>(
      "bookings",
      "id, booking_code, guest_name",
      idsOf("booking"),
    ),
    lookup<{ id: string; name: string }>("maps", "id, name", idsOf("map")),
    lookup<{ id: string; name: string | null }>("map_items", "id, name", idsOf("map_item")),
    lookup<{ id: string; label: string | null }>(
      "property_rates",
      "id, label",
      idsOf("property_rate"),
    ),
    lookup<{ id: string; full_name: string | null; email: string | null }>(
      "profiles",
      "id, full_name, email",
      profileIds,
    ),
  ]);

  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]));
  const propertyMap = byId(properties);
  const bookingMap = byId(bookings);
  const mapMap = byId(maps);
  const mapItemMap = byId(mapItems);
  const rateMap = byId(rates);
  const profileMap = byId(profiles);

  const personName = (id: string) => {
    const profile = profileMap.get(id);
    return profile?.full_name || profile?.email || null;
  };

  const titleFor = (row: AuditRow): string | null => {
    const id = row.entity_id;
    if (!id) return null;
    switch (row.entity_type) {
      case "property":
        return propertyMap.get(id)?.name ?? null;
      case "booking": {
        const booking = bookingMap.get(id);
        if (!booking) return null;
        return booking.guest_name
          ? `Reserva ${booking.booking_code} · ${booking.guest_name}`
          : `Reserva ${booking.booking_code}`;
      }
      case "map":
        return mapMap.get(id)?.name ?? null;
      case "map_item":
        return mapItemMap.get(id)?.name ?? null;
      case "property_rate":
        return rateMap.get(id)?.label ?? null;
      case "user":
        return personName(id);
      default:
        return null;
    }
  };

  return {
    ...result,
    rows: result.rows.map((row) => ({
      ...row,
      actorName: row.actor_id ? personName(row.actor_id) : null,
      entityTitle: titleFor(row),
    })) satisfies AuditFeedRow[],
  };
}
