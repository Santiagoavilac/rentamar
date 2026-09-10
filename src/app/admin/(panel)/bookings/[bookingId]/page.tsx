import Link from "next/link";
import { getBookingDetail, listBookingEvents } from "@/lib/admin/bookings";
import { getDeclarationForBooking } from "@/lib/admin/declarations";
import { DeclarationPanel } from "@/components/admin/declaration-cell";
import { bookingAction } from "@/lib/admin/actions";
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
import { IdPhotosPanel } from "@/components/admin/id-photos-panel";
import { listIdDocuments } from "@/lib/id-documents";
import { listBookingCompanions, listCheckins, isAccessApproved } from "@/lib/admin/access";
import { CheckinPanel } from "@/components/access/checkin-forms";
import { checkInPersonAction, undoCheckInAction } from "@/lib/admin/access-actions";
import {
  uploadIdDocumentAction,
  deleteIdDocumentAction,
} from "@/lib/admin/id-document-actions";
import { requireStaff } from "@/lib/auth";
export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const session = await requireStaff();
  const { bookingId } = await params;
  const target = { bookingId, stayId: null };
  const [
    { booking, items, property },
    events,
    declaration,
    idDocuments,
    companions,
    checkins,
    accessApproved,
  ] = await Promise.all([
    getBookingDetail(bookingId),
    listBookingEvents(bookingId),
    getDeclarationForBooking(bookingId),
    listIdDocuments({ kind: "booking", bookingId }),
    listBookingCompanions(bookingId),
    listCheckins(target),
    isAccessApproved(target),
  ]);

  // El alquiler directo solo guarda el titular; los acompañantes los carga recepción desde
  // Control de acceso. Los que ya estén cargados aparecen acá para poder fotografiar su CI.
  const people = [
    { ref: null, name: booking.guest_name, documentId: booking.guest_document_id },
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
  const controls: Array<["cancel" | "expire" | "manual_review" | "confirm_manual", string]> = [
    ["manual_review", "Enviar a revisión"],
    ["cancel", "Cancelar reserva"],
    ["expire", "Expirar reserva"],
    ["confirm_manual", "Confirmar manualmente"],
  ];
  return (
    <>
      <AdminPageHeader
        title={`Reserva ${booking.booking_code}`}
        action={
          <Link className="text-sm font-semibold text-cyan-700" href="/admin/bookings">
            Volver
          </Link>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_.75fr]">
        <Panel>
          <dl className="grid gap-4 sm:grid-cols-2">
            <KeyValue label="Huésped">
              {booking.guest_name}
              <br />
              {booking.guest_email}
              <br />
              {booking.guest_phone}
            </KeyValue>
            <KeyValue label="Propiedad">{property?.name || "—"}</KeyValue>
            <KeyValue label="Estadía">
              {booking.check_in} → {booking.check_out} ({booking.nights} noches)
            </KeyValue>
            <KeyValue label="Estado">
              <StatusBadge value={booking.status} /> <StatusBadge value={booking.payment_status} />
            </KeyValue>
            <KeyValue label="Total">
              <Money amount={booking.total_minor} currency={booking.currency} />
            </KeyValue>
            <KeyValue label="Hold vence">{booking.hold_expires_at || "—"}</KeyValue>
          </dl>
          <PanelHeading helpKey="bookings.detail.charges" className="mt-7 font-bold">
            Detalle de cobro
          </PanelHeading>
          <ul className="mt-2 text-sm">
            {items.map((i, index) => (
              <li key={index} className="border-b py-2">
                {i.description}{" "}
                <span className="float-right">
                  <Money amount={i.total_amount_minor} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="grid gap-5">
          <Panel>
            <PanelHeading helpKey="bookings.detail.operations">Operaciones</PanelHeading>
            <p className="mt-2 text-sm text-slate-600">
              Toda operación exige motivo y se registra en auditoría. Las reservas pagadas quedan en
              revisión de reembolso, sin devolución automática.
            </p>
            {controls.map(([op, label]) => (
              <ReasonActionForm
                key={op}
                action={bookingAction.bind(null, bookingId, op)}
                label={label}
                confirm={
                  op === "confirm_manual"
                    ? "Confirmo que verifiqué el pago manualmente."
                    : undefined
                }
              />
            ))}
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
            <PanelHeading helpKey="declaration.panel">Declaración jurada</PanelHeading>
            <div className="mt-3">
              <DeclarationPanel declaration={declaration} target={{ kind: "booking", bookingId }} />
            </div>
          </Panel>
          <Panel>
            <PanelHeading helpKey="bookings.detail.history">Historial</PanelHeading>
            <ul className="mt-3 grid gap-3 text-sm">
              {events.map((e) => (
                <li key={e.id}>
                  <strong>{e.event_type}</strong>
                  <span className="block text-slate-500">
                    {e.reason || "Sin motivo"} · {formatDateTime(e.created_at)}
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
