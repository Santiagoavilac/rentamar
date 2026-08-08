import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildAvailabilityCsv, buildAvailabilityWorkbook } from "./availability-export";
import type { PlannerData } from "./availability";

const data: PlannerData = {
  properties: [
    {
      id: "a1111111-1111-4111-8111-111111111111",
      name: "Casa Ñandú",
      slug: "casa-nandu",
      status: "published",
      zone: null,
    },
  ],
  events: [
    {
      id: "b1111111-1111-4111-8111-111111111111",
      entity: "booking",
      state: "pre_reservation",
      propertyId: "a1111111-1111-4111-8111-111111111111",
      from: "2026-07-26",
      to: "2026-07-28",
      title: "Pre-reserva",
      guestName: "Ana Pérez",
      guestEmail: "ana@example.com",
      guestPhone: "+59170000000",
      guestCount: 2,
      channel: "direct",
      reason: null,
      blockType: null,
      bookingStatus: "pending_payment",
      paymentStatus: "unpaid",
      holdStatus: "active",
      holdExpiresAt: "2026-07-26T22:00:00Z",
      totalMinor: 120000,
      currency: "BOB",
      createdAt: "2026-07-26T12:00:00Z",
    },
    {
      id: "c1111111-1111-4111-8111-111111111111",
      entity: "block",
      state: "blocked",
      propertyId: "a1111111-1111-4111-8111-111111111111",
      from: "2026-07-29",
      to: "2026-07-30",
      title: "Bloqueado",
      guestName: null,
      guestEmail: null,
      guestPhone: null,
      guestCount: null,
      channel: null,
      reason: "Mantenimiento, piscina",
      blockType: "maintenance",
      bookingStatus: null,
      paymentStatus: null,
      holdStatus: null,
      holdExpiresAt: null,
      totalMinor: null,
      currency: null,
      createdAt: "2026-07-26T13:00:00Z",
    },
  ],
};

describe("availability export", () => {
  it("genera CSV UTF-8 y escapa valores", () => {
    const csv = buildAvailabilityCsv(data);
    expect(csv.startsWith("\uFEFFTipo")).toBe(true);
    expect(csv).toContain("Ana Pérez");
    expect(csv).toContain('"Mantenimiento, piscina"');
    expect(csv).not.toContain("access_token");
  });

  it("genera las cuatro hojas XLSX con calendario semiabierto", async () => {
    const buffer = await buildAvailabilityWorkbook(data, {
      from: "2026-07-26",
      to: "2026-07-31",
      propertyIds: [],
      states: [],
      search: "",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Reservas",
      "Bloqueos",
      "Calendario",
      "Resumen",
    ]);
    const calendar = workbook.getWorksheet("Calendario")!;
    expect(calendar.getRow(2).getCell(2).value).toContain("Pre-reserva");
    expect(calendar.getRow(2).getCell(4).value).toBe("");
  });

  it("neutraliza fórmulas en CSV y XLSX sin perder caracteres UTF-8", async () => {
    const unsafe: PlannerData = {
      properties: [
        {
          ...data.properties[0],
          name: '=HYPERLINK("https://example.com","Casa Ñandú")',
        },
      ],
      events: [
        {
          ...data.events[0],
          guestName: "+SUM(1,2)",
          guestEmail: "-10+20",
          guestPhone: "@SUM(1,2)",
        },
        {
          ...data.events[1],
          reason: '@HYPERLINK("https://example.com","Abrir")',
        },
      ],
    };

    const csv = buildAvailabilityCsv(unsafe);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+SUM(1,2)");
    expect(csv).toContain("'-10+20");
    expect(csv).toContain("'@SUM(1,2)");
    expect(csv).toContain("Casa Ñandú");

    const buffer = await buildAvailabilityWorkbook(unsafe, {
      from: "2026-07-26",
      to: "2026-07-31",
      propertyIds: [],
      states: [],
      search: "",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const reservations = workbook.getWorksheet("Reservas")!;
    const blocks = workbook.getWorksheet("Bloqueos")!;
    for (const value of [
      reservations.getCell("A2").value,
      reservations.getCell("B2").value,
      reservations.getCell("C2").value,
      reservations.getCell("D2").value,
      blocks.getCell("E2").value,
    ]) {
      expect(typeof value).toBe("string");
      expect(String(value)).toMatch(/^'/);
      expect(value).not.toHaveProperty("formula");
      expect(value).not.toHaveProperty("hyperlink");
    }
  });
});
