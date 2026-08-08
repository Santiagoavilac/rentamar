import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BedDouble, Check, DoorOpen, MapPin, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PropertyGallery } from "@/components/property-gallery";
import { PropertyBookingPanel } from "@/components/property-booking-panel";
import { getPropertyBySlug } from "@/lib/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property) return { title: "Propiedad no encontrada | RentaMar" };
  const cover = property.images.find((image) => image.isCover) ?? property.images[0];
  return {
    title: `${property.name} | RentaMar`,
    description:
      property.shortDescription ??
      property.description ??
      `Reservá ${property.name} en Mar Adentro.`,
    openGraph: cover
      ? { images: [{ url: cover.url, alt: cover.altText ?? property.name }] }
      : undefined,
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property) notFound();
  const bookingConfigured = property.basePriceMinor > 0;
  const facts = [
    ...(bookingConfigured ? [{ Icon: Users, label: `${property.maxGuests} huéspedes` }] : []),
    {
      Icon: DoorOpen,
      label: `${property.bedrooms} ${property.bedrooms === 1 ? "habitación" : "habitaciones"}`,
    },
    ...(property.beds > 0 ? [{ Icon: BedDouble, label: `${property.beds} camas` }] : []),
    ...(property.bathrooms > 0
      ? [
          {
            Icon: Bath,
            label: `${property.bathrooms} ${property.bathrooms === 1 ? "baño" : "baños"}`,
          },
        ]
      : []),
  ];

  return (
    <div id="inicio" className="min-h-screen bg-cream text-night">
      <div className="bg-deep">
        <Navbar />
        <div className="h-20" />
      </div>
      <main>
        <section className="mx-auto max-w-[1400px] px-5 pb-8 pt-8 sm:px-8 sm:pt-12">
          <Link href="/#propiedades" className="text-sm font-semibold text-cyan-700">
            ← Volver a propiedades
          </Link>
          <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-cyan-700">{property.propertyType || "Alojamiento"}</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                {property.name}
              </h1>
              {property.zone || property.locationReference ? (
                <p className="mt-3 flex items-center gap-2 text-night/60">
                  <MapPin size={17} /> {property.zone || property.locationReference}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-night/65">
              <span className="rounded-full border border-night/10 bg-white px-3 py-1.5">
                {property.bedrooms} {property.bedrooms === 1 ? "habitación" : "habitaciones"}
              </span>
              {bookingConfigured ? (
                <>
                  <span className="rounded-full border border-night/10 bg-white px-3 py-1.5">
                    {property.maxGuests} huéspedes
                  </span>
                  <span className="rounded-full border border-night/10 bg-white px-3 py-1.5">
                    {property.minimumNights} noches mínimo
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div className="mt-7">
            <PropertyGallery images={property.images} propertyName={property.name} />
          </div>
        </section>

        <section className="mx-auto grid max-w-[1400px] gap-10 px-5 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
          <div className="grid gap-9">
            {property.description || property.shortDescription ? (
              <div>
                <h2 className="text-2xl font-bold">Acerca de esta propiedad</h2>
                <p className="mt-4 whitespace-pre-line leading-7 text-night/70">
                  {property.description || property.shortDescription}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map(({ Icon, label }) => (
                <div key={label} className="rounded-2xl border border-night/10 bg-white p-4">
                  <Icon className="text-turquoise" size={22} />
                  <p className="mt-3 text-sm font-semibold">{label}</p>
                </div>
              ))}
            </div>

            {property.amenities.length ? (
              <div>
                <h2 className="text-2xl font-bold">Servicios y comodidades</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {property.amenities.map((amenity) => (
                    <li
                      key={amenity.slug}
                      className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-cyan-50 text-cyan-700">
                        <Check size={17} />
                      </span>
                      {amenity.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {property.rules ? (
              <div>
                <h2 className="text-2xl font-bold">Reglas y condiciones</h2>
                <p className="mt-4 whitespace-pre-line leading-7 text-night/70">{property.rules}</p>
              </div>
            ) : null}

            {property.locationReference || property.zone ? (
              <div className="rounded-3xl bg-deep p-6 text-cream sm:p-8">
                <h2 className="text-2xl font-bold">Ubicación en Mar Adentro</h2>
                <p className="mt-3 whitespace-pre-line text-cream/70">
                  {property.locationReference || property.zone}
                </p>
                <Link
                  href="/mapa"
                  className="mt-5 inline-flex rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-deep"
                >
                  Ver mapa de Mar Adentro
                </Link>
              </div>
            ) : null}
          </div>

          {bookingConfigured ? (
            <PropertyBookingPanel
              propertyId={property.id}
              propertyName={property.name}
              maxGuests={property.maxGuests}
              minimumNights={property.minimumNights}
              basePriceMinor={property.basePriceMinor}
              currency={property.currency}
              checkInTime={property.checkInTime}
              checkOutTime={property.checkOutTime}
              bookedRanges={property.bookedRanges}
              stayPrices={property.durationPricingEnabled ? property.stayPrices : []}
            />
          ) : (
            <aside className="rounded-3xl bg-white p-6 text-night shadow-[0_24px_70px_-32px_rgba(0,0,0,.35)]">
              <p className="eyebrow text-cyan-700">Información en preparación</p>
              <h2 className="mt-2 text-2xl font-bold">Reservas próximamente</h2>
              <p className="mt-3 leading-6 text-night/65">
                Administración está completando la capacidad, las condiciones y las tarifas de esta
                propiedad.
              </p>
            </aside>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
