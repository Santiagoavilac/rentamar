// `external` marca los enlaces que salen del sitio: se renderizan con <a target="_blank">
// en vez de next/link, igual que el enlace de WhatsApp del panel de afiliados.
export const navLinks: { label: string; href: string; external?: boolean }[] = [
  { label: "Alojamientos", href: "/#propiedades" },
  { label: "Experiencias", href: "/#experiencias" },
  { label: "Mar Adentro", href: "https://maradentroweb.vercel.app/", external: true },
  { label: "Copropietarios", href: "/copropietarios" },
  { label: "Afiliados", href: "/afiliados" },
];
