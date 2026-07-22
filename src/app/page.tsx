import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import FeaturedProperties from "@/components/FeaturedProperties";
import MapSection from "@/components/map/MapSection";
import ExperienceSection from "@/components/ExperienceSection";
import HowItWorks from "@/components/HowItWorks";
import OwnerSection from "@/components/OwnerSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <a
        href="#propiedades"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-turquoise focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-deep"
      >
        Saltar al contenido
      </a>
      <Navbar />
      <main>
        <Hero />
        <div className="bg-cream text-night">
          <FeaturedProperties />
          <MapSection />
          <ExperienceSection />
          <HowItWorks />
          <OwnerSection />
        </div>
      </main>
      <Footer />
    </>
  );
}
