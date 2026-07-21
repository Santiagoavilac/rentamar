import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { PropertyForm } from "@/components/admin/forms";
import { createPropertyAction } from "@/lib/admin/actions";
export default function NewPropertyPage() {
  return (
    <>
      <AdminPageHeader
        title="Nueva propiedad"
        description="Los campos se validan en servidor y el precio se guarda en centavos."
      />
      <Panel>
        <PropertyForm action={createPropertyAction} />
      </Panel>
    </>
  );
}
