import Link from "next/link";
import { AdminPageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { PropertyTowerForm, TowerActiveForm, TowerForm } from "@/components/admin/tower-forms";
import {
  assignPropertyTowerAction,
  createTowerAction,
  setTowerActiveAction,
  updateTowerAction,
} from "@/lib/admin/tower-actions";
import { listTowerAdminData } from "@/lib/admin/towers";

export default async function TowersPage() {
  const { towers, properties } = await listTowerAdminData();
  const options = towers.map(({ id, name, is_active }) => ({ id, name, is_active }));
  const unassigned = properties.filter((property) => !property.tower_id);

  return (
    <>
      <AdminPageHeader
        title="Torres"
        description="Gestioná las torres del complejo y asigná cada departamento a una torre o a ninguna. La ubicación se define por separado en el editor del mapa."
        action={
          <Link href="/admin/mapa" className="text-sm font-semibold text-cyan-700">
            Ubicar torres en el mapa
          </Link>
        }
      />

      <Panel>
        <h2 className="mb-4 font-bold">Nueva torre</h2>
        <TowerForm action={createTowerAction} />
      </Panel>

      <div className="mt-5 grid gap-5">
        {towers.map((tower) => {
          const assigned = properties.filter((property) => property.tower_id === tower.id);
          return (
            <Panel key={tower.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{tower.name}</h2>
                    <StatusBadge value={tower.is_active ? "active" : "inactive"} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {assigned.length} {assigned.length === 1 ? "departamento" : "departamentos"}
                  </p>
                </div>
                <TowerActiveForm
                  action={setTowerActiveAction.bind(null, tower.id, !tower.is_active)}
                  isActive={tower.is_active}
                />
              </div>

              <details>
                <summary className="cursor-pointer text-sm font-semibold text-cyan-700">
                  Editar datos de la torre
                </summary>
                <div className="mt-4">
                  <TowerForm action={updateTowerAction.bind(null, tower.id)} tower={tower} />
                </div>
              </details>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="font-semibold">Departamentos asignados</h3>
                {assigned.length ? (
                  <ul className="mt-3 grid gap-3">
                    {assigned.map((property) => (
                      <li
                        key={property.id}
                        className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div>
                          <Link
                            href={`/admin/properties/${property.id}`}
                            className="font-semibold text-cyan-700 hover:underline"
                          >
                            {property.name}
                          </Link>
                          <p className="text-xs text-slate-500">{property.status}</p>
                        </div>
                        <PropertyTowerForm
                          action={assignPropertyTowerAction.bind(null, property.id)}
                          towers={options}
                          currentTowerId={property.tower_id}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Sin departamentos asignados.</p>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel className="mt-5">
        <h2 className="font-bold">Propiedades sin torre ({unassigned.length})</h2>
        {unassigned.length ? (
          <ul className="mt-3 grid gap-3">
            {unassigned.map((property) => (
              <li
                key={property.id}
                className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <Link
                    href={`/admin/properties/${property.id}`}
                    className="font-semibold text-cyan-700 hover:underline"
                  >
                    {property.name}
                  </Link>
                  <p className="text-xs text-slate-500">{property.status}</p>
                </div>
                <PropertyTowerForm
                  action={assignPropertyTowerAction.bind(null, property.id)}
                  towers={options}
                  currentTowerId={null}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Todas las propiedades tienen torre.</p>
        )}
      </Panel>
    </>
  );
}
