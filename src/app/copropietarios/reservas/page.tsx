import type { Metadata } from "next";
import { requireCoOwner } from "@/lib/auth";
import { getCoOwnerAccount, listCoOwnerBookings } from "@/lib/admin/co-owners";
import { Money, StatusBadge } from "@/components/admin/ui";
import CoOwnerShell from "@/components/co-owner/page-shell";

export const metadata: Metadata = {
  title: "Reservas de mi propiedad | RentaMar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Alquileres generados por RentaMar sobre el departamento del copropietario. Depende del
// vínculo `co_owner_accounts.property_id`, que asigna administración.
export default async function CoOwnerBookingsPage() {
  const session = await requireCoOwner();
  const account = await getCoOwnerAccount(session.userId);

  if (!account.propertyId) {
    return (
      <CoOwnerShell title="Reservas de mi propiedad" back>
        <p className="surface rounded-2xl p-5 text-sm text-slate-600">
          Todavía no hay una propiedad publicada vinculada a tu cuenta. Avisá a administración para
          que la asocie y vas a ver acá sus reservas.
        </p>
      </CoOwnerShell>
    );
  }

  const bookings = await listCoOwnerBookings(account.propertyId);

  return (
    <CoOwnerShell
      title="Reservas de mi propiedad"
      subtitle={
        bookings.length ? `${bookings.length} en ${account.propertyName}.` : account.propertyName
      }
      back
    >
      {bookings.length ? (
        <div className="grid gap-3">
          {bookings.map((booking) => (
            <article key={booking.id} className="surface rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-semibold">{booking.guest_name}</p>
                <StatusBadge value={booking.status} />
              </div>
              <p className="text-xs text-slate-500">Reserva {booking.booking_code}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Entrada</dt>
                  <dd>{formatDate(booking.check_in)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Salida</dt>
                  <dd>{formatDate(booking.check_out)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Huéspedes</dt>
                  <dd>
                    {booking.guests} · {booking.nights} {booking.nights === 1 ? "noche" : "noches"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Total</dt>
                  <dd className="font-semibold">
                    <Money amount={booking.total_minor} currency={booking.currency} />
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="surface rounded-2xl p-5 text-sm text-slate-600">
          Todavía no hay reservas para {account.propertyName}.
        </p>
      )}
    </CoOwnerShell>
  );
}

// check_in y check_out son `date` sin hora: se parten a mano para no correr un día por
// zona horaria, igual que en la página pública de propiedades.
function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
