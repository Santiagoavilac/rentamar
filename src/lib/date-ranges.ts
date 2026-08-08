export type ExclusiveDateRange = { from: string; to: string };

export function parsePostgresDateRange(value: string): ExclusiveDateRange | null {
  const match = value.match(/^\["?(\d{4}-\d{2}-\d{2})"?,"?(\d{4}-\d{2}-\d{2})"?\)$/);
  return match ? { from: match[1], to: match[2] } : null;
}

export function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isoToLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function nightsBetween(from: string, to: string): number {
  return Math.round((isoToLocalDate(to).getTime() - isoToLocalDate(from).getTime()) / 86_400_000);
}

export function dateIsOccupied(date: string, ranges: ExclusiveDateRange[]): boolean {
  return ranges.some((range) => date >= range.from && date < range.to);
}

export function stayOverlapsRange(from: string, to: string, ranges: ExclusiveDateRange[]): boolean {
  return ranges.some((range) => from < range.to && to > range.from);
}
