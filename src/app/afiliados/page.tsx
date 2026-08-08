import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { listAffiliateProperties } from "@/lib/affiliates";

export const metadata: Metadata = {
  title: "Afiliados | RentaMar",
  description: "Tarifas preferenciales para afiliados de RentaMar en Mar Adentro.",
};

export default async function AffiliatesPage() {
  const properties = await listAffiliateProperties();

  return (
    <div id="inicio" className="min-h-screen bg-cream text-night">
      <div className="bg-deep">
        <Navbar />
        <div className="h-20" />
      </div>
      <main className="mx-auto max-w-[1400px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <p className="eyebrow text-cyan-700">Afiliados</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          Tarifa preferencial para afiliados
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-night/70">
          Elegí una propiedad y tus fechas, cargá tus datos y los de tus acompañantes, y cerramos
          la reserva por WhatsApp. Las fechas quedan bloqueadas apenas enviás la solicitud.
        </p>

        {properties.length ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {properties.map((property, index) => (
              <PropertyCard
                key={property.id}
                property={property}
                basePath="/afiliados"
                priority={index < 4}
              />
            ))}
          </div>
        ) : (
          <p className="mt-10 rounded-3xl bg-white p-8 leading-7 text-night/65">
            Todavía no hay propiedades publicadas. Volvé a intentar más tarde.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
