// Helpers de dinero. Todo se maneja en unidad menor (entero). Nunca floats internos.
// Bs 500,00 <=> 50000 minor.

const MINOR_PER_UNIT = 100;

export function minorToDecimalString(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const units = Math.floor(abs / MINOR_PER_UNIT);
  const cents = abs % MINOR_PER_UNIT;
  return `${negative ? "-" : ""}${units}.${cents.toString().padStart(2, "0")}`;
}

export function decimalStringToMinor(value: string): number {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Monto decimal inválido: ${value}`);
  }
  const negative = trimmed.startsWith("-");
  const [units, cents = ""] = trimmed.replace("-", "").split(".");
  const centsPadded = cents.padEnd(2, "0");
  const minor = Number(units) * MINOR_PER_UNIT + Number(centsPadded);
  return negative ? -minor : minor;
}

export function formatCurrency(minor: number, currency = "BOB", locale = "es-BO"): string {
  const symbol = currency === "BOB" ? "Bs" : currency;
  const amount = (minor / MINOR_PER_UNIT).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${amount}`;
}
