import Link from "next/link";
import { listLatestReceipts, listPayments, type ReceiptSummary } from "@/lib/admin/payments";
import {
  AdminPageHeader,
  EmptyState,
  Money,
  Pager,
  Panel,
  StatusBadge,
} from "@/components/admin/ui";
// Misma etiqueta que el detalle del pago. Nunca se expone el modelo ni el prompt.
const AI_RESULT_LABEL: Record<number, string> = {
  1: "Sin confirmar",
  2: "Aprobado por IA",
  3: "Fuera de plazo",
  4: "Requiere revisión",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const p = await searchParams;
  const result = await listPayments({
    page: Math.max(1, Number(p.page) || 1),
    pageSize: 20,
    status: p.status,
  });
  const receipts = await listLatestReceipts(result.rows.map((x) => x.id));
  return (
    <>
      <AdminPageHeader
        title="Pagos"
        helpKey="payments.page"
        description="Revisión de pagos mock sin QR, idempotency key ni respuestas de proveedor."
      />
      <Panel>
        {result.rows.length ? (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="pb-3">Pago</th>
                  <th>Reserva</th>
                  <th>Proveedor</th>
                  <th>Estado</th>
                  <th>Monto</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((x) => (
                  <tr key={x.id} className="border-b">
                    <td className="py-3">
                      <Link
                        className="font-semibold text-cyan-700"
                        href={`/admin/payments/${x.id}`}
                      >
                        {x.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>{x.booking_id.slice(0, 8)}</td>
                    <td>{x.provider}</td>
                    <td>
                      <StatusBadge value={x.status} />
                    </td>
                    <td>
                      <Money amount={x.amount_minor} currency={x.currency} />
                    </td>
                    <td className="py-2">
                      <ReceiptCell receipt={receipts.get(x.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager {...result} basePath="/admin/payments" />
          </>
        ) : (
          <EmptyState
            title="Sin pagos"
            body="Los pagos aparecerán cuando una reserva llegue a la etapa de pago."
          />
        )}
      </Panel>
    </>
  );
}

// Miniatura del último comprobante: se ve desde el listado, sin aprobar nada. La URL
// es firmada y de corta duración (el bucket es privado).
function ReceiptCell({ receipt }: { receipt?: ReceiptSummary }) {
  if (!receipt?.url) return <span className="text-slate-400">—</span>;

  const label = receipt.aiStatus === "unavailable" ? "IA no disponible" : AI_RESULT_LABEL[receipt.aiResult ?? 4];

  return (
    <a
      href={receipt.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 font-semibold text-cyan-700"
    >
      {receipt.mimeType.startsWith("image/") ? (
        /* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Storage */
        <img
          src={receipt.url}
          alt="Comprobante"
          className="h-10 w-10 rounded border border-slate-200 object-cover"
        />
      ) : (
        <span className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">PDF</span>
      )}
      <span className="text-xs font-normal text-slate-600">{label}</span>
    </a>
  );
}
