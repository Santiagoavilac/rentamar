import Link from "next/link";
import { listProperties } from "@/lib/admin/properties";
import { listRates } from "@/lib/admin/rates";
import { AdminPageHeader, EmptyState, Money, Panel } from "@/components/admin/ui";
export default async function PricingPage() {
  const properties = await listProperties({ page: 1, pageSize: 100 });
  const rows = await Promise.all(
    properties.rows.map(async (p) => ({ property: p, rates: await listRates(p.id) })),
  );
  return (
    <>
      <AdminPageHeader
        title="Tarifas y precios"
        description="Los cambios de tarifas se realizan por RPC y quedan en el historial de precios."
      />
      <div className="grid gap-4">
        {rows.length ? (
          rows.map(({ property, rates }) => (
            <Panel key={property.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">{property.name}</h2>
                  <p className="text-sm text-slate-600">
                    Precio base:{" "}
                    <Money amount={property.base_price_minor} currency={property.currency} />
                  </p>
                </div>
                <Link
                  className="text-sm font-semibold text-cyan-700"
                  href={`/admin/properties/${property.id}`}
                >
                  Gestionar en propiedad
                </Link>
              </div>
              {rates.length ? (
                <ul className="mt-4 grid gap-2 text-sm">
                  {rates.map((r) => (
                    <li key={r.id} className="rounded border p-2">
                      {r.label || "Tarifa estacional"}: {r.start_date} a {r.end_date} ·{" "}
                      <Money amount={r.nightly_price_minor} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  Sin tarifas estacionales configuradas.
                </p>
              )}
            </Panel>
          ))
        ) : (
          <EmptyState
            title="Sin propiedades"
            body="No hay precios que administrar todavía."
            href="/admin/properties/new"
            label="Nueva propiedad"
          />
        )}
      </div>
    </>
  );
}
