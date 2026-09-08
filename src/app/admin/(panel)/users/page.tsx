import Link from "next/link";
import { getStaffSession } from "@/lib/auth";
import { listStaff } from "@/lib/admin/users";
import { createUserAction } from "@/lib/admin/actions";
import { listCoOwnerAccounts } from "@/lib/admin/co-owners";
import { listProperties } from "@/lib/admin/properties";
import { listCleanerAccounts } from "@/lib/admin/cleaners";
import { listGuardAccounts } from "@/lib/admin/guards";
import {
  createCoOwnerAccountAction,
  deleteCoOwnerAccountAction,
  setCoOwnerActiveAction,
  setCoOwnerPasswordAction,
  updateCoOwnerAccountAction,
} from "@/lib/admin/co-owner-actions";
import {
  createCleanerAccountAction,
  deleteCleanerAccountAction,
  setCleanerActiveAction,
  setCleanerPasswordAction,
} from "@/lib/admin/cleaner-actions";
import {
  createGuardAccountAction,
  deleteGuardAccountAction,
  setGuardActiveAction,
  setGuardPasswordAction,
} from "@/lib/admin/guard-actions";
import {
  AdminPageHeader,
  AdminResponsiveTable,
  EmptyState,
  Panel,
  StatusBadge,
} from "@/components/admin/ui";
import { UserForm } from "@/components/admin/forms";
import {
  ChangePasswordForm,
  CreateCleanerForm,
  CreateGuardForm,
  CreateCoOwnerForm,
  DeleteAccountForm,
  EditCoOwnerForm,
  ToggleActiveForm,
} from "@/components/admin/account-forms";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "staff", label: "Staff" },
  { key: "copropietarios", label: "Copropietarios" },
  { key: "limpieza", label: "Limpieza" },
  { key: "guardias", label: "Guardias" },
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
        helpKey="users.page"
        description="No hay auto-registro: cada cuenta se crea acá por un administrador."
      />
      <Tabs active={tab} />

      {tab === "staff" ? <StaffTab /> : null}
      {tab === "copropietarios" ? <CoOwnersTab /> : null}
      {tab === "limpieza" ? <CleanersTab /> : null}
      {tab === "guardias" ? <GuardsTab /> : null}
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
              <li
                key={user.id}
                className="flex flex-col items-start gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
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
  const [accounts, properties] = await Promise.all([
    listCoOwnerAccounts(),
    // Todas las propiedades del catálogo, para poder vincular la cuenta a la suya.
    listProperties({ page: 1, pageSize: 200 }),
  ]);
  const propertyOptions = properties.rows.map((property) => ({
    id: property.id,
    name: property.name,
  }));
  const propertyNameById = new Map(propertyOptions.map((p) => [p.id, p.name]));
  return (
    <div className="grid gap-5">
      <CreatePanel label="Crear copropietario">
        <p className="mb-4 text-sm text-slate-600">
          Usuario, contraseña, propiedad, habitaciones, teléfono y límite de huéspedes en un solo
          paso. El copropietario entra en /copropietarios y solo registra estadías: no es staff ni
          ve el panel.
        </p>
        <CreateCoOwnerForm action={createCoOwnerAccountAction} properties={propertyOptions} />
      </CreatePanel>

      <Panel>
        {accounts.length === 0 ? (
          <EmptyState
            title="Todavía no hay copropietarios"
            body="Creá la primera cuenta con su propiedad y cantidad de habitaciones."
          />
        ) : (
          <AdminResponsiveTable className="md:min-w-[980px]">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className={th}>Usuario</th>
                <th className={th}>Propiedad</th>
                <th className={th}>Habitaciones</th>
                <th className={th}>Teléfono</th>
                <th className={th}>Límite</th>
                <th className={th}>Vinculada a</th>
                <th className={th}>Estado</th>
                <th className={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-slate-200 align-top">
                  <td data-label="Usuario" className="py-3 font-medium">
                    {account.username}
                  </td>
                  <td data-label="Propiedad" className="py-3">
                    {account.propertyName}
                  </td>
                  <td data-label="Habitaciones" className="py-3">
                    {account.roomCount}
                  </td>
                  <td data-label="Teléfono" className="py-3">
                    {account.phone ?? "—"}
                  </td>
                  <td data-label="Límite" className="py-3">
                    {account.maxGuests}
                  </td>
                  <td data-label="Vinculada a" className="py-3">
                    {(account.propertyId && propertyNameById.get(account.propertyId)) ?? "—"}
                  </td>
                  <td data-label="Estado" className="py-3">
                    <StatusBadge value={account.isActive ? "active" : "cancelada"} />
                  </td>
                  <td data-label="Acciones" data-mobile-full="true" className="py-3">
                    <div className="grid gap-3">
                      <EditCoOwnerForm
                        action={updateCoOwnerAccountAction}
                        account={{
                          id: account.id,
                          propertyName: account.propertyName,
                          roomCount: account.roomCount,
                          phone: account.phone,
                          maxGuests: account.maxGuests,
                          propertyId: account.propertyId,
                        }}
                        properties={propertyOptions}
                      />
                      <AccountActions
                        accountId={account.id}
                        isActive={account.isActive}
                        passwordAction={setCoOwnerPasswordAction}
                        activeAction={setCoOwnerActiveAction}
                        deleteAction={deleteCoOwnerAccountAction}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminResponsiveTable>
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
          <AdminResponsiveTable className="md:min-w-[640px]">
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
                  <td data-label="Persona" className="py-3 font-medium">
                    {account.fullName}
                  </td>
                  <td data-label="Usuario" className="py-3">
                    {account.username}
                  </td>
                  <td data-label="Estado" className="py-3">
                    <StatusBadge value={account.isActive ? "active" : "cancelada"} />
                  </td>
                  <td data-label="Acciones" data-mobile-full="true" className="py-3">
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
          </AdminResponsiveTable>
        )}
      </Panel>
    </div>
  );
}

async function GuardsTab() {
  const accounts = await listGuardAccounts();
  return (
    <div className="grid gap-5">
      <CreatePanel label="Crear cuenta de guardia">
        <p className="mb-4 text-sm text-slate-600">
          El guardia entra en /guardias y solo consulta: ve quiénes están hoy en el condominio y si
          RentaMar ya los aprobó. No puede editar ni registrar nada.
        </p>
        <CreateGuardForm action={createGuardAccountAction} />
      </CreatePanel>

      <Panel>
        {accounts.length === 0 ? (
          <EmptyState
            title="Todavía no hay guardias"
            body="Creá la primera cuenta con su nombre, usuario y contraseña."
          />
        ) : (
          <AdminResponsiveTable className="md:min-w-[640px]">
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
                  <td data-label="Persona" className="py-3 font-medium">
                    {account.fullName}
                  </td>
                  <td data-label="Usuario" className="py-3">
                    {account.username}
                  </td>
                  <td data-label="Estado" className="py-3">
                    <StatusBadge value={account.isActive ? "active" : "cancelada"} />
                  </td>
                  <td data-label="Acciones" data-mobile-full="true" className="py-3">
                    <AccountActions
                      accountId={account.id}
                      isActive={account.isActive}
                      passwordAction={setGuardPasswordAction}
                      activeAction={setGuardActiveAction}
                      deleteAction={deleteGuardAccountAction}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminResponsiveTable>
        )}
      </Panel>
    </div>
  );
}
