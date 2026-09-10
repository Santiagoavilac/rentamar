"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import type { StayRange } from "./use-stay-range";

// El calendario de disponibilidad. Mismo comportamiento en el panel de huéspedes, el de
// afiliados y el wizard: lo que cambia entre ellos es lo que rodea, no esto.
export function BookingCalendar({
  stay,
  minimumNights,
}: {
  stay: StayRange;
  minimumNights: number;
}) {
  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-night/10 p-2">
        <DayPicker
          mode="range"
          numberOfMonths={stay.months}
          selected={stay.range}
          onSelect={stay.setRange}
          disabled={stay.disabledDay}
          excludeDisabled
          defaultMonth={new Date()}
          className="mx-auto"
        />
      </div>
      <p className="mt-2 text-xs text-night/55">
        Mínimo {minimumNights} {minimumNights === 1 ? "noche" : "noches"}. La fecha de salida no se
        cobra como noche.
      </p>
    </>
  );
}

// Resumen de las fechas elegidas, con la hora de entrada y salida de la propiedad.
export function StayDatesSummary({
  checkIn,
  checkOut,
  checkInTime,
  checkOutTime,
}: {
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-night/10 p-3 text-sm">
      <div>
        <span className="block text-xs text-night/50">Ingreso</span>
        <strong>{checkIn || "Seleccionar"}</strong>
        <span className="block text-xs text-night/55">{checkInTime}</span>
      </div>
      <div>
        <span className="block text-xs text-night/50">Salida</span>
        <strong>{checkOut || "Seleccionar"}</strong>
        <span className="block text-xs text-night/55">{checkOutTime}</span>
      </div>
    </div>
  );
}
