import { Instagram } from "lucide-react";
import Wordmark from "./Wordmark";

// Solo destinos que existen. Contacto, Términos y Privacidad se quitaron: no hay páginas
// para esos enlaces todavía y apuntaban al inicio.
const columns: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Explorar",
    links: [
      { label: "Alojamientos", href: "/#propiedades" },
      { label: "Experiencias", href: "/#experiencias" },
      { label: "Mar Adentro", href: "https://maradentroweb.vercel.app/", external: true },
      { label: "Copropietarios", href: "/copropietarios" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-cream px-5 py-14 text-night sm:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Wordmark tone="dark" />
          <p className="mt-4 text-sm text-night/60">
            Alojamientos y estadías dentro de Mar Adentro, Santa Cruz, Bolivia.
          </p>
          <a
            href="#inicio"
            aria-label="RentaMar en Instagram"
            className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-night/10 text-night/70 transition-colors hover:bg-night/5 hover:text-night"
          >
            <Instagram size={18} aria-hidden="true" />
          </a>
        </div>

        <div className="flex flex-wrap gap-10 sm:gap-16">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="eyebrow text-night/45">{col.title}</h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : null)}
                      className="text-sm text-night/70 transition-colors hover:text-night"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-[1400px] flex-wrap items-center justify-between gap-3 border-t border-night/10 pt-6">
        <p className="text-xs text-night/45">
          © {new Date().getFullYear()} RentaMar. Todos los derechos reservados.
        </p>
        <a
          href="/limpieza/login"
          className="text-xs text-night/45 transition-colors hover:text-night"
        >
          Personal de limpieza
        </a>
      </div>
    </footer>
  );
}
