import Link from "next/link";
import { AdminPageHeader, KeyValue, Money, Panel, StatusBadge } from "@/components/admin/ui";
import { PanelHeading } from "@/components/admin/help";
import { ReasonActionForm } from "@/components/admin/forms";
import { DeclarationButton } from "@/components/declaration-button";
import { affiliateRequestAction } from "@/lib/admin/actions";
import { getAffiliateRequestDetail } from "@/lib/admin/affiliates";
import { listBookingEvents } from "@/lib/admin/bookings";
import { listBookingIdDocuments } from "@/lib/id-documents";
import { assertAdminAction, requireStaff } from "@/lib/auth";

export default async function AffiliateRequestPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "affiliate.review");
  const { bookingId } = await params;
  const [{ booking, companions, property }, events, idDocuments] = await Promise.all([
    getAffiliateRequestDetail(bookingId),
    listBookingEvents(bookingId),
    listBookingIdDocuments(bookingId),
  ]);
  const idFront = idDocuments.find((doc) => doc.side === "front");
  const idBack = idDocuments.find((doc) => doc.side === "back");
  const open = booking.status === "pending_payment";

  return (
    <>
      <AdminPageHeader
        title={`Solicitud ${booking.booking_code}`}
        description="Reserva de afiliado. El pago se coordina por WhatsApp, no pasa por la pasarela."
        action={
          <Link className="text-sm font-semibold text-cyan-700" href="/admin/affiliates">
            Volver
          </Link>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_.75fr]">
        <div className="grid gap-5">
          <Panel>
            <dl className="grid gap-4 sm:grid-cols-2">
              <KeyValue label="Afiliado">
                {booking.guest_name}
                <br />
                CI {booking.affiliate_document_id || "—"}
                <br />
                {booking.guest_phone || "—"}
                {booking.guest_email ? (
                  <>
                    <br />
                    {booking.guest_email}
                  </>
                ) : null}
              </KeyValue>
              <KeyValue label="Propiedad">{property?.name || "—"}</KeyValue>
              <KeyValue label="Estadía">
                {booking.check_in} → {booking.check_out} ({booking.nights} noches)
              </KeyValue>
              <KeyValue label="Personas">{booking.guests}</KeyValue>
              <KeyValue label="Estado">
                <StatusBadge value={booking.status} />
              </KeyValue>
              <KeyValue label="Total">
                <Money amount={booking.total_minor} currency={booking.currency} />
              </KeyValue>
            </dl>
          </Panel>
          <Panel>
            <PanelHeading helpKey="affiliates.detail.id">Carnet de identidad</PanelHeading>
            {idFront || idBack ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {(["front", "back"] as const).map((side) => {
                  const doc = side === "front" ? idFront : idBack;
                  const label = side === "front" ? "Anverso" : "Reverso";
                  if (!doc) {
                    return (
                      <div
                        key={side}
                        className="rounded border border-dashed border-slate-300 p-3 text-sm text-slate-500"
                      >
                        {label}: sin cargar
                      </div>
                    );
                  }
                  return (
                    <a
                      key={side}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded border border-slate-200 p-2 text-sm font-semibold text-cyan-700"
                    >
                      <span className="mb-1 block">{label}</span>
                      {doc.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={doc.url}
                          alt={`Carnet ${label.toLowerCase()}`}
                          className="h-40 w-full rounded object-cover"
                        />
                      ) : (
                        <span className="block rounded bg-slate-50 py-8 text-center text-slate-500">
                          Ver PDF
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">El afiliado no cargó el carnet.</p>
            )}
          </Panel>
          <Panel>
            <PanelHeading helpKey="affiliates.detail.companions">Acompañantes</PanelHeading>
            {companions.length ? (
              <ul className="mt-3 grid gap-2 text-sm">
                {companions.map((companion) => (
                  <li key={companion.id} className="rounded border border-slate-200 p-3">
                    <strong>{companion.full_name}</strong>
                    <span className="block text-slate-500">
                      CI {companion.document_id}
                      {companion.phone ? ` · ${companion.phone}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">El afiliado viaja sin acompañantes.</p>
            )}
          </Panel>
        </div>
        <div className="grid gap-5">
          <Panel>
            <PanelHeading helpKey="affiliates.detail.operations">Operaciones</PanelHeading>
            {open ? (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Confirmar mantiene el pago como pendiente. Cancelar libera las fechas de
                  inmediato.
                </p>
                <ReasonActionForm
                  action={affiliateRequestAction.bind(null, bookingId, "confirm")}
                  label="Confirmar solicitud"
                  confirm="Confirmo que acordé la reserva con el afiliado."
                />
                <ReasonActionForm
                  action={affiliateRequestAction.bind(null, bookingId, "cancel")}
                  label="Cancelar y desbloquear"
                />
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                La solicitud ya está resuelta. Para más operaciones usá la ficha de reserva.
              </p>
            )}
            <div className="mt-4">
              <DeclarationButton target={{ kind: "booking", bookingId }} compact />
              <p className="mt-2 text-xs text-slate-500">
                Se descarga sin firma para imprimir y firmar en oficina.
              </p>
            </div>
            <Link
              className="mt-4 inline-block text-sm font-semibold text-cyan-700"
              href={`/admin/bookings/${bookingId}`}
            >
              Ver ficha completa de la reserva
            </Link>
          </Panel>
          <Panel>
            <PanelHeading helpKey="affiliates.detail.history">Historial</PanelHeading>
            <ul className="mt-3 grid gap-3 text-sm">
              {events.map((event) => (
                <li key={event.id}>
                  <strong>{event.event_type}</strong>
                  <span className="block text-slate-500">
                    {event.reason || "Sin motivo"} ·{" "}
                    {new Date(event.created_at).toLocaleString("es-BO")}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
