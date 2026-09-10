import { describe, expect, it } from "vitest";
import { buildCheckinsCsv, checkinsFilename } from "./admin/checkins-export";
import type { OfficeCheckinRow } from "./admin/access";

function row(overrides: Partial<OfficeCheckinRow> = {}): OfficeCheckinRow {
  return {
    source: "alquiler",
    entryId: "11111111-1111-1111-1111-111111111111",
    // 2026-09-10 14:30 en Bolivia (UTC-4).
    checkedInAt: "2026-09-10T18:30:00.000Z",
    titular: "Raúl Pazbauer",
    phone: "70011223",
    checkOut: "2026-09-14",
    lugar: "Depto. Nº 265",
    peopleCheckedIn: 2,
    guestCount: 4,
    ...overrides,
  };
}

describe("CSV de ingresos", () => {
  it("lleva las cuatro columnas pedidas, en ese orden", () => {
    const [headers] = buildCheckinsCsv([]).split("\r\n");
    expect(headers.replace("﻿", "")).toBe(
      "Fecha y hora de registro,Huésped titular,Teléfono,Fecha de salida",
    );
  });

  it("empieza con BOM para que Excel no rompa las tildes", () => {
    expect(buildCheckinsCsv([row()]).startsWith("﻿")).toBe(true);
  });

  it("escribe la hora en zona Bolivia, no en UTC", () => {
    const [, first] = buildCheckinsCsv([row()]).split("\r\n");
    expect(first).toContain("10/09/2026, 14:30");
  });

  it("un titular sin teléfono deja la celda vacía en vez de escribir null", () => {
    const [, first] = buildCheckinsCsv([row({ phone: null })]).split("\r\n");
    expect(first).toContain(",,2026-09-14");
  });

  it("entrecomilla los nombres con coma para no correr las columnas", () => {
    const [, first] = buildCheckinsCsv([row({ titular: "Pazbauer, Raúl" })]).split("\r\n");
    expect(first).toContain('"Pazbauer, Raúl"');
  });

  it("neutraliza un nombre que Excel interpretaría como fórmula", () => {
    const [, first] = buildCheckinsCsv([row({ titular: "=SUMA(A1:A9)" })]).split("\r\n");
    expect(first).toContain("'=SUMA(A1:A9)");
  });

  it("el nombre del archivo dice el día, o el rango cuando son varios", () => {
    expect(checkinsFilename("2026-09-10", "2026-09-10")).toBe("ingresos-2026-09-10.csv");
    expect(checkinsFilename("2026-09-01", "2026-09-10")).toBe("ingresos-2026-09-01_2026-09-10.csv");
  });
});
