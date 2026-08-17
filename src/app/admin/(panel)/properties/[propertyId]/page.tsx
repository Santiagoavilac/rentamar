import Link from "next/link";
import Image from "next/image";
import {
  getProperty,
  getPropertyImages,
  getPropertyAmenities,
  listAmenities,
} from "@/lib/admin/properties";
import { listRates, listPriceHistory } from "@/lib/admin/rates";
import { savePropertyAction } from "@/lib/admin/actions";
import { AdminPageHeader, KeyValue, Money, Panel, StatusBadge } from "@/components/admin/ui";
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
  const [property, images, amenityIds, amenities, rates, history, towers, weekend] =
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
            <h2 className="mb-3 font-bold">Estado actual</h2>
            <dl className="grid grid-cols-2 gap-4">
              <KeyValue label="Estado">
                <StatusBadge value={property.status} />
              </KeyValue>
              <KeyValue label="Precio">
                <Money amount={property.base_price_minor} currency={property.currency} />
              </KeyValue>
              <KeyValue label="Imágenes">{images.length}</KeyValue>
              <KeyValue label="Amenities">
                {amenityIds.length} de {amenities.length}
              </KeyValue>
            </dl>
          </Panel>
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">Imágenes ({images.length})</h2>
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
            <h2 className="font-bold">Cambios de precio</h2>
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
