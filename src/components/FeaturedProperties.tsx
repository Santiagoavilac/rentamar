import { properties as mockProperties, type Property } from "@/lib/properties";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPublishedProperties } from "@/lib/queries";
import PropertyCard from "./PropertyCard";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";

async function loadProperties(): Promise<Property[]> {
  // Fallback al mock si Supabase no está configurado (desarrollo local).
  if (!isSupabaseConfigured) return mockProperties;

  try {
    const data = await getPublishedProperties({ featured: true });
    return data.length > 0 ? data : mockProperties;
  } catch (error) {
    // En producción no ocultamos el problema; en desarrollo seguimos con el mock.
    if (process.env.NODE_ENV === "production") throw error;
    console.error("[FeaturedProperties] fallback a mock:", error);
    return mockProperties;
  }
}

export default async function FeaturedProperties() {
  const properties = await loadProperties();

  return (
    <section id="propiedades" className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <SectionHeading
          eyebrow="Propiedades destacadas"
          title="Elegí dónde despertar"
          text="Espacios para escapadas tranquilas, vacaciones en familia y estadías junto al agua."
        />
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {properties.map((property, index) => (
          <Reveal key={property.id} delay={index * 80}>
            <PropertyCard property={property} priority={index === 0} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
