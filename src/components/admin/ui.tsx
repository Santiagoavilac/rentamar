import Link from "next/link";
import { formatCurrency } from "@/lib/money";

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow text-turquoise">Operaciones</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-night">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {action}
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
  return <section className={`surface rounded-2xl p-5 ${className}`}>{children}</section>;
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
          className="mt-4 inline-block rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream"
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
      className="mt-5 flex items-center justify-between text-sm text-slate-600"
      aria-label="Paginación"
    >
      <span>
        Página {page} de {pages} · {total} resultados
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="rounded border px-3 py-1.5" href={href(page - 1)}>
            Anterior
          </Link>
        ) : null}
        {page < pages ? (
          <Link className="rounded border px-3 py-1.5" href={href(page + 1)}>
            Siguiente
          </Link>
        ) : null}
      </div>
    </nav>
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
