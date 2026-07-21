import Image from "next/image";
import { experiences } from "@/lib/experiences";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";

export default function ExperienceSection() {
  return (
    <section id="experiencias" className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <SectionHeading
          eyebrow="Experiencias"
          title="Viví Mar Adentro"
          text="Actividades a pasos del alojamiento, para llenar cada día de tu estadía."
        />
      </Reveal>

      <div className="mt-14 flex flex-col gap-16 sm:mt-20 sm:gap-24">
        {experiences.map((exp, index) => {
          const reversed = index % 2 === 1;
          return (
            <Reveal key={exp.id}>
              <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-12">
                <figure
                  className={`group relative aspect-[4/3] w-full overflow-hidden rounded-[26px] ${
                    reversed ? "md:order-2" : ""
                  }`}
                >
                  <Image
                    src={exp.image}
                    alt={exp.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    loading={index === 0 ? "eager" : "lazy"}
                    priority={index === 0}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </figure>
                <div className={reversed ? "md:order-1" : ""}>
                  <span className="eyebrow text-turquoise">{exp.label}</span>
                  <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-night sm:text-3xl">
                    {exp.phrase}
                  </h3>
                  <p className="mt-3 text-pretty text-night/65">{exp.description}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
