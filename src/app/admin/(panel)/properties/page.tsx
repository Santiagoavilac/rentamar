import Link from "next/link";
import { listProperties } from "@/lib/admin/properties";
import {
  AdminPageHeader,
  EmptyState,
  Money,
  Pager,
  Panel,
  StatusBadge,
} from "@/components/admin/ui";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const result = await listProperties({ page: Math.max(1, Number(page) || 1), pageSize: 20 });
  return (
    <>
      <AdminPageHeader
        title="Propiedades"
        description="Catálogo, visibilidad y precios base."
        action={
          <Link
            href="/admin/properties/new"
            className="rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream"
          >
            Nueva propiedad
          </Link>
        }
      />
      <Panel>
        {result.rows.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="pb-3">Propiedad</th>
                    <th className="pb-3">Estado</th>
                    <th className="pb-3">Zona</th>
                    <th className="pb-3">Precio base</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-3 font-semibold">
                        {p.name}
                        <span className="block text-xs font-normal text-slate-500">
                          /{p.slug} · {p.max_guests} huéspedes
                        </span>
                      </td>
                      <td className="py-3">
                        <StatusBadge value={p.status} />
                      </td>
                      <td className="py-3">{p.zone || "—"}</td>
                      <td className="py-3">
                        <Money amount={p.base_price_minor} currency={p.currency} />
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          className="font-semibold text-cyan-700"
                          href={`/admin/properties/${p.id}/images`}
                        >
                          Imágenes
                        </Link>
                        <Link
                          className="ml-4 font-semibold text-cyan-700"
                          href={`/admin/properties/${p.id}`}
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...result} basePath="/admin/properties" />
          </>
        ) : (
          <EmptyState
            title="No hay propiedades"
            body="Creá la primera propiedad para comenzar a operar el catálogo."
            href="/admin/properties/new"
            label="Nueva propiedad"
          />
        )}
      </Panel>
    </>
  );
}
