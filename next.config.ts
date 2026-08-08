import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // La plantilla de la declaración jurada se lee del disco en runtime. Sin esto el
  // trazador no la incluye en el bundle de la función y falla solo en producción.
  outputFileTracingIncludes: {
    "/api/declaraciones": ["./public/templates/**"],
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
