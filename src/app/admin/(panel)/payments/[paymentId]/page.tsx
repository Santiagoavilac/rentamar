import Link from "next/link";
import {
  getPaymentDetail,
  listPaymentEvents,
  listPaymentReceipts,
} from "@/lib/admin/payments";
import { getReceiptConfirmMode } from "@/lib/settings";
import { paymentAction, setReceiptModeAction } from "@/lib/admin/actions";
import { AdminPageHeader, KeyValue, Money, Panel, StatusBadge } from "@/components/admin/ui";
import { ReasonActionForm, ReceiptModeForm } from "@/components/admin/forms";

// Etiqueta legible del resultado IA. Nunca se muestra el modelo ni el prompt.
const AI_RESULT_LABEL: Record<number, string> = {
  1: "1 · Sin confirmar (permite reintento)",
  2: "2 · Aprobado por IA",
  3: "3 · Fuera de plazo",
  4: "4 · Requiere revisión",
};

export default async function PaymentDetail({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const [{ payment, booking }, events, receipts, mode] = await Promise.all([
    getPaymentDetail(paymentId),
    listPaymentEvents(paymentId),
    listPaymentReceipts(paymentId),
    getReceiptConfirmMode(),
  ]);
  const canConfirm = payment.status === "ai_approved";
  const canReject = payment.status === "ai_approved" || payment.status === "manual_review";
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
            <KeyValue label="Monto esperado">
              <Money amount={payment.amount_minor} currency={payment.currency} />
            </KeyValue>
            <KeyValue label="Proveedor">
              {payment.provider} · {payment.provider_mode}
            </KeyValue>
            <KeyValue label="Reserva">{booking?.booking_code || "—"}</KeyValue>
            <KeyValue label="Cliente">{booking?.guest_name || "—"}</KeyValue>
            <KeyValue label="Fecha pago">{payment.paid_at || "—"}</KeyValue>
          </dl>
        </Panel>

        <Panel>
          <h2 className="font-bold">Comprobantes subidos</h2>
          {receipts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Sin comprobantes.</p>
          ) : (
            <ul className="mt-3 grid gap-4 text-sm">
              {receipts.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <strong>Intento {r.attemptNo}</strong>
                    <span className="text-slate-500">
                      {new Date(r.createdAt).toLocaleString("es-BO")}
                    </span>
                  </div>
                  <p className="mt-1">
                    Resultado IA:{" "}
                    {r.aiStatus === "unavailable"
                      ? "IA no disponible"
                      : AI_RESULT_LABEL[r.aiResult ?? 4] || "—"}
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500">SHA-256: {r.sha256}</p>
                  {r.url ? (
                    <a
                      className="mt-2 inline-block font-semibold text-cyan-700"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver comprobante
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel>
          <h2 className="font-bold">Operaciones</h2>
          <p className="mt-2 text-sm text-slate-600">
            Toda operación exige motivo y queda en auditoría.
          </p>
          {canConfirm ? (
            <ReasonActionForm
              action={paymentAction.bind(null, paymentId, "confirm")}
              label="Confirmar pago"
              confirm="Confirmo que verifiqué el comprobante."
            />
          ) : null}
          {canReject ? (
            <ReasonActionForm
              action={paymentAction.bind(null, paymentId, "reject")}
              label="Rechazar pago"
            />
          ) : null}
          <ReasonActionForm
            action={paymentAction.bind(null, paymentId, "annotate")}
            label="Registrar observación"
          />
          <h2 className="mt-6 font-bold">Modo de confirmación (A/B)</h2>
          <ReceiptModeForm action={setReceiptModeAction} current={mode} />
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
