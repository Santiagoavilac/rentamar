"use client";

import {
  addDaysIso,
  dateRange,
  daysBetween,
  todayInLaPaz,
  PLANNER_STATE_TONES,
} from "@/lib/admin/planner-query";
import type { PlannerEvent, PlannerProperty } from "@/lib/admin/availability";

const DAY_WIDTH = 44;

type PlannerGridProps = {
  from: string;
  to: string;
  properties: PlannerProperty[];
  events: PlannerEvent[];
  onSelect: (event: PlannerEvent) => void;
  onNewAt: (propertyId: string, from: string, to: string) => void;
};

export function PlannerGrid({ from, to, properties, events, onSelect, onNewAt }: PlannerGridProps) {
  const days = dateRange(from, to);
  const today = todayInLaPaz();
  const timelineWidth = days.length * DAY_WIDTH;

  return (
    <div className="planner-scroll max-h-[68vh] overflow-auto rounded-xl border border-slate-200 bg-white">
      <div className="min-w-max">
        <div className="sticky top-0 z-30 flex border-b border-slate-200 bg-white shadow-sm">
          <div className="sticky left-0 z-40 flex w-56 shrink-0 items-center border-r border-slate-200 bg-white px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            Propiedad
          </div>
          <div className="flex" style={{ width: timelineWidth }}>
            {days.map((day) => {
              const date = new Date(`${day}T12:00:00Z`);
              const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
              return (
                <div
                  key={day}
                  className={`flex w-11 shrink-0 flex-col items-center border-r border-slate-100 py-2 text-xs ${
                    day === today
                      ? "bg-cyan-50 font-bold text-cyan-800"
                      : weekend
                        ? "bg-slate-50 text-slate-500"
                        : "text-slate-600"
                  }`}
                >
                  <span className="uppercase">
                    {date
                      .toLocaleDateString("es-BO", { weekday: "short", timeZone: "UTC" })
                      .slice(0, 2)}
                  </span>
                  <span className="mt-0.5 text-sm">{date.getUTCDate()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {properties.map((property) => {
          const propertyEvents = events.filter((event) => event.propertyId === property.id);
          return (
            <div
              key={property.id}
              className="flex min-h-16 border-b border-slate-100 last:border-b-0"
            >
              <div className="sticky left-0 z-20 flex w-56 shrink-0 flex-col justify-center border-r border-slate-200 bg-white px-4 py-3 shadow-[4px_0_10px_-8px_rgba(15,23,42,.4)]">
                <strong className="truncate text-sm text-night">{property.name}</strong>
                <span className="truncate text-xs text-slate-500">{property.slug}</span>
              </div>
              <div className="relative min-h-16" style={{ width: timelineWidth }}>
                <div className="absolute inset-0 flex">
                  {days.map((day) => {
                    const date = new Date(`${day}T12:00:00Z`);
                    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`h-full w-11 shrink-0 border-r border-slate-100 ${
                          day === today ? "bg-cyan-50/70" : weekend ? "bg-slate-50/70" : "bg-white"
                        } hover:bg-cyan-50`}
                        aria-label={`Crear registro en ${property.name} el ${day}`}
                        onClick={() => onNewAt(property.id, day, addDaysIso(day, 1))}
                      />
                    );
                  })}
                </div>
                {propertyEvents.map((event) => {
                  const visibleFrom = event.from < from ? from : event.from;
                  const visibleTo = event.to > to ? to : event.to;
                  const offset = Math.max(0, daysBetween(from, visibleFrom));
                  const span = Math.max(1, daysBetween(visibleFrom, visibleTo));
                  const tone = PLANNER_STATE_TONES[event.state];
                  const detail =
                    event.guestName ?? event.reason ?? event.blockType ?? "Sin detalle";
                  return (
                    <button
                      key={`${event.entity}-${event.id}`}
                      type="button"
                      className={`absolute top-3 z-10 h-10 overflow-hidden rounded-md border px-2 text-left text-xs shadow-sm ${tone}`}
                      style={{ left: offset * DAY_WIDTH + 2, width: span * DAY_WIDTH - 4 }}
                      onClick={() => onSelect(event)}
                      title={`${event.title} · ${detail}`}
                    >
                      <span className="block truncate font-bold">{event.title}</span>
                      <span className="block truncate opacity-85">{detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
