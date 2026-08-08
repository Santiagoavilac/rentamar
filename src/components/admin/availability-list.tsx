"use client";

import { useState } from "react";
import type { PlannerEvent, PlannerProperty } from "@/lib/admin/availability";
import { formatCurrency } from "@/lib/money";
import { DeclarationButton } from "@/components/declaration-button";

type AvailabilityListProps = {
  properties: PlannerProperty[];
  events: PlannerEvent[];
  onSelect: (event: PlannerEvent) => void;
};

export function AvailabilityList({ properties, events, onSelect }: AvailabilityListProps) {
  const [sort, setSort] = useState<"property" | "state" | "from">("from");
  const propertyById = new Map(properties.map((property) => [property.id, property.name]));
  const sortedEvents = [...events].sort((a, b) => {
    if (sort === "property")
      return (propertyById.get(a.propertyId) ?? "").localeCompare(
        propertyById.get(b.propertyId) ?? "",
        "es",
      );
    if (sort === "state") return a.state.localeCompare(b.state);
    return a.from.localeCompare(b.from);
  });
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">
              <button type="button" onClick={() => setSort("property")} className="font-bold">
                Propiedad
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" onClick={() => setSort("state")} className="font-bold">
                Tipo
              </button>
            </th>
            <th className="px-4 py-3">Huésped o motivo</th>
            <th className="px-4 py-3">
              <button type="button" onClick={() => setSort("from")} className="font-bold">
                Fechas
              </button>
            </th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Pago</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedEvents.map((event) => (
            <tr key={`${event.entity}-${event.id}`} className="border-t border-slate-100">
              <td className="px-4 py-3 font-semibold">{propertyById.get(event.propertyId)}</td>
              <td className="px-4 py-3">{event.title}</td>
              <td className="px-4 py-3">
                {event.guestName ?? event.reason ?? event.blockType ?? "Sin detalle"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {event.from} a {event.to}
              </td>
              <td className="px-4 py-3">{event.bookingStatus ?? event.blockType}</td>
              <td className="px-4 py-3">{event.paymentStatus ?? "-"}</td>
              <td className="px-4 py-3">
                {event.totalMinor === null
                  ? "-"
                  : formatCurrency(event.totalMinor, event.currency ?? "BOB")}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onSelect(event)}
                    className="font-semibold text-cyan-700"
                  >
                    Ver detalle
                  </button>
                  {event.entity === "booking" ? (
                    <DeclarationButton
                      compact
                      requireAccept={false}
                      target={{ kind: "booking", bookingId: event.id }}
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!events.length ? (
        <p className="p-8 text-center text-sm text-slate-500">
          No hay registros para los filtros seleccionados.
        </p>
      ) : null}
    </div>
  );
}
