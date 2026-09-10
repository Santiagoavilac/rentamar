import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import { calculateDiscountPercent } from "@/lib/money";

// Lo único que la ficha del departamento muestra ahora sobre reservar: el precio y un botón.
// El calendario y los formularios se mudaron al paso a paso — antes estaban acá y la gente
// se topaba de golpe con todo sin saber cómo terminar.

function formatDiscountPercent(value: number) {
  return value.toLocaleString("es-BO", { maximumFractionDigits: 2 });
}

export function PropertyReserveCta({
  slug,
  basePriceMinor,
  currency,
  minimumNights,
  checkInTime,
  checkOutTime,
  stayPrices,
}: {
  slug: string;
  basePriceMinor: number;
  currency: string;
  minimumNights: number;
  checkInTime: string;
  checkOutTime: string;
  stayPrices: { nights: number; totalPriceMinor: number }[];
}) {
  const options = stayPrices.map((price) => ({
    ...price,
    discountPercent: calculateDiscountPercent(basePriceMinor * price.nights, price.totalPriceMinor),
  }));

  return (
    <aside
      id="reservar"
      className="rounded-3xl bg-white p-5 text-night shadow-[0_24px_70px_-32px_rgba(0,0,0,.55)] sm:p-6 lg:sticky lg:top-24"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-night/55">Desde</p>
          <p className="text-2xl font-bold">
            {formatCurrency(basePriceMinor, currency)}{" "}
            <span className="text-sm font-normal text-night/55">/ noche</span>
          </p>
        </div>
        <CalendarDays className="text-turquoise" />
      </div>

      {options.length ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {options.map((price) => (
            <span
              key={price.nights}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                price.discountPercent > 0
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-cyan-50 text-cyan-800"
              }`}
            >
              {price.nights} noches · {formatCurrency(price.totalPriceMinor, currency)}
              {price.discountPercent > 0 ? (
                <strong className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">
                  -{formatDiscountPercent(price.discountPercent)}%
                </strong>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <Link
        href={`/propiedades/${slug}/reservar`}
        className="mt-5 flex items-center justify-center rounded-2xl bg-turquoise px-5 py-4 text-lg font-bold text-deep transition hover:bg-turquoise-soft"
      >
        Reservar
      </Link>

      <ul className="mt-4 grid gap-1.5 text-xs text-night/60">
        <li>Te guiamos paso a paso: fechas, tus datos y confirmación.</li>
        <li>
          Entrada desde las {checkInTime}, salida hasta las {checkOutTime}.
        </li>
        <li>
          Mínimo {minimumNights} {minimumNights === 1 ? "noche" : "noches"}.
        </li>
      </ul>
    </aside>
  );
}
