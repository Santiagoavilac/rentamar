import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // La plantilla de la declaración jurada se lee del disco en runtime. Sin esto el
  // trazador no la incluye en el bundle de la función y falla solo en producción.
  outputFileTracingIncludes: {
    "/api/declaraciones": ["./public/templates/**"],
  },
  // Las subidas mandan una foto por request y ya achicada en el navegador, pero el límite por
  // defecto de Server Actions (1 MB) igual la rechazaba. 4 MB queda debajo del tope de 4,5 MB
  // que impone Vercel a cualquier request.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cxozsfrwyvncdfulkcbi.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
