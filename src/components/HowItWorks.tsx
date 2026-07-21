import { CalendarRange, Home, CheckCircle2 } from "lucide-react";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";

const steps = [
  {
    icon: Home,
    title: "Elegí tu alojamiento",
    text: "Explorá departamentos y casas dentro de Mar Adentro.",
  },
  {
    icon: CalendarRange,
    title: "Seleccioná fechas y huéspedes",
    text: "Indicá cuándo llegás y con quién.",
  },
  {
    icon: CheckCircle2,
    title: "Confirmá tu estadía",
    text: "Enviá tu solicitud y preparate para disfrutar.",
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 sm:py-24">
      <Reveal>
        <SectionHeading eyebrow="Cómo funciona" title="Reservar es simple" align="center" />
      </Reveal>

      <ol className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {steps.map((step, index) => (
          <Reveal as="li" key={step.title} delay={index * 90}>
            <div className="surface flex h-full flex-col gap-3 rounded-3xl p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-turquoise/15 text-turquoise">
                  <step.icon size={20} aria-hidden="true" />
                </span>
                <span className="eyebrow text-night/45">Paso {index + 1}</span>
              </div>
              <h3 className="text-lg font-semibold text-night">{step.title}</h3>
              <p className="text-sm text-night/65">{step.text}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
