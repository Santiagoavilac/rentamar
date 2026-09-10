"use client";

import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  dateIsOccupied,
  localIsoDate,
  nightsBetween,
  parsePostgresDateRange,
  stayOverlapsRange,
} from "@/lib/date-ranges";

// Selección de fechas contra la disponibilidad real. Estaba duplicada línea por línea entre
// el panel de huéspedes y el de afiliados; ahora la comparten, y el wizard también.

export type StayRange = {
  range: DateRange | undefined;
  setRange: (next: DateRange | undefined) => void;
  checkIn: string;
  checkOut: string;
  nights: number;
  /** Cuántos meses mostrar: uno en celular, dos en pantalla grande. */
  months: number;
  /** Un día que no se puede elegir como extremo del rango. */
  disabledDay: (date: Date) => boolean;
  /** Error de la última selección, o null. */
  rangeError: string | null;
  clearRangeError: () => void;
  /** Hay un rango completo y válido para cotizar. */
  isComplete: boolean;
};

export function useStayRange(bookedRanges: string[], minimumNights: number): StayRange {
  const occupied = useMemo(
    () =>
      bookedRanges
        .map(parsePostgresDateRange)
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    [bookedRanges],
  );

  const [range, setRangeState] = useState<DateRange>();
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [months, setMonths] = useState(2);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setMonths(media.matches ? 1 : 2);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const checkIn = range?.from ? localIsoDate(range.from) : "";
  const checkOut = range?.to ? localIsoDate(range.to) : "";
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  function disabledDay(date: Date) {
    const iso = localIsoDate(date);
    const today = localIsoDate(new Date());
    if (iso < today) return true;
    // Eligiendo la salida: cualquier día que obligue a saltar por encima de una noche ya
    // ocupada queda fuera, aunque el día en sí esté libre.
    if (range?.from && !range.to && iso > localIsoDate(range.from)) {
      return stayOverlapsRange(localIsoDate(range.from), iso, occupied);
    }
    // El día de salida no se cobra como noche, así que puede coincidir con una entrada ajena.
    if (range?.to && iso === localIsoDate(range.to)) return false;
    return dateIsOccupied(iso, occupied);
  }

  function setRange(next: DateRange | undefined) {
    setRangeError(null);
    if (next?.from && next.to) {
      const from = localIsoDate(next.from);
      const to = localIsoDate(next.to);
      if (stayOverlapsRange(from, to, occupied)) {
        setRangeError("El rango incluye noches que ya no están disponibles.");
        return;
      }
      if (nightsBetween(from, to) < minimumNights) {
        // Se acepta igual para que el usuario vea qué eligió, pero con el aviso al lado.
        setRangeState(next);
        setRangeError(`Esta propiedad requiere un mínimo de ${minimumNights} noches.`);
        return;
      }
    }
    setRangeState(next);
  }

  return {
    range,
    setRange,
    checkIn,
    checkOut,
    nights,
    months,
    disabledDay,
    rangeError,
    clearRangeError: () => setRangeError(null),
    isComplete: Boolean(checkIn && checkOut && nights >= minimumNights),
  };
}
