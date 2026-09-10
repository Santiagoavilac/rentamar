import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { getPropertyBySlug } from "@/lib/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  return {
    title: property ? `Reservar ${property.name} | RentaMar` : "Reservar | RentaMar",
    // Es un formulario, no contenido: no tiene sentido que lo indexen.
    robots: { index: false, follow: true },
  };
}

// Pantalla dedicada a reservar. La ficha del departamento solo informa y manda acá.
export default async function BookingWizardPage({ params }: Props) {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property) notFound();
  // Sin precio cargado no hay nada que reservar; la ficha tampoco muestra el botón.
  if (property.basePriceMinor <= 0) notFound();

  return (
    <div className="min-h-screen bg-cream text-night">
      <div className="bg-deep">
        <Navbar />
        <div className="h-20" />
      </div>
      <main className="px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        <BookingWizard
          propertyId={property.id}
          propertySlug={property.slug}
          propertyName={property.name}
          maxGuests={property.maxGuests}
          minimumNights={property.minimumNights}
          basePriceMinor={property.basePriceMinor}
          currency={property.currency}
          checkInTime={property.checkInTime}
          checkOutTime={property.checkOutTime}
          bookedRanges={property.bookedRanges}
        />
      </main>
      <Footer />
    </div>
  );
}
