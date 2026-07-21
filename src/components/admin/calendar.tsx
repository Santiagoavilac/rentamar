"use client";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import type { CalendarBlock, CalendarBooking } from "@/lib/admin/availability";

const toDate = (value: string) => new Date(`${value}T00:00:00`);
export function AdminCalendar({
  blocks,
  bookings,
}: {
  blocks: CalendarBlock[];
  bookings: CalendarBooking[];
}) {
  const ranges = (items: Array<{ from: string; to: string }>) =>
    items.map((x) => ({ from: toDate(x.from), to: toDate(x.to) }));
  return (
    <div className="overflow-auto">
      <DayPicker
        mode="multiple"
        numberOfMonths={2}
        modifiers={{ blocked: ranges(blocks), occupied: ranges(bookings) }}
        modifiersClassNames={{
          blocked: "bg-rose-200 text-rose-950",
          occupied: "bg-amber-200 text-amber-950",
        }}
      />
      <div className="mt-3 flex gap-4 text-xs">
        <span>
          <i className="mr-1 inline-block h-3 w-3 bg-rose-200" />
          Bloqueo interno
        </span>
        <span>
          <i className="mr-1 inline-block h-3 w-3 bg-amber-200" />
          Reserva u hold
        </span>
      </div>
    </div>
  );
}
