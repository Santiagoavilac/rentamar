import "server-only";
import ExcelJS from "exceljs";
import { dateRange, PLANNER_STATE_LABELS as STATE_LABEL } from "@/lib/admin/planner-query";
import type { PlannerData, PlannerEvent } from "@/lib/admin/availability";
import type { PlannerQueryInput } from "@/lib/validation";
import type { PlannerState } from "@/lib/admin/availability";

const STATE_FILL: Record<PlannerState, string> = {
  pre_reservation: "FFFDE68A",
  rental: "FF99F6E4",
  blocked: "FFFDA4AF",
  affiliate_pending: "FFDDD6FE",
  affiliate_confirmed: "FFC4B5FD",
};

function spreadsheetText(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvValue(value: unknown): string {
  const text = spreadsheetText(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildAvailabilityCsv(data: PlannerData): string {
  const propertyById = new Map(data.properties.map((property) => [property.id, property]));
  const headers = [
    "Tipo",
    "Propiedad",
    "Código propiedad",
    "Huésped",
    "Email",
    "Teléfono",
    "Desde",
    "Hasta",
    "Estado interno",
    "Pago",
    "Vencimiento",
    "Motivo",
    "Creado",
  ];
  const rows = data.events.map((event) => {
    const property = propertyById.get(event.propertyId);
    return [
      STATE_LABEL[event.state],
      property?.name,
      property?.slug,
      event.guestName,
      event.guestEmail,
      event.guestPhone,
      event.from,
      event.to,
      event.bookingStatus ?? event.blockType,
      event.paymentStatus,
      event.holdExpiresAt,
      event.reason,
      event.createdAt,
    ];
  });
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n")}`;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFF6F4EF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B141A" } };
  row.alignment = { vertical: "middle" };
}

function configureSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  styleHeader(sheet.getRow(1));
  sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(sheet.columnCount).letter}1` };
  sheet.columns.forEach((column) => {
    column.width = Math.min(34, Math.max(12, column.header?.toString().length ?? 12));
  });
}

function bookingRow(event: PlannerEvent, propertyName: string | undefined) {
  return {
    property: spreadsheetText(propertyName),
    guest: spreadsheetText(event.guestName),
    email: spreadsheetText(event.guestEmail),
    phone: spreadsheetText(event.guestPhone),
    from: event.from,
    to: event.to,
    state: STATE_LABEL[event.state],
    bookingStatus: event.bookingStatus ?? "",
    paymentStatus: event.paymentStatus ?? "",
    expiration: event.holdExpiresAt ?? "",
    total: event.totalMinor === null ? "" : event.totalMinor / 100,
    currency: event.currency ?? "",
    createdAt: event.createdAt,
  };
}

export async function buildAvailabilityWorkbook(
  data: PlannerData,
  query: PlannerQueryInput,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RentaMar";
  workbook.created = new Date();
  const propertyById = new Map(data.properties.map((property) => [property.id, property]));
  const bookings = data.events.filter((event) => event.entity === "booking");
  const blocks = data.events.filter((event) => event.entity === "block");

  const bookingSheet = workbook.addWorksheet("Reservas");
  bookingSheet.columns = [
    { header: "Propiedad", key: "property" },
    { header: "Huésped", key: "guest" },
    { header: "Email", key: "email" },
    { header: "Teléfono", key: "phone" },
    { header: "Desde", key: "from" },
    { header: "Hasta", key: "to" },
    { header: "Estado", key: "state" },
    { header: "Estado interno", key: "bookingStatus" },
    { header: "Pago", key: "paymentStatus" },
    { header: "Vencimiento", key: "expiration" },
    { header: "Total", key: "total" },
    { header: "Moneda", key: "currency" },
    { header: "Creado", key: "createdAt" },
  ];
  bookings.forEach((event) =>
    bookingSheet.addRow(bookingRow(event, propertyById.get(event.propertyId)?.name)),
  );
  bookingSheet.getColumn("total").numFmt = "#,##0.00";
  configureSheet(bookingSheet);

  const blockSheet = workbook.addWorksheet("Bloqueos");
  blockSheet.columns = [
    { header: "Propiedad", key: "property" },
    { header: "Desde", key: "from" },
    { header: "Hasta", key: "to" },
    { header: "Tipo", key: "type" },
    { header: "Motivo", key: "reason" },
    { header: "Estado", key: "status" },
    { header: "Creado", key: "createdAt" },
  ];
  blocks.forEach((event) =>
    blockSheet.addRow({
      property: spreadsheetText(propertyById.get(event.propertyId)?.name),
      from: event.from,
      to: event.to,
      type: event.blockType ?? "",
      reason: spreadsheetText(event.reason),
      status: "Bloqueado",
      createdAt: event.createdAt,
    }),
  );
  configureSheet(blockSheet);

  const calendarSheet = workbook.addWorksheet("Calendario");
  const days = dateRange(query.from, query.to);
  calendarSheet.addRow(["Propiedad", ...days]);
  calendarSheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  styleHeader(calendarSheet.getRow(1));
  calendarSheet.getColumn(1).width = 28;
  days.forEach((_, index) => (calendarSheet.getColumn(index + 2).width = 18));
  data.properties.forEach((property) => {
    const row = calendarSheet.addRow([spreadsheetText(property.name), ...days.map(() => "")]);
    const propertyEvents = data.events.filter((event) => event.propertyId === property.id);
    days.forEach((day, index) => {
      const event = propertyEvents.find((item) => item.from <= day && item.to > day);
      if (!event) return;
      const cell = row.getCell(index + 2);
      cell.value = [STATE_LABEL[event.state], spreadsheetText(event.guestName ?? event.reason)]
        .filter(Boolean)
        .join(" · ");
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: STATE_FILL[event.state] },
      };
      cell.alignment = { wrapText: true, vertical: "middle" };
    });
  });

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.columns = [
    { header: "Concepto", key: "label", width: 28 },
    { header: "Cantidad", key: "count", width: 14 },
  ];
  summarySheet.addRows([
    { label: "Propiedades", count: data.properties.length },
    { label: "Pre-reservas", count: bookings.filter((e) => e.state === "pre_reservation").length },
    { label: "Alquilados", count: bookings.filter((e) => e.state === "rental").length },
    {
      label: "Afiliados pendientes",
      count: bookings.filter((e) => e.state === "affiliate_pending").length,
    },
    {
      label: "Afiliados confirmados",
      count: bookings.filter((e) => e.state === "affiliate_confirmed").length,
    },
    { label: "Bloqueos", count: blocks.length },
  ]);
  configureSheet(summarySheet);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function availabilityFilename(query: PlannerQueryInput, format: "csv" | "xlsx") {
  return `rentamar-disponibilidad-${query.from}_a_${query.to}.${format}`;
}
