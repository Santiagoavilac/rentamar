import Link from "next/link";
import Image from "next/image";
import {
  getProperty,
  getPropertyImages,
  getPropertyAmenities,
  listAmenities,
} from "@/lib/admin/properties";
import { listRates, listPriceHistory } from "@/lib/admin/rates";
import {
  savePropertyAction,
  setPropertyAmenitiesAction,
  setPropertyStatusAction,
} from "@/lib/admin/actions";
import { AmenitiesPicker } from "@/components/admin/amenities-picker";
import { PropertyStatusActions } from "@/components/admin/forms";
import { AdminPageHeader, KeyValue, Money, Panel, StatusBadge } from "@/components/admin/ui";
import { PanelHeading } from "@/components/admin/help";
import { PropertyEditor } from "@/components/admin/property-editor";
import { requireStaff, canPerformAdminAction } from "@/lib/auth";
import { listTowerOptions } from "@/lib/admin/towers";
import { getWeekendPricing } from "@/lib/settings";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const session = await requireStaff();
  const [property, images, selectedAmenities, amenities, rates, history, towers, weekend] =
    await Promise.all([
      getProperty(propertyId),
      getPropertyImages(propertyId),
      getPropertyAmenities(propertyId),
      listAmenities(),
      listRates(propertyId),
      listPriceHistory(propertyId),
      listTowerOptions(),
      getWeekendPricing(),
    ]);
  return (
    <>
      <AdminPageHeader
        title={property.name}
        description={`/${property.slug}`}
        helpKey="properties.detail.page"
        action={
          <Link href="/admin/properties" className="text-sm font-semibold text-cyan-700">
            Volver al catálogo
          </Link>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
        <Panel>
          <PropertyEditor
            action={savePropertyAction.bind(null, propertyId)}
            values={property}
            towers={towers}
            canManageAffiliates={canPerformAdminAction(session.role, "affiliate.manage")}
            weekend={weekend}
            rates={rates}
          />
        </Panel>
        <div className="grid gap-5">
          <Panel>
            <PanelHeading helpKey="properties.detail.status" className="mb-3 font-bold">
              Estado actual
            </PanelHeading>
            <dl className="grid gap-4 sm:grid-cols-2">
              <KeyValue label="Estado">
                <StatusBadge value={property.status} />
              </KeyValue>
              <KeyValue label="Precio">
                <Money amount={property.base_price_minor} currency={property.currency} />
              </KeyValue>
              <KeyValue label="Imágenes">{images.length}</KeyValue>
              <KeyValue label="Comodidades">
                {selectedAmenities.length} de {amenities.length}
              </KeyValue>
            </dl>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <PropertyStatusActions
                action={setPropertyStatusAction.bind(null, propertyId)}
                status={property.status}
              />
            </div>
          </Panel>
          <Panel>
            <PanelHeading helpKey="properties.detail.amenities" className="mb-1 font-bold">
              Comodidades
            </PanelHeading>
            <AmenitiesPicker
              action={setPropertyAmenitiesAction.bind(null, propertyId)}
              amenities={amenities}
              selected={selectedAmenities}
            />
          </Panel>
          <Panel>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <PanelHeading helpKey="properties.detail.images">
                Imágenes ({images.length})
              </PanelHeading>
              <Link
                href={`/admin/properties/${propertyId}/images`}
                className="rounded-lg bg-deep px-3 py-2 text-sm font-semibold text-cream"
              >
                Administrar imágenes
              </Link>
            </div>
            {images.length ? (
              <ul className="mt-3 flex gap-2 overflow-x-auto">
                {images.slice(0, 4).map((image, index) => (
                  <li
                    key={image.id}
                    className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100"
                  >
                    <Image
                      src={image.url}
                      alt={image.alt_text || `Imagen ${index + 1}`}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Todavía no hay imágenes cargadas.</p>
            )}
          </Panel>
          <Panel>
            <PanelHeading helpKey="properties.detail.priceHistory">Cambios de precio</PanelHeading>
            {history.length ? (
              <ul className="mt-3 grid gap-2 text-sm">
                {history.slice(0, 5).map((h) => (
                  <li key={h.id}>
                    {h.change_type} · {new Date(h.created_at).toLocaleDateString("es-BO")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Sin historial todavía.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
