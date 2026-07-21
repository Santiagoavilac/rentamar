import Link from "next/link";
import { getPaymentDetail, listPaymentEvents } from "@/lib/admin/payments";
import { AdminPageHeader, KeyValue, Money, Panel, StatusBadge } from "@/components/admin/ui";
export default async function PaymentDetail({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const [{ payment, booking }, events] = await Promise.all([
    getPaymentDetail(paymentId),
    listPaymentEvents(paymentId),
  ]);
  return (
    <>
      <AdminPageHeader
        title={`Pago ${payment.id.slice(0, 8)}`}
        action={
          <Link className="text-sm font-semibold text-cyan-700" href="/admin/payments">
            Volver
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <dl className="grid gap-4 sm:grid-cols-2">
            <KeyValue label="Estado">
              <StatusBadge value={payment.status} />
            </KeyValue>
            <KeyValue label="Monto">
              <Money amount={payment.amount_minor} currency={payment.currency} />
            </KeyValue>
            <KeyValue label="Proveedor">
              {payment.provider} · {payment.provider_mode}
            </KeyValue>
            <KeyValue label="Reserva">{booking?.booking_code || "—"}</KeyValue>
            <KeyValue label="Código externo">{payment.external_id || "—"}</KeyValue>
            <KeyValue label="Fecha pago">{payment.paid_at || "—"}</KeyValue>
          </dl>
        </Panel>
        <Panel>
          <h2 className="font-bold">Eventos del pago</h2>
          <ul className="mt-3 grid gap-3 text-sm">
            {events.map((e) => (
              <li key={e.id}>
                <strong>{e.event_type}</strong>
                <span className="block text-slate-500">
                  {e.old_status || "—"} → {e.new_status || "—"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
