import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const siteUrl = "https://rentamar.example";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "RentaMar | Alojamientos en Mar Adentro",
  description:
    "Descubrí departamentos y casas para disfrutar Mar Adentro. Encontrá tu próxima estadía junto al agua con RentaMar.",
  applicationName: "RentaMar",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "es_BO",
    siteName: "RentaMar",
    title: "RentaMar | Alojamientos en Mar Adentro",
    description:
      "Descubrí departamentos y casas para disfrutar Mar Adentro. Encontrá tu próxima estadía junto al agua con RentaMar.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "RentaMar | Alojamientos en Mar Adentro",
    description: "Descubrí departamentos y casas para disfrutar Mar Adentro con RentaMar.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b141a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
