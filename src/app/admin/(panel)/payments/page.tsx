import Link from "next/link";
import { listPayments } from "@/lib/admin/payments";
import {
  AdminPageHeader,
  EmptyState,
  Money,
  Pager,
  Panel,
  StatusBadge,
} from "@/components/admin/ui";
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
  return (
    <>
      <AdminPageHeader
        title="Pagos"
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
