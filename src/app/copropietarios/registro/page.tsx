import type { Metadata } from "next";
import { requireCoOwner } from "@/lib/auth";
import { getCoOwnerAccount } from "@/lib/admin/co-owners";
import StayForm from "@/components/co-owner/stay-form";
import CoOwnerShell from "@/components/co-owner/page-shell";

export const metadata: Metadata = {
  title: "Registrar estadía | RentaMar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CoOwnerStayFormPage() {
  const session = await requireCoOwner();
  const account = await getCoOwnerAccount(session.userId);

  return (
    <CoOwnerShell title="Registrar estadía" subtitle={`Sesión de ${session.username}.`} back>
      <section className="surface rounded-2xl p-5">
        <StayForm
          propertyName={account.propertyName}
          roomCount={account.roomCount}
          maxGuests={account.maxGuests}
        />
      </section>
    </CoOwnerShell>
  );
}
