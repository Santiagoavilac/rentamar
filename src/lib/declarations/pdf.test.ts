import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildDeclarationPdf, fitText } from "./pdf";

const person = {
  fullName: "María Fernanda Gutiérrez Añez",
  documentId: "8452317",
  nationality: "Boliviana",
  city: "Santa Cruz de la Sierra",
  phone: "+591 70012345",
};

const reference = {
  code: "RM-2026-0042",
  propertyName: "Departamento Torre B 12A",
  checkIn: "2026-08-14",
  checkOut: "2026-08-18",
  adults: 2,
  minors: 1,
  minorsLabel: "Menores de 2 años",
  companions: [
    {
      fullName: "Juan Carlos Rojas",
      documentId: "5521904",
      phone: "+591 71122334",
      birthDate: "1988-03-21",
    },
    // Sin fecha de nacimiento: así llegan los acompañantes de una reserva pública.
    { fullName: "Ana Lucía Rojas", documentId: "9987123", phone: "" },
  ],
};

describe("declaración jurada en PDF", () => {
  it("emite la plantilla rellenada más el anexo", async () => {
    const bytes = await buildDeclarationPdf({
      person,
      reference,
      issuedAt: new Date(2026, 7, 3),
    });

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    // El anexo tiene que salir del mismo tamaño que la plantilla (A4 real, no carta).
    expect(pdf.getPage(1).getWidth()).toBeCloseTo(pdf.getPage(0).getWidth(), 1);
  });

  it("achica el texto para que un nombre largo no desborde su línea", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const largo = "María Fernanda de los Ángeles Gutiérrez Añez Villarroel";

    const size = fitText(font, largo, 172);
    expect(size).toBeLessThan(10);
    expect(font.widthOfTextAtSize(largo, size)).toBeLessThanOrEqual(172);
  });

  it("no baja del mínimo aunque el texto no entre", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(fitText(font, "x".repeat(400), 30)).toBe(6.5);
  });

  it("genera el documento aunque el nombre traiga caracteres fuera de WinAnsi", async () => {
    const bytes = await buildDeclarationPdf({
      person: { ...person, fullName: "Łukasz Wróbel 张伟" },
      reference: { ...reference, companions: [] },
      issuedAt: new Date(2026, 0, 15),
    });
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
