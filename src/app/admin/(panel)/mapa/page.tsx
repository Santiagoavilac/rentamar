import Link from "next/link";
import { AdminPageHeader, EmptyState } from "@/components/admin/ui";
import { getMapForEditor, listLinkableProperties, listTowersForMap } from "@/lib/admin/maps";
import { NotFoundError } from "@/lib/errors";
import { MapEditor } from "@/components/admin/map/MapEditor";

const MAP_SLUG = "mar-adentro";

export default async function AdminMapaPage() {
  let data: Awaited<ReturnType<typeof getMapForEditor>> | null = null;
  try {
    data = await getMapForEditor(MAP_SLUG);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }

  if (!data) {
    return (
      <>
        <AdminPageHeader
          title="Mapa de Mar Adentro"
          description="Editor visual del masterplan interactivo."
        />
        <EmptyState
          title="Todavía no hay un mapa"
          body="Ejecutá el script de carga (npx tsx scripts/upload-map.mts) para subir la imagen base y crear el mapa “mar-adentro”. Después recargá esta página."
        />
      </>
    );
  }

  const [properties, towers] = await Promise.all([listLinkableProperties(), listTowersForMap()]);

  return (
    <>
      <AdminPageHeader
        title={data.map.name}
        description="Colocá, editá y publicá los puntos de interés del masterplan."
        action={
          <Link href="/mapa" target="_blank" className="text-sm font-semibold text-cyan-700">
            Abrir visor público
          </Link>
        }
      />
      <MapEditor map={data.map} initialItems={data.items} properties={properties} towers={towers} />
    </>
  );
}
