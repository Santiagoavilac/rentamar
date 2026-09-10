import Link from "next/link";
import { formatCurrency } from "@/lib/money";
import { ADMIN_TIME_ZONE } from "@/lib/admin/planner-query";
import { checkinLabel, checkinState } from "@/lib/checkin-state";
import { HelpButton } from "./help";
import type { HelpKey } from "@/lib/admin/help";

export function AdminPageHeader({
  title,
  description,
  action,
  helpKey,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  helpKey?: HelpKey;
}) {
  return (
    <div className="mb-5 flex flex-col items-stretch justify-between gap-4 sm:mb-7 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-0">
        <p className="eyebrow text-turquoise">Operaciones</p>
        <h1 className="mt-2 flex min-w-0 items-start gap-2 text-2xl font-bold tracking-tight text-night sm:text-3xl">
          <span className="min-w-0">{title}</span>
          {helpKey ? <HelpButton helpKey={helpKey} /> : null}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="admin-header-action sm:shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const normalized = value ?? "sin estado";
  const tone = /paid|confirmed|published|active|completed/.test(normalized)
    ? "bg-emerald-100 text-emerald-800"
    : /cancel|expired|error|refund/.test(normalized)
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-800";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

// Verde / ámbar / rojo del registro de ingreso. Lo pide recepción para ver de un vistazo,
// en la lista, a quién falta registrar. El ámbar lleva el conteo porque "faltan algunos" sin
// decir cuántos obliga a entrar al detalle igual.
export function CheckinBadge({
  checkedIn,
  total,
}: {
  checkedIn: number;
  total: number;
}) {
  const state = checkinState(checkedIn, total);
  const tone =
    state === "ninguno"
      ? "bg-rose-100 text-rose-800"
      : state === "completo"
        ? "bg-emerald-100 text-emerald-800"
        : "bg-amber-100 text-amber-800";
  const label = checkinLabel(checkedIn, total);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

// Siempre en hora de Bolivia: el proceso corre en UTC en producción, así que sin fijar la
// zona el panel mostraba 18:00 donde el copropietario había escrito 14:00.
export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-BO", {
    timeZone: ADMIN_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function Money({ amount, currency = "BOB" }: { amount: number; currency?: string }) {
  return <>{formatCurrency(amount, currency)}</>;
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`surface rounded-2xl p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function EmptyState({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
      <h2 className="font-semibold text-night">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{body}</p>
      {href && label ? (
        <Link
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream"
          href={href}
        >
          {label}
        </Link>
      ) : null}
    </div>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  basePath,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (next: number) => `${basePath}${basePath.includes("?") ? "&" : "?"}page=${next}`;
  return (
    <nav
      className="mt-5 flex flex-col items-stretch gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Paginación"
    >
      <span>
        Página {page} de {pages} · {total} resultados
      </span>
      <div className="flex gap-2 sm:justify-end">
        {page > 1 ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded border px-3 py-1.5"
            href={href(page - 1)}
          >
            Anterior
          </Link>
        ) : null}
        {page < pages ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded border px-3 py-1.5"
            href={href(page + 1)}
          >
            Siguiente
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function AdminResponsiveTable({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="admin-table-wrap">
      <table className={`admin-responsive-table w-full text-left text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-night">{children || "—"}</dd>
    </div>
  );
}
