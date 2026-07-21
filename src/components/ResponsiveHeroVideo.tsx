"use client";

import { useEffect, useState } from "react";

type Orientation = "landscape" | "portrait";

const sources: Record<Orientation, { video: string; poster: string }> = {
  landscape: {
    video: "/media/rentamar-horizontal.webm",
    poster: "/media/rentamar-horizontal-poster.jpg",
  },
  portrait: {
    video: "/media/rentamar-vertical.webm",
    poster: "/media/rentamar-vertical-poster.jpg",
  },
};

export default function ResponsiveHeroVideo() {
  // Default to landscape for SSR; corrected on mount before paint.
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const portraitQuery = window.matchMedia("(orientation: portrait)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      setOrientation(portraitQuery.matches ? "portrait" : "landscape");
      setReducedMotion(motionQuery.matches);
    };

    update();
    setReady(true);
    portraitQuery.addEventListener("change", update);
    motionQuery.addEventListener("change", update);
    return () => {
      portraitQuery.removeEventListener("change", update);
      motionQuery.removeEventListener("change", update);
    };
  }, []);

  const active = sources[orientation];

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden bg-deep">
      {/* Poster shows immediately; avoids layout shift and covers reduced-motion */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={active.poster}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {ready && !reducedMotion && (
        <video
          key={active.video}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={active.poster}
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src={active.video} type="video/webm" />
        </video>
      )}
    </div>
  );
}
