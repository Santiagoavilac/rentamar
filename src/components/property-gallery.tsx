"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type GalleryImage = { url: string; altText: string | null };

export function PropertyGallery({
  images,
  propertyName,
}: {
  images: GalleryImage[];
  propertyName: string;
}) {
  const safeImages = images.length
    ? images
    : [{ url: "/rentamar-logo.jpg", altText: propertyName }];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const touchStart = useRef<number | null>(null);
  const didSwipe = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowRight") setActive((value) => (value + 1) % safeImages.length);
      if (event.key === "ArrowLeft")
        setActive((value) => (value - 1 + safeImages.length) % safeImages.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, safeImages.length]);

  const current = safeImages[active];
  const move = (direction: number) =>
    setActive((value) => (value + direction + safeImages.length) % safeImages.length);

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[1fr_160px]">
        <button
          type="button"
          onClick={() => {
            if (didSwipe.current) {
              didSwipe.current = false;
              return;
            }
            setOpen(true);
          }}
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchStart.current === null || safeImages.length < 2) return;
            const delta = event.changedTouches[0].clientX - touchStart.current;
            if (Math.abs(delta) > 45) {
              didSwipe.current = true;
              move(delta < 0 ? 1 : -1);
            }
            touchStart.current = null;
          }}
          className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-night/10"
        >
          <Image
            src={current.url}
            alt={current.altText || propertyName}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 75vw"
            className="object-cover"
          />
          <span className="absolute bottom-4 right-4 rounded-full bg-deep/75 px-3 py-1.5 text-xs text-cream backdrop-blur">
            Ver galería · {active + 1}/{safeImages.length}
          </span>
        </button>
        {safeImages.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto lg:max-h-[520px] lg:flex-col lg:overflow-y-auto">
            {safeImages.map((image, index) => (
              <button
                key={`${image.url}-${index}`}
                type="button"
                onClick={() => setActive(index)}
                className={`relative aspect-[4/3] min-w-28 overflow-hidden rounded-xl ring-2 ${index === active ? "ring-turquoise" : "ring-transparent"}`}
              >
                <Image
                  src={image.url}
                  alt={image.altText || `${propertyName}, imagen ${index + 1}`}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galería de ${propertyName}`}
          className="fixed inset-0 z-[70] grid place-items-center bg-black/90 p-4"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar galería"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-3 text-white"
          >
            <X />
          </button>
          {safeImages.length > 1 ? (
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Imagen anterior"
              className="absolute left-3 rounded-full bg-white/10 p-3 text-white sm:left-8"
            >
              <ChevronLeft />
            </button>
          ) : null}
          <div className="relative h-[82vh] w-[86vw]">
            <Image
              src={current.url}
              alt={current.altText || propertyName}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>
          {safeImages.length > 1 ? (
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Imagen siguiente"
              className="absolute right-3 rounded-full bg-white/10 p-3 text-white sm:right-8"
            >
              <ChevronRight />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
