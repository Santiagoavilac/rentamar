import { AdminPageHeader, EmptyState } from "@/components/admin/ui";
import { AvailabilityBoard } from "@/components/admin/availability-board";
import { listPlannerData, listPlannerProperties } from "@/lib/admin/availability";
import { parsePlannerQuery } from "@/lib/admin/planner-query";
import { requireStaff } from "@/lib/auth";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = parsePlannerQuery(params);
  const requestedView = Array.isArray(params.view) ? params.view[0] : params.view;
  const view = requestedView === "list" ? "list" : "planner";
  const session = await requireStaff();
  const [data, allProperties] = await Promise.all([
    listPlannerData(query),
    listPlannerProperties(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Disponibilidad y reservas"
        description="Planificador operativo por propiedad. Los rangos incluyen la entrada y excluyen la salida."
      />
      {!allProperties.length ? (
        <EmptyState
          title="No hay propiedades"
          body="Primero creá una propiedad para gestionar su disponibilidad."
          href="/admin/properties/new"
          label="Nueva propiedad"
        />
      ) : (
        <AvailabilityBoard
          data={data}
          allProperties={allProperties}
          query={query}
          view={view}
          role={session.role}
        />
      )}
    </>
  );
}
