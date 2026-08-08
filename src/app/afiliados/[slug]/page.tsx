import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BedDouble, Check, DoorOpen, MapPin, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PropertyGallery } from "@/components/property-gallery";
import { AffiliateBookingPanel } from "@/components/affiliate-booking-panel";
import { getAffiliatePropertyBySlug, buildWhatsappUrl, WHATSAPP_NUMBER } from "@/lib/affiliates";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const property = await getAffiliatePropertyBySlug(slug);
  if (!property) return { title: "Propiedad no encontrada | RentaMar" };
  return {
    title: `${property.name} · Afiliados | RentaMar`,
    description: property.shortDescription ?? `Tarifa de afiliado para ${property.name}.`,
  };
}

export default async function AffiliatePropertyPage({ params }: Props) {
  const { slug } = await params;
  const property = await getAffiliatePropertyBySlug(slug);
  if (!property) notFound();

  const enquiryUrl = buildWhatsappUrl(
    `Hola, soy afiliado y quiero consultar el precio de reserva de ${property.name}.`,
    WHATSAPP_NUMBER,
  );

  const facts = [
    { Icon: Users, label: `${property.maxGuests} huéspedes` },
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
          <Link href="/afiliados" className="text-sm font-semibold text-cyan-700">
            ← Volver a afiliados
          </Link>
          <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-cyan-700">Tarifa de afiliado</p>
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
              <span className="rounded-full border border-night/10 bg-white px-3 py-1.5">
                {property.maxGuests} huéspedes
              </span>
              <span className="rounded-full border border-night/10 bg-white px-3 py-1.5">
                {property.minimumNights} noches mínimo
              </span>
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
          </div>

          {property.affiliateNightlyPriceMinor === null ? (
            <aside className="rounded-3xl bg-white p-6 text-night shadow-[0_24px_70px_-32px_rgba(0,0,0,.55)] lg:sticky lg:top-24">
              <p className="text-sm text-night/55">Precio de la reserva</p>
              <p className="mt-1 text-2xl font-bold">A confirmar</p>
              <p className="mt-4 leading-7 text-night/70">
                Todavía no cargamos el precio de afiliado para esta propiedad. Escribinos y te lo
                pasamos por WhatsApp.
              </p>
              <a
                href={enquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-turquoise px-5 py-3.5 font-bold text-deep"
              >
                Consultar por WhatsApp
              </a>
            </aside>
          ) : (
            <AffiliateBookingPanel
              propertyId={property.id}
              propertyName={property.name}
              maxGuests={property.maxGuests}
              minimumNights={property.minimumNights}
              nightlyPriceMinor={property.affiliateNightlyPriceMinor}
              currency={property.currency}
              checkInTime={property.checkInTime}
              checkOutTime={property.checkOutTime}
              bookedRanges={property.bookedRanges}
            />
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
