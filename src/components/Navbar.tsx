"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { navLinks } from "@/lib/nav";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "glass border-b border-white/10" : "border-b border-transparent"
      }`}
    >
      <nav
        aria-label="Principal"
        className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-4 sm:px-8"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full"
          aria-label="RentaMar, ir al inicio"
        >
          <Image
            src="/rentamar-logo.jpg"
            alt="RentaMar"
            width={44}
            height={44}
            priority
            className="h-11 w-11 rounded-full object-cover ring-1 ring-white/20"
          />
          <span className="sr-only">RentaMar</span>
        </Link>

        <ul className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="text-sm text-cream/75 transition-colors hover:text-cream"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/#propiedades"
            className="hidden rounded-full bg-turquoise px-5 py-2.5 text-sm font-semibold text-deep transition-transform hover:-translate-y-0.5 hover:bg-turquoise-soft sm:inline-flex"
          >
            Explorar
          </Link>
          <button
            type="button"
            className="glass-pill inline-flex h-11 w-11 items-center justify-center rounded-full text-cream lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="glass-strong mx-3 mb-3 rounded-3xl px-4 py-4 lg:hidden">
          <ul className="flex flex-col">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-base text-cream/85 transition-colors hover:bg-white/10 hover:text-cream"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-2">
              <Link
                href="/#propiedades"
                onClick={() => setOpen(false)}
                className="block rounded-2xl bg-turquoise px-4 py-3 text-center text-base font-semibold text-deep"
              >
                Explorar
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
