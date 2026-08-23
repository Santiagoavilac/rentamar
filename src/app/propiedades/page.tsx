import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import PropertySearch from "@/components/PropertySearch";
import { getPublishedProperties } from "@/lib/queries";
import { propertiesQuerySchema } from "@/lib/validation";
import type { z } from "zod";
import type { Property } from "@/lib/properties";

export const metadata: Metadata = {
  title: "Propiedades | RentaMar",
  description: "Buscá propiedades en Mar Adentro por fechas, huéspedes y tipo.",
};

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = propertiesQuerySchema.safeParse(params);
  const filters: Partial<z.infer<typeof propertiesQuerySchema>> = parsed.success
    ? parsed.data
    : {};

  // Un rango invertido se ignora en vez de romper la página; el buscador ya avisa.
  const rangeOk = Boolean(
    filters.checkIn && filters.checkOut && filters.checkIn < filters.checkOut,
  );

  const properties = await getPublishedProperties({
    guests: filters.guests,
    propertyType: filters.type,
    checkIn: rangeOk ? filters.checkIn : undefined,
    checkOut: rangeOk ? filters.checkOut : undefined,
  });

  return (
    <div id="inicio" className="min-h-screen bg-cream text-night">
      <div className="bg-deep">
        <Navbar />
        <div className="h-20" />
        <div className="mx-auto max-w-[1400px] px-5 pb-10 sm:px-8">
          <PropertySearch
            defaults={{
              checkIn: rangeOk ? filters.checkIn : undefined,
              checkOut: rangeOk ? filters.checkOut : undefined,
              guests: filters.guests,
              type: filters.type,
            }}
          />
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <p className="eyebrow text-cyan-700">Resultados</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          {properties.length === 1
            ? "1 propiedad disponible"
            : `${properties.length} propiedades disponibles`}
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-night/70">{describe(filters, rangeOk)}</p>

        {properties.length ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {properties.map((property: Property, index: number) => (
              <PropertyCard key={property.id} property={property} priority={index < 4} />
            ))}
          </div>
        ) : (
          <p className="mt-10 rounded-3xl bg-white p-8 leading-7 text-night/65">
            No encontramos propiedades con esos filtros. Probá con otras fechas o menos huéspedes.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}

function describe(
  filters: { guests?: number; type?: string; checkIn?: string; checkOut?: string },
  rangeOk: boolean,
): string {
  const parts: string[] = [];
  if (rangeOk) parts.push(`del ${format(filters.checkIn!)} al ${format(filters.checkOut!)}`);
  if (filters.guests) {
    parts.push(`para ${filters.guests} ${filters.guests === 1 ? "huésped" : "huéspedes"}`);
  }
  if (filters.type) parts.push(`tipo ${filters.type.toLowerCase()}`);
  return parts.length ? `Búsqueda ${parts.join(", ")}.` : "Todas las propiedades publicadas.";
}

function format(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
