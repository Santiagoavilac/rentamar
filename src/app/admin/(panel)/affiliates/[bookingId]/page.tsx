import Link from "next/link";
import {
  AdminPageHeader,
  KeyValue,
  Money,
  Panel,
  StatusBadge,
  formatDateTime,
} from "@/components/admin/ui";
import { PanelHeading } from "@/components/admin/help";
import { ReasonActionForm } from "@/components/admin/forms";
import { DeclarationPanel } from "@/components/admin/declaration-cell";
import { affiliateRequestAction } from "@/lib/admin/actions";
import { getAffiliateRequestDetail } from "@/lib/admin/affiliates";
import { listBookingEvents } from "@/lib/admin/bookings";
import { listCheckins, isAccessApproved } from "@/lib/admin/access";
import { CheckinPanel } from "@/components/access/checkin-forms";
import { checkInPersonAction, undoCheckInAction } from "@/lib/admin/access-actions";
import { listIdDocuments } from "@/lib/id-documents";
import { IdPhotosPanel } from "@/components/admin/id-photos-panel";
import {
  uploadIdDocumentAction,
  deleteIdDocumentAction,
} from "@/lib/admin/id-document-actions";
import { getDeclarationForBooking } from "@/lib/admin/declarations";
import { assertAdminAction, requireStaff } from "@/lib/auth";

export default async function AffiliateRequestPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const session = await requireStaff();
  assertAdminAction(session.role, "affiliate.review");
  const { bookingId } = await params;
  const target = { bookingId, stayId: null };
  const [
    { booking, companions, property },
    events,
    idDocuments,
    declaration,
    checkins,
    accessApproved,
  ] = await Promise.all([
    getAffiliateRequestDetail(bookingId),
    listBookingEvents(bookingId),
    listIdDocuments({ kind: "booking", bookingId }),
    getDeclarationForBooking(bookingId),
    listCheckins(target),
    isAccessApproved(target),
  ]);
  const open = booking.status === "pending_payment";

  // El afiliado sube su propio carnet desde el formulario público; la oficina completa lo
  // que falte y carga el de los acompañantes, que el flujo público no pide.
  const people = [
    { ref: null, name: booking.guest_name, documentId: booking.affiliate_document_id },
    ...companions.map((companion) => ({
      ref: companion.id,
      name: companion.full_name,
      documentId: companion.document_id,
    })),
  ];
  const checkinPeople = people.map((person) => {
    const checkin = checkins.find((row) => row.personRef === person.ref);
    return {
      ...person,
      checkedIn: Boolean(checkin),
      wristbandDelivered: checkin?.wristbandDelivered ?? false,
      checkedInAt: checkin?.checkedInAt ?? null,
    };
  });

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
            <PanelHeading helpKey="registro.checkin">Registro de ingreso</PanelHeading>
            <CheckinPanel
              target={{ bookingId }}
              people={checkinPeople}
              approved={accessApproved}
              checkInAction={checkInPersonAction}
              undoAction={undoCheckInAction}
            />
          </Panel>
          <Panel>
            <PanelHeading helpKey="registro.fotos.carnet">Subir fotos de carnet</PanelHeading>
            <IdPhotosPanel
              target={{ bookingId }}
              people={people}
              documents={idDocuments}
              uploadAction={uploadIdDocumentAction}
              deleteAction={deleteIdDocumentAction}
              canDelete={session.role === "admin"}
            />
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
              <DeclarationPanel declaration={declaration} target={{ kind: "booking", bookingId }} />
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
                    {event.reason || "Sin motivo"} · {formatDateTime(event.created_at)}
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
