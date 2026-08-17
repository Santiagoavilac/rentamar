import Link from "next/link";
import { getProperty, getPropertyImages } from "@/lib/admin/properties";
import {
  deletePropertyImageAction,
  reorderPropertyImagesAction,
  uploadPropertyImageAction,
} from "@/lib/admin/actions";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { PanelHeading } from "@/components/admin/help";
import { ImageUploadForm } from "@/components/admin/forms";
import { PropertyImagesManager } from "@/components/admin/property-images";
import { requireStaff } from "@/lib/auth";

export default async function PropertyImagesPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const [property, images] = await Promise.all([
    getProperty(propertyId),
    getPropertyImages(propertyId),
    requireStaff(),
  ]);

  return (
    <>
      <AdminPageHeader
        title={`Imágenes · ${property.name}`}
        description="Orden de la galería pública y alta o baja de fotos."
        helpKey="properties.images.page"
        action={
          <Link
            href={`/admin/properties/${propertyId}`}
            className="text-sm font-semibold text-cyan-700"
          >
            Volver a la propiedad
          </Link>
        }
      />
      <Panel>
        <PanelHeading helpKey="properties.images.upload" className="mb-3 font-bold">
          Subir imagen
        </PanelHeading>
        <ImageUploadForm action={uploadPropertyImageAction.bind(null, propertyId)} />
      </Panel>
      <Panel className="mt-5">
        <PanelHeading helpKey="properties.images.gallery" className="mb-3 font-bold">
          Galería ({images.length})
        </PanelHeading>
        <PropertyImagesManager
          images={images}
          reorderAction={reorderPropertyImagesAction.bind(null, propertyId)}
          deleteAction={deletePropertyImageAction.bind(null, propertyId)}
        />
      </Panel>
    </>
  );
}
