import { plannerQuerySchema, type PlannerQueryInput } from "@/lib/validation";

export const ADMIN_TIME_ZONE = "America/La_Paz";

// Etiquetas de estado del planificador. Viven acá (módulo compartido) y no en
// availability.ts, que es server-only y no puede importarse desde el cliente.
export const PLANNER_STATE_LABELS = {
  pre_reservation: "Pre-reserva",
  rental: "Alquilado",
  blocked: "Bloqueado",
  affiliate_pending: "Afiliado pendiente",
  affiliate_confirmed: "Afiliado confirmado",
} as const;

export const PLANNER_STATE_TONES = {
  pre_reservation: "border-amber-300 bg-amber-200 text-amber-950",
  rental: "border-teal-500 bg-teal-700 text-white",
  blocked: "border-rose-300 bg-rose-200 text-rose-950",
  affiliate_pending: "border-violet-300 bg-violet-200 text-violet-950",
  affiliate_confirmed: "border-violet-500 bg-violet-700 text-white",
} as const;

export function addDaysIso(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000,
  );
}

export function dateRange(from: string, to: string): string[] {
  const result: string[] = [];
  for (let current = from; current < to; current = addDaysIso(current, 1)) result.push(current);
  return result;
}

export function todayInLaPaz(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ADMIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// El planificador siempre muestra un mes entero, del día 1 al 1 del siguiente.
export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  const next = new Date(`${from}T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: next.toISOString().slice(0, 10) };
}

export function currentMonthRange(now = new Date()): { from: string; to: string } {
  return monthRange(todayInLaPaz(now).slice(0, 7));
}

type RawParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function many(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parsePlannerQuery(params: RawParams, maxDays = 62): PlannerQueryInput {
  const fallback = currentMonthRange();
  const candidate = plannerQuerySchema.safeParse({
    from: one(params.from) || fallback.from,
    to: one(params.to) || fallback.to,
    propertyIds: many(params.propertyIds),
    states: many(params.states),
    search: one(params.q),
  });
  const parsed = candidate.success
    ? candidate.data
    : { ...fallback, propertyIds: [], states: [], search: "" };
  if (daysBetween(parsed.from, parsed.to) > maxDays) {
    return { ...parsed, to: addDaysIso(parsed.from, maxDays) };
  }
  return parsed;
}

export function plannerQueryString(input: PlannerQueryInput): URLSearchParams {
  const params = new URLSearchParams({ from: input.from, to: input.to });
  if (input.propertyIds.length) params.set("propertyIds", input.propertyIds.join(","));
  if (input.states.length) params.set("states", input.states.join(","));
  if (input.search) params.set("q", input.search);
  return params;
}
