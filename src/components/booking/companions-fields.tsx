"use client";

import { Plus, Trash2 } from "lucide-react";

// Acompañantes del titular. El flujo de afiliados ya los pedía; el de huéspedes no, y era el
// único que no los tenía. Ahora es el mismo bloque para los dos.

export type Companion = { fullName: string; documentId: string; phone: string };

export const emptyCompanion: Companion = { fullName: "", documentId: "", phone: "" };

const input = "w-full rounded-xl border border-night/15 p-2.5 text-sm";

export function CompanionsFields({
  companions,
  onChange,
  /** Cuántos se pueden cargar: el total de huéspedes menos el titular. */
  allowed,
}: {
  companions: Companion[];
  onChange: (next: Companion[]) => void;
  allowed: number;
}) {
  const update = (index: number, patch: Partial<Companion>) =>
    onChange(companions.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Acompañantes</p>
        <button
          type="button"
          disabled={companions.length >= allowed}
          onClick={() => onChange([...companions, { ...emptyCompanion }])}
          className="inline-flex items-center gap-1.5 rounded-full border border-night/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>

      {allowed === 0 ? (
        <p className="text-xs text-night/55">
          Aumentá la cantidad de huéspedes para cargar acompañantes.
        </p>
      ) : null}

      {companions.map((companion, index) => (
        <div key={index} className="grid gap-2 rounded-2xl border border-night/10 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-night/55">Acompañante {index + 1}</span>
            <button
              type="button"
              onClick={() => onChange(companions.filter((_, i) => i !== index))}
              className="text-night/45 hover:text-rose-700"
              aria-label={`Eliminar acompañante ${index + 1}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
          <input
            required
            placeholder="Nombre completo"
            value={companion.fullName}
            onChange={(event) => update(index, { fullName: event.target.value })}
            className={input}
          />
          <input
            required
            placeholder="Carnet de identidad"
            value={companion.documentId}
            onChange={(event) => update(index, { documentId: event.target.value })}
            className={input}
          />
          <input
            placeholder="Teléfono opcional"
            value={companion.phone}
            onChange={(event) => update(index, { phone: event.target.value })}
            className={input}
          />
        </div>
      ))}
    </div>
  );
}
