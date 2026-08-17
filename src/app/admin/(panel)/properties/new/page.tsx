import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { PropertyForm } from "@/components/admin/forms";
import { createPropertyAction } from "@/lib/admin/actions";
import { requireStaff, canPerformAdminAction } from "@/lib/auth";
import { listTowerOptions } from "@/lib/admin/towers";

export default async function NewPropertyPage() {
  const session = await requireStaff();
  const towers = await listTowerOptions();
  return (
    <>
      <AdminPageHeader
        title="Nueva propiedad"
        helpKey="properties.new"
        description="Los campos se validan en servidor y el precio se guarda en centavos."
      />
      <Panel>
        <PropertyForm
          action={createPropertyAction}
          towers={towers}
          canManageAffiliates={canPerformAdminAction(session.role, "affiliate.manage")}
        />
      </Panel>
    </>
  );
}
