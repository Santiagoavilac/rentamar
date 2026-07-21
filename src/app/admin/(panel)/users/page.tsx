import { getStaffSession } from "@/lib/auth";
import { listStaff } from "@/lib/admin/users";
import { createUserAction } from "@/lib/admin/actions";
import { AdminPageHeader, EmptyState, Panel, StatusBadge } from "@/components/admin/ui";
import { UserForm } from "@/components/admin/forms";
export default async function UsersPage() {
  const session = await getStaffSession();
  if (session?.role !== "admin")
    return (
      <>
        <AdminPageHeader title="Acceso restringido" />
        <EmptyState
          title="403 · Solo administradores"
          body="La gestión de usuarios internos requiere rol administrador."
        />
      </>
    );
  const staff = await listStaff();
  return (
    <>
      <AdminPageHeader
        title="Usuarios internos"
        description="No hay auto-registro: cada cuenta se crea por un administrador."
      />
      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Panel>
          <h2 className="mb-4 font-bold">Crear usuario</h2>
          <UserForm action={createUserAction} />
        </Panel>
        <Panel>
          <h2 className="mb-4 font-bold">Staff</h2>
          {staff.length ? (
            <ul className="grid gap-3">
              {staff.map((u) => (
                <li key={u.id} className="flex items-center justify-between border-b pb-3">
                  <span>
                    <strong className="block text-sm">{u.full_name || u.email}</strong>
                    <small className="text-slate-500">{u.email}</small>
                  </span>
                  <StatusBadge value={u.role} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">
              Aún no hay usuarios internos. Creá el primer administrador mediante el script
              documentado.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
