"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { signOutAction } from "@/app/admin/login/actions";

export type AdminNavItem = {
  href: string;
  label: string;
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

type AdminShellProps = {
  children: React.ReactNode;
  groups: AdminNavGroup[];
  accountLabel: string;
  role: string;
};

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

function Navigation({
  groups,
  pathname,
  onNavigate,
  mobile = false,
}: {
  groups: AdminNavGroup[];
  pathname: string;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  return (
    <nav aria-label={mobile ? "Navegación móvil del panel" : "Navegación del panel"}>
      <div className="grid gap-6">
        {groups.map((group) => (
          <div key={group.title} className="grid gap-1">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-cream/45">
              {group.title}
            </p>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white/15 text-cream"
                      : "text-cream/80 hover:bg-white/10 hover:text-cream"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

export function AdminShell({ children, groups, accountLabel, role }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const closeDrawer = () => {
    setOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <div className="admin-shell min-h-screen bg-[#f6f4ef] text-night">
      <aside className="fixed inset-y-0 hidden w-60 overflow-y-auto bg-deep p-5 text-cream lg:block">
        <Link href="/admin" className="text-xl font-bold">
          RentaMar <span className="text-turquoise">Admin</span>
        </Link>
        <div className="mt-8">
          <Navigation groups={groups} pathname={pathname} />
        </div>
      </aside>

      <header className="admin-mobile-header sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <Link href="/admin" className="truncate text-base font-bold" aria-label="RentaMar Admin">
            RentaMar <span className="text-turquoise">Admin</span>
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="admin-mobile-menu"
            aria-label="Abrir menú del panel"
            className="admin-touch-target inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-night"
          >
            <Menu size={21} aria-hidden />
          </button>
        </div>
      </header>

      <header className="hidden border-b border-slate-200 bg-white px-5 py-3 lg:ml-60 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-3 text-sm">
          <span className="max-w-md truncate">
            {accountLabel} <span className="text-slate-500">({role})</span>
          </span>
          <form action={signOutAction}>
            <button className="min-h-10 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold">
              Salir
            </button>
          </form>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55"
            aria-label="Cerrar menú"
            onClick={closeDrawer}
          />
          <aside
            ref={drawerRef}
            id="admin-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menú del panel"
            className="admin-mobile-drawer absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col overflow-y-auto bg-deep px-4 pb-5 text-cream shadow-2xl"
          >
            <div className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10">
              <Link href="/admin" onClick={() => setOpen(false)} className="text-lg font-bold">
                RentaMar <span className="text-turquoise">Admin</span>
              </Link>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDrawer}
                aria-label="Cerrar menú del panel"
                className="admin-touch-target inline-flex items-center justify-center rounded-xl border border-white/20 text-cream"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="flex-1 py-6">
              <Navigation
                groups={groups}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                mobile
              />
            </div>
            <div className="border-t border-white/10 pt-4">
              <p className="truncate text-sm font-semibold">{accountLabel}</p>
              <p className="mt-0.5 text-xs uppercase tracking-wide text-cream/55">{role}</p>
              <form action={signOutAction} className="mt-4">
                <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-semibold">
                  <LogOut size={17} aria-hidden /> Salir
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:ml-60 lg:p-8">
        {children}
      </main>
    </div>
  );
}
