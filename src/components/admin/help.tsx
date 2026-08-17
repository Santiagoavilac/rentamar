"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X } from "lucide-react";
import { HELP, type HelpBlock, type HelpKey } from "@/lib/admin/help";

// Un único panel de ayuda montado en el layout del admin: los botones "?" solo
// piden abrirlo por contexto. Así no se repite el diálogo en cada título ni pueden
// quedar dos abiertos a la vez.
type HelpContextValue = { open: (key: HelpKey, trigger: HTMLElement | null) => void };
const HelpContext = createContext<HelpContextValue>({ open: () => {} });

function Block({ block }: { block: HelpBlock }) {
  switch (block.tipo) {
    case "subtitulo":
      return <h3 className="mt-2 font-bold text-night">{block.texto}</h3>;
    case "lista":
      return (
        <ul className="grid gap-2 pl-5 text-sm leading-relaxed text-slate-700">
          {block.items.map((item, index) => (
            <li key={index} className="list-disc">
              {item}
            </li>
          ))}
        </ul>
      );
    case "pasos":
      return (
        <ol className="grid gap-2 pl-5 text-sm leading-relaxed text-slate-700">
          {block.items.map((item, index) => (
            <li key={index} className="list-decimal">
              {item}
            </li>
          ))}
        </ol>
      );
    case "aviso":
      return (
        <p className="rounded-lg border-l-4 border-turquoise bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {block.texto}
        </p>
      );
    default:
      return <p className="text-sm leading-relaxed text-slate-700">{block.texto}</p>;
  }
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [activeKey, setActiveKey] = useState<HelpKey | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const open = useCallback((key: HelpKey, trigger: HTMLElement | null) => {
    triggerRef.current = trigger;
    setActiveKey(key);
  }, []);

  // Al cerrar se devuelve el foco al "?" que lo abrió, para no perder el lugar
  // cuando se navega con teclado.
  const close = useCallback(() => {
    setActiveKey(null);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!activeKey) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeKey, close]);

  const entry = activeKey ? HELP[activeKey] : null;

  return (
    <HelpContext.Provider value={{ open }}>
      {children}
      {entry ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/35"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="ayuda-titulo"
            className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white p-5 text-night shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-turquoise">Ayuda</p>
                <h2 id="ayuda-titulo" className="mt-1 text-xl font-bold">
                  {entry.title}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Cerrar la ayuda"
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:text-night"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-600">{entry.short}</p>
            <div className="mt-5 grid gap-3">
              {entry.long.map((block, index) => (
                <Block key={index} block={block} />
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </HelpContext.Provider>
  );
}

// El tooltip va en un portal con posición fija para que no lo recorten las tablas
// con scroll horizontal ni el overflow de las tarjetas.
export function HelpButton({ helpKey }: { helpKey: HelpKey }) {
  const entry = HELP[helpKey];
  const { open } = useContext(HelpContext);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);
  const tipId = useId();

  const showTip = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({
      top: rect.bottom + 8,
      left: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150),
    });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  useEffect(() => {
    if (!tip) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideTip();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", hideTip, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", hideTip, true);
    };
  }, [tip, hideTip]);

  return (
    <>
      <button
        ref={buttonRef}
        // type="button" es obligatorio: varios "?" viven dentro de formularios y
        // sin esto el click los enviaría.
        type="button"
        aria-label={`Ayuda sobre ${entry.title}`}
        aria-describedby={tip ? tipId : undefined}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        onClick={() => {
          hideTip();
          open(helpKey, buttonRef.current);
        }}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-turquoise hover:text-turquoise"
      >
        <HelpCircle size={14} aria-hidden />
      </button>
      {tip
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              style={{ top: tip.top, left: tip.left }}
              className="pointer-events-none fixed z-[60] w-[min(18rem,90vw)] -translate-x-1/2 rounded-lg bg-night px-3 py-2 text-xs font-normal leading-snug text-cream shadow-xl"
            >
              {entry.short}
              <span className="mt-1 block text-cream/60">Tocá el signo para ver más</span>
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

// Título de sección con su "?" al lado. Reemplaza a los <h2> sueltos y conserva la
// clase original de cada uno para no cambiar el diseño existente.
export function PanelHeading({
  children,
  helpKey,
  as: Tag = "h2",
  className = "font-bold",
}: {
  children: React.ReactNode;
  helpKey: HelpKey;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <Tag className={`flex items-center gap-2 ${className}`}>
      {children}
      <HelpButton helpKey={helpKey} />
    </Tag>
  );
}
