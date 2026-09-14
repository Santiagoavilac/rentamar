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
import { uploadIdDocumentAction, deleteIdDocumentAction } from "@/lib/admin/id-document-actions";
import { requireStaff, canPerformAdminAction } from "@/lib/auth";
import { listReceiptsForBooking, type ReceiptRow } from "@/lib/admin/payments";

// Etiqueta legible del resultado IA. Nunca se muestra el modelo ni el prompt. Espejo de la
// misma tabla en el detalle de pago.
const AI_RESULT_LABEL: Record<number, string> = {
  1: "1 · Sin confirmar (permite reintento)",
  2: "2 · Aprobado por IA",
  3: "3 · Fuera de plazo",
  4: "4 · Requiere revisión",
};

function ReceiptsPanel({ receipts }: { receipts: ReceiptRow[] }) {
  return (
    <Panel>
      <PanelHeading helpKey="bookings.detail.receipts">Comprobantes de pago</PanelHeading>
      {receipts.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Todavía no subió ningún comprobante.</p>
      ) : (
        <ul className="mt-3 grid gap-4 text-sm">
          {receipts.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <strong>Intento {r.attemptNo}</strong>
                <span className="text-slate-500">{formatDateTime(r.createdAt)}</span>
              </div>
              <p className="mt-1">
                Resultado IA:{" "}
                {r.aiStatus === "unavailable" ? "IA no disponible" : AI_RESULT_LABEL[r.aiResult ?? 4] || "—"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {r.url ? (
                  <a
                    className="inline-flex items-center gap-3 font-semibold text-cyan-700"
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.mimeType.startsWith("image/") ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Storage */
                      <img
                        src={r.url}
                        alt={`Comprobante intento ${r.attemptNo}`}
                        className="h-24 w-24 rounded border border-slate-200 object-cover"
                      />
                    ) : null}
                    Ver comprobante
                  </a>
                ) : null}
                <Link
                  href={`/admin/payments/${r.paymentId}`}
                  className="text-xs font-semibold text-cyan-700 underline"
                >
                  Ir al pago
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const session = await requireStaff();
  const { bookingId } = await params;
  const target = { bookingId, stayId: null };
  const canReviewPayments = canPerformAdminAction(session.role, "payment.review");
  const [
    { booking, items, property },
    events,
    declaration,
    idDocuments,
    companions,
    checkins,
    accessApproved,
    receipts,
  ] = await Promise.all([
    getBookingDetail(bookingId),
    listBookingEvents(bookingId),
    getDeclarationForBooking(bookingId),
    listIdDocuments({ kind: "booking", bookingId }),
    listBookingCompanions(bookingId),
    listCheckins(target),
    isAccessApproved(target),
    canReviewPayments ? listReceiptsForBooking(bookingId) : Promise.resolve([]),
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
          {canReviewPayments ? <ReceiptsPanel receipts={receipts} /> : null}
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
