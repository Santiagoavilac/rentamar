import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import { getPublishedMap } from "@/lib/maps/public";
import { MapViewer } from "@/components/map/MapViewer";

// Sección del mapa embebida en el landing (debajo de "Propiedades destacadas").
// Server component: lee el mapa publicado (RLS-aware, solo status='published') y
// renderiza el visor de solo lectura. Si no hay mapa/imagen, no renderiza nada para
// no romper el landing.

const MAP_SLUG = "mar-adentro";

export default async function MapSection() {
  const map = await getPublishedMap(MAP_SLUG);
  if (!map || !map.image_url) return null;

  return (
    <section id="mapa" className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <SectionHeading
          eyebrow="El complejo"
          title="Explorá Mar Adentro"
          text="Movete por el masterplan como en un mapa: hacé zoom, desplazá y tocá los puntos de interés para conocer casas, torres, amenidades y servicios."
        />
      </Reveal>

      <Reveal>
        <div className="mt-10">
          <MapViewer map={map} />
        </div>
      </Reveal>
    </section>
  );
}
