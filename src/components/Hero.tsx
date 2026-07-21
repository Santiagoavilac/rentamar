import { ArrowRight, ChevronDown } from "lucide-react";
import ResponsiveHeroVideo from "./ResponsiveHeroVideo";
import SearchBar from "./SearchBar";
import Reveal from "./Reveal";

export default function Hero() {
  return (
    <section id="inicio" className="relative">
      {/* Full-screen video, pinned while the first screen scrolls */}
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <ResponsiveHeroVideo />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-deep/85 via-deep/25 to-deep/40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_100%,rgba(11,20,26,0.65),transparent_60%)]"
        />

        {/* Scroll hint on the first, video-only screen */}
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
          <span className="glass-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-cream/80">
            Desplazá para descubrir
            <ChevronDown size={16} className="animate-bounce" aria-hidden="true" />
          </span>
        </div>
      </div>

      {/* Content track laid over the pinned video */}
      <div className="relative z-10 -mt-[100svh]">
        {/* First screen: only the video is visible */}
        <div aria-hidden="true" className="h-[100svh]" />

        {/* Second screen: hero content reveals as you scroll */}
        <div className="flex min-h-[100svh] items-end px-3 pb-8 sm:px-5 lg:px-8">
          <Reveal className="w-full">
            <div className="glass mx-auto max-w-[1400px] rounded-[var(--radius-glass)] p-5 sm:p-8 lg:max-w-3xl lg:p-12">
              <div className="flex flex-col gap-4">
                <span className="eyebrow text-turquoise-soft">Estadías en Mar Adentro</span>
                <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-cream sm:text-5xl lg:text-6xl">
                  Tu próxima estadía comienza frente al agua
                </h1>
                <p className="max-w-xl text-pretty text-base text-cream/80 sm:text-lg">
                  Descubrí departamentos y casas cuidadosamente seleccionadas para descansar,
                  compartir y vivir Mar Adentro a tu manera.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href="#propiedades"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3.5 text-sm font-semibold text-deep transition-transform hover:-translate-y-0.5 hover:bg-turquoise-soft"
                >
                  Explorar propiedades
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a
                  href="#experiencia"
                  className="glass-pill inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold text-cream transition-colors hover:bg-white/10"
                >
                  Conocer Mar Adentro
                </a>
              </div>

              <div className="mt-6">
                <SearchBar />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
