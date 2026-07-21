import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal";

export default function OwnerSection() {
  return (
    <section id="propietarios" className="px-5 py-10 sm:px-8">
      <Reveal>
        <div className="surface relative mx-auto max-w-[1400px] overflow-hidden rounded-[30px] px-6 py-14 sm:px-12 sm:py-20">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(90%_120%_at_100%_0%,rgba(42,168,184,0.12),transparent_55%)]"
          />
          <div className="relative z-10 max-w-2xl">
            <span className="eyebrow text-turquoise">Propietarios</span>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-night sm:text-4xl">
              Tu propiedad también puede formar parte de RentaMar
            </h2>
            <p className="mt-4 text-pretty text-night/65">
              Presentá tu propiedad de forma profesional, centralizá consultas y preparala para
              recibir reservas dentro del ecosistema de Mar Adentro.
            </p>
            <a
              href="#propietarios"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-turquoise px-6 py-3.5 text-sm font-semibold text-deep transition-transform hover:-translate-y-0.5 hover:bg-turquoise-soft"
            >
              Publicar mi propiedad
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
