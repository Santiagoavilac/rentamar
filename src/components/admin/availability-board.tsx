"use client";

import { useCallback, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  addDaysIso,
  monthRange,
  plannerQueryString,
  todayInLaPaz,
  PLANNER_STATE_LABELS,
  PLANNER_STATE_TONES,
} from "@/lib/admin/planner-query";
import type {
  PlannerData,
  PlannerEvent,
  PlannerProperty,
  PlannerState,
} from "@/lib/admin/availability";
import type { PlannerQueryInput } from "@/lib/validation";
import type { StaffRole } from "@/lib/permissions";
import { PlannerGrid } from "@/components/admin/planner-grid";
import { AvailabilityList } from "@/components/admin/availability-list";
import { AvailabilityEditor, type NewRecordDraft } from "@/components/admin/availability-editor";

type View = "planner" | "list";

const MONTH_LABEL = new Intl.DateTimeFormat("es-BO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// Lista fija alrededor del mes actual, más el mes consultado si cae fuera del rango.
function buildMonthOptions(selected: string) {
  const anchor = todayInLaPaz().slice(0, 7);
  const [year, month] = anchor.split("-").map(Number);
  const values = new Set<string>();
  for (let offset = -6; offset <= 18; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    values.add(date.toISOString().slice(0, 7));
  }
  values.add(selected);
  return [...values].sort().map((value) => ({
    value,
    label: MONTH_LABEL.format(new Date(`${value}-01T00:00:00Z`)),
  }));
}

type AvailabilityBoardProps = {
  data: PlannerData;
  allProperties: PlannerProperty[];
  query: PlannerQueryInput;
  view: View;
  role: StaffRole;
};

export function AvailabilityBoard({
  data,
  allProperties,
  query,
  view,
  role,
}: AvailabilityBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentParams = useSearchParams();
  const [selected, setSelected] = useState<PlannerEvent | null>(null);
  const [draft, setDraft] = useState<NewRecordDraft | null>(null);
  const [propertySearch, setPropertySearch] = useState("");
  const closeEditor = useCallback(() => {
    setSelected(null);
    setDraft(null);
  }, []);
  const defaultProperty = query.propertyIds[0] ?? allProperties[0]?.id ?? "";
  const exportParams = plannerQueryString(query);
  exportParams.set("format", "csv");

  const navigate = (nextQuery: PlannerQueryInput, nextView = view) => {
    const params = plannerQueryString(nextQuery);
    params.set("view", nextView);
    router.replace(`${pathname}?${params.toString()}`);
  };
  const handleFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const month = String(formData.get("month") || query.from.slice(0, 7));
    navigate({
      ...monthRange(month),
      propertyIds: formData.getAll("propertyIds").map(String),
      states: formData.getAll("states").map(String) as PlannerState[],
      search: "",
    });
  };
  const openDraft = (
    kind: NewRecordDraft["kind"],
    propertyId = defaultProperty,
    from = query.from,
    to = addDaysIso(query.from, 1),
  ) => setDraft({ kind, propertyId, from, to });
  const monthOptions = buildMonthOptions(query.from.slice(0, 7));
  const tabs: Array<[View, string]> = [
    ["planner", "Calendario"],
    ["list", "Lista"],
  ];

  return (
    <div className="grid gap-5">
      <section className="surface rounded-2xl p-4">
        <form
          onSubmit={handleFilters}
          className="grid gap-4 xl:grid-cols-[auto_minmax(160px,1fr)_minmax(180px,1.2fr)_auto] xl:items-end"
        >
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Mes
            <select
              name="month"
              defaultValue={query.from.slice(0, 7)}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case text-night"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Propiedades
            </span>
            <details className="relative mt-1">
              <summary className="cursor-pointer list-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-night">
                {query.propertyIds.length
                  ? `${query.propertyIds.length} seleccionadas`
                  : "Todas las propiedades"}
              </summary>
              <div className="absolute z-40 mt-1 w-full min-w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                <input
                  value={propertySearch}
                  onChange={(event) => setPropertySearch(event.target.value)}
                  placeholder="Buscar propiedad"
                  className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm normal-case"
                />
                <div className="max-h-48 overflow-auto">
                  {allProperties.map((property) => (
                    <label
                      key={property.id}
                      className={`${property.name.toLocaleLowerCase("es").includes(propertySearch.toLocaleLowerCase("es")) || property.slug.includes(propertySearch.toLocaleLowerCase("es")) ? "flex" : "hidden"} gap-2 py-1 text-sm font-normal normal-case text-night`}
                    >
                      <input
                        type="checkbox"
                        name="propertyIds"
                        value={property.id}
                        defaultChecked={query.propertyIds.includes(property.id)}
                      />
                      {property.name}
                    </label>
                  ))}
                </div>
              </div>
            </details>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Estados
            </span>
            <div className="mt-2 flex flex-wrap gap-3">
              {Object.entries(PLANNER_STATE_LABELS).map(([value, label]) => (
                <label key={value} className="flex gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="states"
                    value={value}
                    defaultChecked={query.states.includes(value as PlannerState)}
                  />{" "}
                  {label}
                </label>
              ))}
            </div>
          </div>
          <button className="rounded-lg bg-deep px-4 py-2.5 text-sm font-bold text-cream">
            Aplicar filtros
          </button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="text-sm text-slate-500">Hoy: {todayInLaPaz()}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <a
              href={`/admin/calendar/export?${exportParams.toString()}`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
            >
              CSV
            </a>
            <a
              href={`/admin/calendar/export?${exportParams.toString().replace("format=csv", "format=xlsx")}`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
            >
              Excel
            </a>
            <button
              type="button"
              onClick={() => openDraft("pre_reservation")}
              className="rounded-lg bg-amber-200 px-3 py-2 text-sm font-bold text-amber-950"
            >
              Nueva pre-reserva
            </button>
            {role === "admin" ? (
              <button
                type="button"
                onClick={() => openDraft("rental")}
                className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white"
              >
                Nuevo alquiler
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openDraft("blocked")}
              className="rounded-lg bg-rose-200 px-3 py-2 text-sm font-bold text-rose-950"
            >
              Nuevo bloqueo
            </button>
          </div>
        </div>
      </section>

      <nav className="flex gap-2" aria-label="Vistas de disponibilidad">
        {tabs.map(([value, label]) => {
          const params = new URLSearchParams(currentParams);
          params.set("view", value);
          return (
            <Link
              key={value}
              href={`${pathname}?${params.toString()}`}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${view === value ? "bg-deep text-cream" : "border border-slate-300 bg-white text-night"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <section className="surface rounded-2xl p-4 sm:p-5">
        {view === "planner" ? (
          <PlannerGrid
            from={query.from}
            to={query.to}
            properties={data.properties}
            events={data.events}
            onSelect={(event) => {
              setDraft(null);
              setSelected(event);
            }}
            onNewAt={(propertyId, from, to) => openDraft("pre_reservation", propertyId, from, to)}
          />
        ) : null}
        {view === "list" ? (
          <AvailabilityList
            properties={data.properties}
            events={data.events}
            onSelect={(event) => {
              setDraft(null);
              setSelected(event);
            }}
          />
        ) : null}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
          {Object.entries(PLANNER_STATE_LABELS).map(([state, label]) => (
            <span key={state}>
              <i
                className={`mr-1 inline-block h-3 w-3 rounded-sm border ${PLANNER_STATE_TONES[state as PlannerState]}`}
              />
              {label}
            </span>
          ))}
          <span>
            <i className="mr-1 inline-block h-3 w-3 rounded-sm border bg-white" />
            Disponible
          </span>
        </div>
      </section>

      <AvailabilityEditor
        key={
          selected
            ? `${selected.entity}-${selected.id}`
            : draft
              ? `${draft.kind}-${draft.propertyId}-${draft.from}`
              : "closed"
        }
        properties={allProperties}
        role={role}
        selected={selected}
        draft={draft}
        onClose={closeEditor}
      />
    </div>
  );
}
