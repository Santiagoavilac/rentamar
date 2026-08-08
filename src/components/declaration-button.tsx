"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

export type DeclarationTargetInput =
  | { kind: "booking"; bookingId: string; token?: string | null }
  | { kind: "stay"; stayId: string };

// El cuerpo lleva solo el identificador: el nombre, la cédula y el teléfono que salen
// impresos los lee el servidor de la base, así que no se pueden falsear desde acá.
async function download(target: DeclarationTargetInput) {
  const response = await fetch("/api/declaraciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      target.kind === "booking"
        ? {
            kind: "booking",
            bookingId: target.bookingId,
            token: target.token ?? undefined,
            accept: true,
          }
        : { kind: "stay", stayId: target.stayId, accept: true },
    ),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "No se pudo generar la declaración.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "declaracion-jurada.pdf";
  link.click();
  URL.revokeObjectURL(url);
}

export function DeclarationButton({
  target,
  requireAccept = true,
  compact = false,
}: {
  target: DeclarationTargetInput;
  requireAccept?: boolean;
  compact?: boolean;
}) {
  const [accepted, setAccepted] = useState(!requireAccept);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await download(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar la declaración.");
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        title={error ?? undefined}
        className="inline-flex items-center gap-1.5 rounded-full border border-night/15 px-3 py-1.5 text-xs font-semibold transition hover:bg-night/5 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <FileText className="h-3.5 w-3.5" aria-hidden />
        )}
        Declaración
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-night/10 p-4">
      <p className="text-sm font-semibold">Declaración jurada</p>
      {requireAccept ? (
        <label className="mt-3 flex items-start gap-2 text-sm text-night/70">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1"
          />
          Declaro que los datos proporcionados son verídicos y que he leído la Declaración Jurada
          de Responsabilidad.
        </label>
      ) : null}
      <button
        type="button"
        onClick={() => void run()}
        disabled={!accepted || busy}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-night/15 px-5 py-3 text-sm font-semibold transition hover:bg-night/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <FileText className="h-4 w-4" aria-hidden />
        )}
        Generar declaración jurada
      </button>
      <p className="mt-2 text-xs text-night/50">
        El documento se descarga sin firmar: hay que imprimirlo y firmarlo a mano.
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
