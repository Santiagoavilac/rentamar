import Link from "next/link";
import { getBookingDetail, listBookingEvents } from "@/lib/admin/bookings";
import { bookingAction } from "@/lib/admin/actions";
import { AdminPageHeader, KeyValue, Money, Panel, StatusBadge } from "@/components/admin/ui";
import { PanelHeading } from "@/components/admin/help";
import { ReasonActionForm } from "@/components/admin/forms";
export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const [{ booking, items, property }, events] = await Promise.all([
    getBookingDetail(bookingId),
    listBookingEvents(bookingId),
  ]);
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
            <PanelHeading helpKey="bookings.detail.history">Historial</PanelHeading>
            <ul className="mt-3 grid gap-3 text-sm">
              {events.map((e) => (
                <li key={e.id}>
                  <strong>{e.event_type}</strong>
                  <span className="block text-slate-500">
                    {e.reason || "Sin motivo"} · {new Date(e.created_at).toLocaleString("es-BO")}
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
