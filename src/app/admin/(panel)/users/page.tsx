import Link from "next/link";
import { getStaffSession } from "@/lib/auth";
import { listStaff } from "@/lib/admin/users";
import { createUserAction } from "@/lib/admin/actions";
import { listCoOwnerAccounts } from "@/lib/admin/co-owners";
import { listCleanerAccounts } from "@/lib/admin/cleaners";
import {
  createCoOwnerAccountAction,
  deleteCoOwnerAccountAction,
  setCoOwnerActiveAction,
  setCoOwnerPasswordAction,
} from "@/lib/admin/co-owner-actions";
import {
  createCleanerAccountAction,
  deleteCleanerAccountAction,
  setCleanerActiveAction,
  setCleanerPasswordAction,
} from "@/lib/admin/cleaner-actions";
import { AdminPageHeader, EmptyState, Panel, StatusBadge } from "@/components/admin/ui";
import { UserForm } from "@/components/admin/forms";
import {
  ChangePasswordForm,
  CreateCleanerForm,
  CreateCoOwnerForm,
  DeleteAccountForm,
  ToggleActiveForm,
} from "@/components/admin/account-forms";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "staff", label: "Staff" },
  { key: "copropietarios", label: "Copropietarios" },
  { key: "limpieza", label: "Limpieza" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// Cada pestaña es un enlace, no estado de cliente: la página carga solo los datos de la
// pestaña activa y el navegador conserva la posición en el historial.
function Tabs({ active }: { active: TabKey }) {
  return (
    <nav className="mb-5 flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/admin/users?tab=${tab.key}`}
          aria-current={tab.key === active ? "page" : undefined}
          className={
            tab.key === active
              ? "rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream"
              : "rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function CreatePanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Panel>
      <details>
        <summary className="cursor-pointer text-lg font-semibold">{label}</summary>
        <div className="mt-4">{children}</div>
      </details>
    </Panel>
  );
}

// Contraseña, activación y baja: los tres módulos comparten los mismos controles. La
// contraseña va plegada para que la fila no crezca.
function AccountActions({
  accountId,
  isActive,
  passwordAction,
  activeAction,
  deleteAction,
}: {
  accountId: string;
  isActive: boolean;
  passwordAction: typeof setCoOwnerPasswordAction;
  activeAction: typeof setCoOwnerActiveAction;
  deleteAction: typeof deleteCoOwnerAccountAction;
}) {
  return (
    <div className="grid justify-items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <ToggleActiveForm action={activeAction} accountId={accountId} isActive={isActive} />
        <DeleteAccountForm action={deleteAction} accountId={accountId} />
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-slate-500">Cambiar contraseña</summary>
        <div className="mt-2">
          <ChangePasswordForm action={passwordAction} accountId={accountId} />
        </div>
      </details>
    </div>
  );
}

const th = "py-2";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
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

  const p = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === p.tab) ? (p.tab as TabKey) : "staff";

  return (
    <>
      <AdminPageHeader
        title="Usuarios"
        description="No hay auto-registro: cada cuenta se crea acá por un administrador."
      />
      <Tabs active={tab} />

      {tab === "staff" ? <StaffTab /> : null}
      {tab === "copropietarios" ? <CoOwnersTab /> : null}
      {tab === "limpieza" ? <CleanersTab /> : null}
    </>
  );
}

async function StaffTab() {
  const staff = await listStaff();
  return (
    <div className="grid gap-5">
      <CreatePanel label="Crear usuario interno">
        <UserForm action={createUserAction} />
      </CreatePanel>

      <Panel>
        {staff.length === 0 ? (
          <EmptyState
            title="Todavía no hay usuarios internos"
            body="Creá el primer administrador mediante el script documentado."
          />
        ) : (
          <ul className="grid gap-3">
            {staff.map((user) => (
              <li key={user.id} className="flex items-center justify-between border-b pb-3">
                <span>
                  <strong className="block text-sm">{user.full_name || user.email}</strong>
                  <small className="text-slate-500">{user.email}</small>
                </span>
                <StatusBadge value={user.role} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

async function CoOwnersTab() {
  const accounts = await listCoOwnerAccounts();
  return (
    <div className="grid gap-5">
      <CreatePanel label="Crear copropietario">
        <p className="mb-4 text-sm text-slate-600">
          Usuario, contraseña, propiedad y habitaciones en un solo paso. El copropietario entra en
          /copropietarios y solo registra estadías: no es staff ni ve el panel.
        </p>
        <CreateCoOwnerForm action={createCoOwnerAccountAction} />
      </CreatePanel>

      <Panel>
        {accounts.length === 0 ? (
          <EmptyState
            title="Todavía no hay copropietarios"
            body="Creá la primera cuenta con su propiedad y cantidad de habitaciones."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className={th}>Usuario</th>
                  <th className={th}>Propiedad</th>
                  <th className={th}>Habitaciones</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-t border-slate-200 align-top">
                    <td className="py-3 font-medium">{account.username}</td>
                    <td className="py-3">{account.propertyName}</td>
                    <td className="py-3">{account.roomCount}</td>
                    <td className="py-3">
                      <StatusBadge value={account.isActive ? "active" : "cancelada"} />
                    </td>
                    <td className="py-3">
                      <AccountActions
                        accountId={account.id}
                        isActive={account.isActive}
                        passwordAction={setCoOwnerPasswordAction}
                        activeAction={setCoOwnerActiveAction}
                        deleteAction={deleteCoOwnerAccountAction}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

async function CleanersTab() {
  const accounts = await listCleanerAccounts();
  return (
    <div className="grid gap-5">
      <CreatePanel label="Crear cuenta de limpieza">
        <p className="mb-4 text-sm text-slate-600">
          La persona entra en /limpieza y reporta ella misma qué departamento limpió, qué día y a
          qué hora entró y salió. Nadie le asigna turnos.
        </p>
        <CreateCleanerForm action={createCleanerAccountAction} />
      </CreatePanel>

      <Panel>
        {accounts.length === 0 ? (
          <EmptyState
            title="Todavía no hay personal de limpieza"
            body="Creá la primera cuenta con su nombre, usuario y contraseña."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className={th}>Persona</th>
                  <th className={th}>Usuario</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-t border-slate-200 align-top">
                    <td className="py-3 font-medium">{account.fullName}</td>
                    <td className="py-3">{account.username}</td>
                    <td className="py-3">
                      <StatusBadge value={account.isActive ? "active" : "cancelada"} />
                    </td>
                    <td className="py-3">
                      <AccountActions
                        accountId={account.id}
                        isActive={account.isActive}
                        passwordAction={setCleanerPasswordAction}
                        activeAction={setCleanerActiveAction}
                        deleteAction={deleteCleanerAccountAction}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
