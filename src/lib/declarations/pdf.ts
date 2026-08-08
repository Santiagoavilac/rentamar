import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

// Versión de la plantilla. Queda guardada en cada declaración emitida: si mañana cambia el
// documento, se puede saber con cuál se generó cada PDF viejo.
export const DECLARATION_VERSION = "2026-08-v1";

const TEMPLATE_PATH = path.join(process.cwd(), "public", "templates", "declaracion-jurada.pdf");

export type DeclarationPerson = {
  fullName: string;
  documentId: string;
  nationality: string;
  city: string;
  phone: string;
};

export type DeclarationCompanion = {
  fullName: string;
  documentId: string;
  phone: string;
  // Solo las estadías de copropietarios la capturan; en las reservas la columna va vacía.
  birthDate?: string;
};

export type DeclarationReference = {
  code: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  minors: number;
  // Las estadías cuentan solo menores de 2 años; las reservas, menores en general.
  minorsLabel: string;
  companions: DeclarationCompanion[];
};

/*
 * Posiciones reales de cada línea de guiones de la plantilla, en puntos y con el origen
 * abajo a la izquierda (A4 de 595.44 x 841.92). Salieron de decodificar el content stream
 * del PDF, no de estimarlas a ojo: el documento dibuja el texto con una matriz `cm` de 0.24,
 * así que la coordenada visible es 0.24 * Tm + desplazamiento.
 *
 * `y` es la línea base. `width` es el espacio disponible antes del texto que sigue.
 */
const FIELDS = {
  nameTop: { x: 111.5, y: 698.2, width: 180 },
  // La plantilla no trae línea para el DNI en el primer párrafo: corta en "(DNI) N°," y
  // quedan ~30 pt hasta el margen. Por eso este campo se achica más que el resto.
  documentTop: { x: 473, y: 698.2, width: 30 },
  // El ancho está ajustado para tapar todos los guiones sin comerse la coma que sigue.
  nationality: { x: 252, y: 677.8, width: 144 },
  city: { x: 231, y: 663.1, width: 169.5 },
  nameBottom: { x: 206, y: 198.0, width: 159 },
  documentBottom: { x: 206, y: 183.6, width: 159 },
  phone: { x: 200, y: 169.0, width: 156 },
  day: { x: 230, y: 98.9, width: 84 },
  month: { x: 340, y: 98.9, width: 46 },
  // El año está impreso ("del 2026"), así que se tapa y se reescribe entero.
  year: { x: 388, y: 98.9, width: 52 },
} as const;

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Helvetica solo codifica WinAnsi. Un nombre con caracteres fuera de ese rango haría
// explotar drawText, así que primero se les quitan los diacríticos y lo que aun así no
// entra se descarta. Vale perder una tilde rara antes que no poder emitir el documento.
function toWinAnsi(text: string): string {
  const supported = /[\u0020-\u007E\u00A0-\u00FF]/;
  return [...text.normalize("NFC")]
    .map((char) => {
      if (supported.test(char)) return char;
      const stripped = char.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
      return [...stripped].every((c) => supported.test(c)) ? stripped : "";
    })
    .join("");
}

// Reduce el tamaño hasta que el texto entre en el ancho disponible. Un nombre largo se
// achica en vez de pisar el texto que viene después.
export function fitText(
  font: PDFFont,
  text: string,
  maxWidth: number,
  start = 10,
  min = 6.5,
): number {
  let size = start;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.25;
  }
  return size;
}

// Tapa la línea de guiones con un rectángulo blanco y escribe el dato encima.
function writeOver(
  page: PDFPage,
  font: PDFFont,
  text: string,
  field: { x: number; y: number; width: number },
) {
  const value = toWinAnsi(text).trim();
  if (!value) return;

  page.drawRectangle({
    x: field.x - 2,
    y: field.y - 3.5,
    width: field.width + 4,
    height: 13,
    color: rgb(1, 1, 1),
  });

  page.drawText(value, {
    x: field.x,
    y: field.y,
    size: fitText(font, value, field.width),
    font,
    color: rgb(0, 0, 0),
  });
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

// ---------- Página 2: anexo ----------
// La declaración original no menciona ninguna reserva concreta, solo remite al "formulario
// de arrendamiento". Este anexo ata el documento a una reserva y lista a los acompañantes,
// sin tocar el diseño de la página 1.
function drawAnnex(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  reference: DeclarationReference,
) {
  const { width, height } = page.getSize();
  const left = 90;
  let y = height - 90;

  const line = (text: string, font: PDFFont, size: number, gap = 18) => {
    page.drawText(toWinAnsi(text), { x: left, y, size, font, color: rgb(0, 0, 0) });
    y -= gap;
  };

  page.drawText(toWinAnsi("Anexo - Datos de la reserva"), {
    x: left,
    y,
    size: 16,
    font: fonts.bold,
    color: rgb(0.212, 0.373, 0.569),
  });
  y -= 34;

  const rows: Array<[string, string]> = [
    ["N° de reserva:", reference.code],
    ["Inmueble:", reference.propertyName],
    ["Fecha de ingreso:", formatDate(reference.checkIn)],
    ["Fecha de salida:", formatDate(reference.checkOut)],
    ["Adultos:", String(reference.adults)],
    [`${reference.minorsLabel}:`, String(reference.minors)],
  ];

  for (const [label, value] of rows) {
    page.drawText(toWinAnsi(label), { x: left, y, size: 11, font: fonts.bold });
    page.drawText(toWinAnsi(value), { x: left + 130, y, size: 11, font: fonts.regular });
    y -= 18;
  }

  y -= 16;
  line("Acompañantes", fonts.bold, 13, 22);

  if (reference.companions.length === 0) {
    line("Sin acompañantes declarados.", fonts.regular, 11);
  } else {
    page.drawText(toWinAnsi("Nombre completo"), { x: left, y, size: 10, font: fonts.bold });
    page.drawText(toWinAnsi("Documento"), { x: left + 165, y, size: 10, font: fonts.bold });
    page.drawText(toWinAnsi("Teléfono"), { x: left + 255, y, size: 10, font: fonts.bold });
    page.drawText(toWinAnsi("Nacimiento"), { x: left + 325, y, size: 10, font: fonts.bold });
    y -= 6;
    page.drawLine({
      start: { x: left, y },
      end: { x: width - left, y },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= 16;

    for (const companion of reference.companions) {
      const name = toWinAnsi(companion.fullName);
      page.drawText(name, {
        x: left,
        y,
        size: fitText(fonts.regular, name, 155, 10, 7),
        font: fonts.regular,
      });
      page.drawText(toWinAnsi(companion.documentId), {
        x: left + 165,
        y,
        size: 10,
        font: fonts.regular,
      });
      page.drawText(toWinAnsi(companion.phone), {
        x: left + 255,
        y,
        size: 10,
        font: fonts.regular,
      });
      page.drawText(companion.birthDate ? formatDate(companion.birthDate) : "", {
        x: left + 325,
        y,
        size: 10,
        font: fonts.regular,
      });
      y -= 16;
      if (y < 90) break;
    }
  }
}

// Deja constancia de que el documento todavía no está firmado. Sin esto el PDF podría
// pasar por una declaración ya suscrita, que es justo lo que no es.
function drawFooter(page: PDFPage, font: PDFFont, issuedAt: Date) {
  const text = `Documento generado el ${issuedAt.toLocaleDateString("es-BO")} - pendiente de firma`;
  page.drawText(toWinAnsi(text), {
    x: 90,
    y: 46,
    size: 8,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
}

export async function buildDeclarationPdf(params: {
  person: DeclarationPerson;
  reference: DeclarationReference;
  issuedAt: Date;
}): Promise<Uint8Array> {
  const { person, reference, issuedAt } = params;

  const pdf = await PDFDocument.load(await readFile(TEMPLATE_PATH));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.getPage(0);

  writeOver(page, regular, person.fullName, FIELDS.nameTop);
  writeOver(page, regular, person.documentId, FIELDS.documentTop);
  writeOver(page, regular, person.nationality, FIELDS.nationality);
  writeOver(page, regular, person.city, FIELDS.city);
  writeOver(page, regular, person.fullName, FIELDS.nameBottom);
  writeOver(page, regular, person.documentId, FIELDS.documentBottom);
  writeOver(page, regular, person.phone, FIELDS.phone);

  writeOver(page, regular, String(issuedAt.getDate()), FIELDS.day);
  writeOver(page, regular, MONTHS[issuedAt.getMonth()], FIELDS.month);
  writeOver(page, regular, `del ${issuedAt.getFullYear()}`, FIELDS.year);

  // La línea de "Firma:" (y ≈ 133.9) se deja intacta a propósito: se firma a mano.

  drawFooter(page, regular, issuedAt);

  const annex = pdf.addPage([page.getWidth(), page.getHeight()]);
  drawAnnex(annex, { regular, bold }, reference);
  drawFooter(annex, regular, issuedAt);

  return pdf.save();
}
