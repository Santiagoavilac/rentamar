import Link from "next/link";
import { AdminPageHeader, EmptyState, Panel } from "@/components/admin/ui";
import { PricingEditor } from "@/components/admin/pricing-editor";
import { WeekendPricingForm } from "@/components/admin/forms";
import { savePropertyPricingAction, setWeekendPricingAction } from "@/lib/admin/actions";
import { getProperty, listProperties } from "@/lib/admin/properties";
import { listRates, listStayPrices } from "@/lib/admin/rates";
import { requireStaff } from "@/lib/auth";
import { getWeekendPricing } from "@/lib/settings";

type SearchParams = { propertyId?: string | string[] };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, properties] = await Promise.all([
    searchParams,
    listProperties({ page: 1, pageSize: 100 }),
    requireStaff(),
  ]);
  if (!properties.rows.length) {
    return (
      <>
        <AdminPageHeader title="Tarifas y precios" description="Configuración por propiedad." />
        <EmptyState
          title="Sin propiedades"
          body="No hay precios que administrar todavía."
          href="/admin/properties/new"
          label="Nueva propiedad"
        />
      </>
    );
  }

  const requested = Array.isArray(params.propertyId) ? params.propertyId[0] : params.propertyId;
  const selectedId = properties.rows.some((property) => property.id === requested)
    ? (requested as string)
    : properties.rows[0].id;
  const [property, prices, rates, weekend] = await Promise.all([
    getProperty(selectedId),
    listStayPrices(selectedId),
    listRates(selectedId),
    getWeekendPricing(),
  ]);
  const saveAction = savePropertyPricingAction.bind(null, selectedId);

  return (
    <>
      <AdminPageHeader
        title="Tarifas y precios"
        description="Define el precio base, paquetes por cantidad de noches y tarifas estacionales."
        action={
          <Link
            href={`/admin/properties/${selectedId}`}
            className="text-sm font-semibold text-cyan-700"
          >
            Editar propiedad
          </Link>
        }
      />
      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-semibold text-slate-700">
            Propiedad
            <select
              name="propertyId"
              defaultValue={selectedId}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {properties.rows.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
            Seleccionar
          </button>
        </form>
      </Panel>
      <div className="mt-5">
        <PricingEditor
          action={saveAction}
          propertyId={selectedId}
          maxGuests={property.max_guests}
          initialBaseMinor={property.base_price_minor}
          initialEnabled={property.duration_pricing_enabled}
          initialPrices={prices}
        />
      </div>
      <Panel className="mt-5">
        <h2 className="font-bold">Fin de semana y feriados</h2>
        <p className="mt-1 text-sm text-slate-600">
          El recargo de fin de semana es global: los días marcados y el porcentaje valen para todas
          las propiedades, sobre el precio base de cada una. Para un feriado, cargá una tarifa
          estacional de ese día en la propiedad: tiene prioridad sobre todo lo demás.
        </p>
        <WeekendPricingForm
          action={setWeekendPricingAction}
          days={weekend.days}
          surchargePercent={weekend.surchargePercent}
          basePriceMinor={property.base_price_minor}
        />
      </Panel>
      <Panel className="mt-5">
        <h2 className="font-bold">Tarifas estacionales</h2>
        <p className="mt-1 text-sm text-slate-600">
          Tienen prioridad sobre los descuentos por duración.
        </p>
        {rates.length ? (
          <ul className="mt-3 grid gap-2 text-sm">
            {rates.map((rate) => (
              <li key={rate.id} className="rounded border border-slate-200 p-3">
                {rate.label || "Tarifa estacional"}: {rate.start_date} a {rate.end_date} · Bs{" "}
                {(rate.nightly_price_minor / 100).toLocaleString("es-BO", {
                  minimumFractionDigits: 2,
                })}{" "}
                por noche
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Sin tarifas estacionales configuradas.</p>
        )}
      </Panel>
    </>
  );
}
