"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/admin/actions";
import { formatCurrency } from "@/lib/money";

type FormAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;
const initial: ActionResult = { ok: false, error: null };

export function Submit({ label = "Guardar" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50"
      disabled={pending}
    >
      {pending ? "Guardando…" : label}
    </button>
  );
}
function Feedback({ error, ok }: ActionResult) {
  return error ? (
    <p role="alert" className="mt-3 text-sm text-rose-700">
      {error}
    </p>
  ) : ok ? (
    <p role="status" className="mt-3 text-sm text-emerald-700">
      Cambios guardados.
    </p>
  ) : null;
}

export function BlockForm({ action, propertyId }: { action: FormAction; propertyId?: string }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="propertyId" value={propertyId ?? ""} />
      <label className="text-sm">
        Desde
        <input required type="date" name="from" className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="text-sm">
        Hasta
        <input required type="date" name="to" className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="text-sm">
        Tipo
        <select name="type" className="mt-1 w-full rounded border p-2">
          {["maintenance", "internal_use", "owner_use", "operational", "manual", "other"].map(
            (v) => (
              <option key={v}>{v}</option>
            ),
          )}
        </select>
      </label>
      <label className="text-sm">
        Motivo
        <input name="reason" className="mt-1 w-full rounded border p-2" maxLength={500} />
      </label>
      <div className="md:col-span-2">
        <Submit label="Bloquear fechas" />
        <Feedback {...state} />
      </div>
    </form>
  );
}

// Días en ISO (1 = lunes … 7 = domingo), igual que `extract(isodow)` en la RPC.
const WEEK_DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

export function WeekendPricingForm({
  action,
  days,
  surchargePercent,
  basePriceMinor,
}: {
  action: FormAction;
  days: number[];
  surchargePercent: number;
  basePriceMinor: number;
}) {
  const [state, formAction] = useActionState(action, initial);
  const [selected, setSelected] = useState<number[]>(days);
  const [percent, setPercent] = useState(String(surchargePercent));
  const parsedPercent = Math.max(0, Number(percent) || 0);
  const weekendMinor = Math.round(basePriceMinor * (1 + parsedPercent / 100));
  const active = parsedPercent > 0 && selected.length > 0;

  return (
    <form action={formAction} className="mt-3 grid gap-4">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">
          Días que se cobran como fin de semana
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEK_DAYS.map((day) => {
            const checked = selected.includes(day.value);
            return (
              <label
                key={day.value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  checked ? "border-cyan-600 bg-cyan-50 text-cyan-800" : "border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  name="days"
                  value={day.value}
                  checked={checked}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, day.value]
                        : current.filter((value) => value !== day.value),
                    )
                  }
                />
                {day.label}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Se cobra por noche: si alguien entra el viernes y sale el domingo, las noches son viernes y
          sábado.
        </p>
      </fieldset>

      <label className="max-w-56 text-sm font-semibold text-slate-700">
        Recargo sobre el precio base (%)
        <input
          required
          name="surchargePercent"
          inputMode="decimal"
          value={percent}
          onChange={(event) => setPercent(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          0 % desactiva el recargo.
        </span>
      </label>

      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        {active ? (
          <>
            Entre semana {formatCurrency(basePriceMinor)} por noche · Fin de semana{" "}
            <strong>{formatCurrency(weekendMinor)}</strong> por noche (
            {selected
              .slice()
              .sort((a, b) => a - b)
              .map((value) => WEEK_DAYS.find((day) => day.value === value)?.label)
              .join(", ")}
            ).
          </>
        ) : (
          <>Sin recargo: todas las noches se cobran {formatCurrency(basePriceMinor)}.</>
        )}
      </p>

      <div>
        <Submit label="Guardar recargo" />
        <Feedback {...state} />
      </div>
    </form>
  );
}

export function ReasonActionForm({
  action,
  label,
  confirm,
}: {
  action: FormAction;
  label: string;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="mt-3 rounded-lg border border-slate-200 p-3">
      <label className="block text-sm font-medium">
        Motivo
        <textarea required name="reason" minLength={4} className="mt-1 w-full rounded border p-2" />
      </label>
      {confirm ? (
        <label className="mt-2 flex gap-2 text-sm">
          <input required type="checkbox" name="confirmed" /> {confirm}
        </label>
      ) : null}
      <div className="mt-3">
        <Submit label={label} />
        <Feedback {...state} />
      </div>
    </form>
  );
}

export function ReceiptModeForm({
  action,
  current,
}: {
  action: FormAction;
  current: "admin" | "auto";
}) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="mt-3 grid gap-3">
      <label className="block text-sm font-medium">
        Modo de confirmación
        <select name="mode" defaultValue={current} className="mt-1 w-full rounded border p-2">
          <option value="admin">Modo B — la IA aprueba, un humano confirma</option>
          <option value="auto">Modo A — la IA aprueba y confirma sola</option>
        </select>
      </label>
      <div>
        <Submit label="Guardar modo" />
        <Feedback {...state} />
      </div>
    </form>
  );
}

export function UserForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <label className="text-sm">
        Nombre
        <input required name="fullName" className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="text-sm">
        Email
        <input required name="email" type="email" className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="text-sm">
        Contraseña
        <input
          required
          name="password"
          type="password"
          minLength={10}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Rol
        <select name="role" className="mt-1 w-full rounded border p-2">
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="text-sm">
        Teléfono
        <input name="phone" className="mt-1 w-full rounded border p-2" />
      </label>
      <div className="self-end">
        <Submit label="Crear usuario" />
        <Feedback {...state} />
      </div>
    </form>
  );
}

type PropertyValues = Record<string, string | number | boolean | null | undefined>;
export function PropertyForm({
  action,
  values = {},
  towers = [],
  canManageAffiliates = false,
}: {
  action: FormAction;
  values?: PropertyValues;
  towers?: { id: string; name: string; is_active: boolean }[];
  canManageAffiliates?: boolean;
}) {
  const [state, formAction] = useActionState(action, initial);
  const v = (key: string, fallback: string | number = "") => String(values[key] ?? fallback);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <label className="text-sm">
        Nombre
        <input
          required
          name="name"
          defaultValue={v("name")}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Slug
        <input
          required
          name="slug"
          defaultValue={v("slug")}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Zona
        <input name="zone" defaultValue={v("zone")} className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="text-sm">
        Tipo
        <input
          name="propertyType"
          defaultValue={v("property_type")}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Torre
        <select
          name="towerId"
          defaultValue={v("tower_id")}
          className="mt-1 w-full rounded border p-2"
        >
          <option value="">Sin torre</option>
          {towers.map((tower) => (
            <option key={tower.id} value={tower.id}>
              {tower.name}
              {tower.is_active ? "" : " (inactiva)"}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Estado
        <select
          name="status"
          defaultValue={v("status", "draft")}
          className="mt-1 w-full rounded border p-2"
        >
          {["draft", "published", "paused", "archived"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Precio base (BOB)
        <input
          required
          name="basePrice"
          inputMode="decimal"
          defaultValue={
            v("base_price_minor") === ""
              ? "0.00"
              : (Number(values.base_price_minor ?? 0) / 100).toFixed(2)
          }
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      {canManageAffiliates ? (
        <label className="text-sm">
          Precio de la reserva para afiliados (BOB)
          <input
            name="affiliatePrice"
            inputMode="decimal"
            defaultValue={
              values.affiliate_nightly_price_minor == null
                ? ""
                : (Number(values.affiliate_nightly_price_minor) / 100).toFixed(2)
            }
            className="mt-1 w-full rounded border p-2"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Dejalo vacío si esta propiedad todavía no tiene precio para afiliados.
          </span>
        </label>
      ) : null}
      <label className="text-sm">
        Dormitorios
        <input
          required
          type="number"
          name="bedrooms"
          min="0"
          defaultValue={v("bedrooms", 0)}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Baños
        <input
          required
          type="number"
          name="bathrooms"
          min="0"
          defaultValue={v("bathrooms", 0)}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Camas
        <input
          required
          type="number"
          name="beds"
          min="0"
          defaultValue={v("beds", 0)}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Máx. huéspedes
        <input
          required
          type="number"
          name="maxGuests"
          min="1"
          defaultValue={v("max_guests", 1)}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Mínimo noches
        <input
          required
          type="number"
          name="minimumNights"
          min="1"
          defaultValue={v("minimum_nights", 1)}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Check-in
        <input
          required
          type="time"
          name="checkInTime"
          defaultValue={v("check_in_time", "15:00").slice(0, 5)}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Check-out
        <input
          required
          type="time"
          name="checkOutTime"
          defaultValue={v("check_out_time", "11:00").slice(0, 5)}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="featured" defaultChecked={Boolean(values.featured)} />{" "}
        Destacada
      </label>
      <label className="text-sm md:col-span-2">
        Resumen
        <input
          name="shortDescription"
          defaultValue={v("short_description")}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm md:col-span-2">
        Descripción
        <textarea
          name="description"
          defaultValue={v("description")}
          className="mt-1 min-h-28 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm md:col-span-2">
        Reglas y condiciones
        <textarea
          name="rules"
          defaultValue={v("rules")}
          className="mt-1 min-h-24 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm md:col-span-2">
        Referencia de ubicación en Mar Adentro
        <textarea
          name="locationReference"
          defaultValue={v("location_reference")}
          className="mt-1 min-h-20 w-full rounded border p-2"
        />
      </label>
      <div className="md:col-span-2">
        <Submit />
        <Feedback {...state} />
      </div>
    </form>
  );
}

export function ImageUploadForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-3">
      <label className="text-sm">
        Imagen JPG, PNG o WebP (máximo 8 MB)
        <input
          required
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-1 block w-full text-sm"
        />
      </label>
      <label className="text-sm">
        Texto alternativo
        <input name="altText" className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="flex gap-2 text-sm">
        <input name="isCover" type="checkbox" /> Usar como portada
      </label>
      <div>
        <Submit label="Subir imagen" />
        <Feedback {...state} />
      </div>
    </form>
  );
}

export function RateForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        Desde
        <input required type="date" name="startDate" className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="text-sm">
        Hasta
        <input required type="date" name="endDate" className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="text-sm">
        Precio por noche (BOB)
        <input
          required
          name="price"
          inputMode="decimal"
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Mínimo noches
        <input
          name="minimumNights"
          type="number"
          min="1"
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Etiqueta
        <input name="label" className="mt-1 w-full rounded border p-2" />
      </label>
      <div className="sm:col-span-2">
        <Submit label="Crear tarifa" />
        <Feedback {...state} />
      </div>
    </form>
  );
}
