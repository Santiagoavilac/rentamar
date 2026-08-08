import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

// Lecturas del módulo de limpieza. Usan el cliente de sesión: la RLS de cleaning_reports
// deja que is_staff() vea todo.

const internal = () => new AppError("INTERNAL_ERROR", "Error interno", 500);

export type CleaningReportRow = {
  id: string;
  fullName: string;
  username: string;
  propertyName: string;
  entryTime: string;
  exitTime: string;
};

export async function listCleaningReports(date: string): Promise<CleaningReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cleaning_reports")
    .select("id, full_name, username, property_name, entry_time, exit_time")
    .eq("work_date", date)
    .order("entry_time", { ascending: true });
  if (error) throw internal();

  return (data ?? []).map((report) => ({
    id: report.id,
    fullName: report.full_name,
    username: report.username,
    propertyName: report.property_name,
    entryTime: report.entry_time.slice(0, 5),
    exitTime: report.exit_time.slice(0, 5),
  }));
}

export type TurnoverRow = { bookingCode: string; propertyName: string; time: string };

// Qué departamentos se desocupan y cuáles se ocupan ese día, para saber qué hay que limpiar.
// Es una consulta por igualdad de fecha: no necesita el planner de rangos.
export async function listDayTurnover(
  date: string,
): Promise<{ checkOuts: TurnoverRow[]; checkIns: TurnoverRow[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("booking_code, check_in, check_out, properties(name, check_in_time, check_out_time)")
    .in("status", ["confirmed", "completed"])
    .or(`check_in.eq.${date},check_out.eq.${date}`);
  if (error) throw internal();

  const checkOuts: TurnoverRow[] = [];
  const checkIns: TurnoverRow[] = [];
  for (const booking of data ?? []) {
    const property = booking.properties;
    const propertyName = property?.name ?? "—";
    if (booking.check_out === date) {
      checkOuts.push({
        bookingCode: booking.booking_code,
        propertyName,
        time: (property?.check_out_time ?? "").slice(0, 5),
      });
    }
    if (booking.check_in === date) {
      checkIns.push({
        bookingCode: booking.booking_code,
        propertyName,
        time: (property?.check_in_time ?? "").slice(0, 5),
      });
    }
  }
  const byName = (a: TurnoverRow, b: TurnoverRow) => a.propertyName.localeCompare(b.propertyName);
  return { checkOuts: checkOuts.sort(byName), checkIns: checkIns.sort(byName) };
}
