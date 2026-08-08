import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BedDouble, Users } from "lucide-react";
import type { Property } from "@/lib/properties";

export default function PropertyCard({
  property,
  priority = false,
  basePath = "/propiedades",
}: {
  property: Property;
  priority?: boolean;
  basePath?: string;
}) {
  return (
    <Link
      href={`${basePath}/${property.id}`}
      className="surface group flex flex-col overflow-hidden rounded-[22px] transition-shadow hover:shadow-[0_24px_60px_-28px_rgba(16,24,32,0.5)]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <Image
          src={property.image}
          alt={property.alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        {property.zone ? (
          <span className="absolute right-3 top-3 rounded-full bg-deep/70 px-3 py-1 text-xs text-cream/90 backdrop-blur-sm">
            {property.zone}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold tracking-tight text-night">{property.name}</h3>
          <ArrowUpRight
            size={18}
            className="mt-1 shrink-0 text-night/40 transition-colors group-hover:text-turquoise"
            aria-hidden="true"
          />
        </div>

        <div className="flex items-center gap-4 text-sm text-night/60">
          {property.guests ? (
            <span className="inline-flex items-center gap-1.5">
              <Users size={15} aria-hidden="true" />
              {property.guests} huéspedes
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <BedDouble size={15} aria-hidden="true" />
            {property.bedrooms} hab.
          </span>
        </div>

        {property.priceFrom ? (
          <div className="mt-auto border-t border-night/10 pt-3">
            <p className="text-xs text-night/55">Desde</p>
            <p className="text-base font-semibold text-night">
              {property.currency} {property.priceFrom.toLocaleString("es-BO")}
              <span className="text-sm font-normal text-night/55"> / noche</span>
            </p>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
