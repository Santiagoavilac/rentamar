import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { assertAdminAction } from "@/lib/permissions";
import { getCoOwnerStay } from "@/lib/admin/co-owners";
import { AppError } from "@/lib/errors";
import { AdminPageHeader, KeyValue, Panel, formatDateTime } from "@/components/admin/ui";
import { PanelHeading } from "@/components/admin/help";

export const dynamic = "force-dynamic";

export default async function CoOwnerStayDetailPage({
  params,
}: {
  params: Promise<{ stayId: string }>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "coowner.manage");

  const { stayId } = await params;
  let stay;
  try {
    stay = await getCoOwnerStay(stayId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <>
      <AdminPageHeader
        title="Estadía declarada"
        description={`Registrada el ${formatDateTime(stay.created_at)} por ${stay.username}.`}
        action={
          <Link
            href="/admin/copropietarios/registros"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            Volver
          </Link>
        }
      />
      <Panel>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <KeyValue label="Usuario">{stay.username}</KeyValue>
          <KeyValue label="Propiedad">{stay.property_name}</KeyValue>
          <KeyValue label="N° de habitaciones">{String(stay.room_count)}</KeyValue>
          <KeyValue label="Nombre completo">{stay.full_name}</KeyValue>
          <KeyValue label="CI">{stay.document_id}</KeyValue>
          <KeyValue label="Teléfono">{stay.phone}</KeyValue>
          <KeyValue label="Fecha de nacimiento">{stay.birth_date ?? "-"}</KeyValue>
          <KeyValue label="Entrada">{formatDateTime(stay.check_in_at)}</KeyValue>
          <KeyValue label="Salida">{formatDateTime(stay.check_out_at)}</KeyValue>
          <KeyValue label="Adultos">{String(stay.adults)}</KeyValue>
          <KeyValue label="Menores de 2 años">{String(stay.minors)}</KeyValue>
          <KeyValue label="Registrado">{formatDateTime(stay.created_at)}</KeyValue>
        </dl>
      </Panel>

      <Panel>
        <PanelHeading helpKey="coowners.detail.guests" className="mb-4 text-sm font-bold">
          Huéspedes adicionales
        </PanelHeading>
        {stay.guests.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nombre completo</th>
                  <th className="px-4 py-3">CI</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Nacimiento</th>
                </tr>
              </thead>
              <tbody>
                {stay.guests.map((guest, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{guest.full_name}</td>
                    <td className="px-4 py-3">{guest.document_id}</td>
                    <td className="px-4 py-3">{guest.phone ?? "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{guest.birth_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">La estadía se declaró con un solo huésped.</p>
        )}
      </Panel>
    </>
  );
}
