import "server-only";
import { ADMIN_TIME_ZONE } from "@/lib/admin/planner-query";
import type { OfficeCheckinRow } from "@/lib/admin/access";

// Descarga de los ingresos registrados en oficina. Son las cuatro columnas que pidió
// administración, en ese orden: cuándo se registró, quién es el titular, su teléfono y
// qué día se va.

// Mismo tratamiento que el export de disponibilidad: un texto que empieza con = + - @ se
// prefija con comilla simple para que Excel no lo interprete como fórmula.
function spreadsheetText(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvValue(value: unknown): string {
  const text = spreadsheetText(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Hora de Bolivia: el proceso corre en UTC en producción y la planilla se lee en Santa Cruz.
export function formatCheckinMoment(value: string): string {
  return new Date(value).toLocaleString("es-BO", {
    timeZone: ADMIN_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export const CHECKIN_CSV_HEADERS = [
  "Fecha y hora de registro",
  "Huésped titular",
  "Teléfono",
  "Fecha de salida",
] as const;

export function buildCheckinsCsv(rows: OfficeCheckinRow[]): string {
  const body = rows.map((row) => [
    formatCheckinMoment(row.checkedInAt),
    row.titular,
    row.phone ?? "",
    row.checkOut,
  ]);
  // El BOM es lo que hace que Excel abra las tildes bien.
  return `﻿${[CHECKIN_CSV_HEADERS, ...body]
    .map((row) => row.map(csvValue).join(","))
    .join("\r\n")}`;
}

export function checkinsFilename(from: string, to: string): string {
  return from === to ? `ingresos-${from}.csv` : `ingresos-${from}_${to}.csv`;
}

// Hoy en Bolivia. `new Date().toISOString()` daría el día siguiente después de las 20:00
// local, que es justo cuando recepción sigue registrando gente.
export function todayInBolivia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ADMIN_TIME_ZONE });
}

// El rango que espera la RPC. Con el offset de Bolivia: sin él el filtro se interpreta en
// UTC y el día queda corrido cuatro horas.
export function boliviaDayRange(from: string, to: string) {
  return { from: `${from}T00:00:00-04:00`, to: `${to}T23:59:59-04:00` };
}
