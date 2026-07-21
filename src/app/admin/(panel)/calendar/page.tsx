import { listProperties } from "@/lib/admin/properties";
import { listActiveBlocks, listOccupiedRanges } from "@/lib/admin/availability";
import { createBlockAction } from "@/lib/admin/actions";
import { AdminPageHeader, EmptyState, Panel, StatusBadge } from "@/components/admin/ui";
import { AdminCalendar } from "@/components/admin/calendar";
import { BlockForm } from "@/components/admin/forms";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const params = await searchParams;
  const properties = await listProperties({ page: 1, pageSize: 100 });
  const propertyId = params.propertyId || properties.rows[0]?.id;
  if (!propertyId)
    return (
      <>
        <AdminPageHeader title="Calendario" />
        <EmptyState
          title="No hay propiedades"
          body="Primero creá una propiedad para gestionar su disponibilidad."
          href="/admin/properties/new"
          label="Nueva propiedad"
        />
      </>
    );
  const [blocks, bookings] = await Promise.all([
    listActiveBlocks(propertyId),
    listOccupiedRanges(propertyId),
  ]);
  return (
    <>
      <AdminPageHeader
        title="Calendario y disponibilidad"
        description="Los bloqueos se validan contra holds y reservas en la RPC transaccional."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {properties.rows.map((p) => (
          <a
            key={p.id}
            href={`/admin/calendar?propertyId=${p.id}`}
            className={`rounded-full px-3 py-1.5 text-sm ${p.id === propertyId ? "bg-deep text-cream" : "bg-white text-night border"}`}
          >
            {p.name}
          </a>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_.75fr]">
        <Panel>
          <AdminCalendar blocks={blocks} bookings={bookings} />
        </Panel>
        <Panel>
          <h2 className="mb-4 font-bold">Bloquear fechas</h2>
          <BlockForm action={createBlockAction} propertyId={propertyId} />
          <h2 className="mb-3 mt-7 font-bold">Bloqueos activos</h2>
          {blocks.length ? (
            <ul className="grid gap-2">
              {blocks.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>
                    {b.from} a {b.to}
                    <small className="block text-slate-500">{b.reason || "Sin motivo"}</small>
                  </span>
                  <StatusBadge value={b.type} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">Sin bloqueos activos.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
