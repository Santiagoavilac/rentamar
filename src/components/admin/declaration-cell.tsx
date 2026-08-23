import { DeclarationButton, type DeclarationTargetInput } from "@/components/declaration-button";
import { formatDateTime } from "./ui";
import type { DeclarationSummary } from "@/lib/admin/declarations";

// Celda de listado: si la declaración ya se emitió muestra el PDF guardado (URL firmada,
// bucket privado); si no, el botón que la genera en el momento.
export function DeclarationCell({
  declaration,
  target,
}: {
  declaration?: DeclarationSummary;
  target: DeclarationTargetInput;
}) {
  if (declaration?.url) {
    return (
      <a
        href={declaration.url}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-cyan-700"
        title={`Emitida el ${formatDateTime(declaration.generatedAt)}`}
      >
        Ver PDF
      </a>
    );
  }
  return <DeclarationButton compact requireAccept={false} target={target} />;
}

// Panel del detalle: estado + PDF guardado + botón para (re)generar y descargar.
export function DeclarationPanel({
  declaration,
  target,
}: {
  declaration: DeclarationSummary | null;
  target: DeclarationTargetInput;
}) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-slate-600">
        {declaration
          ? `Emitida el ${formatDateTime(declaration.generatedAt)}.`
          : "Todavía no se emitió."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {declaration?.url ? (
          <a
            href={declaration.url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-cyan-700"
          >
            Ver PDF guardado
          </a>
        ) : null}
        <DeclarationButton compact requireAccept={false} target={target} />
      </div>
      <p className="text-xs text-slate-500">
        Se descarga sin firma para imprimir y firmar en oficina.
      </p>
    </div>
  );
}
