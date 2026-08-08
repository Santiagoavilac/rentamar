"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createAdminBookingAction,
  createBlockAction,
  releaseBlockAction,
  updateAdminBookingAction,
  updateBlockAction,
  type ActionResult,
} from "@/lib/admin/actions";
import type { PlannerEvent, PlannerProperty } from "@/lib/admin/availability";
import type { StaffRole } from "@/lib/permissions";

export type NewRecordDraft = {
  kind: "pre_reservation" | "rental" | "blocked";
  propertyId: string;
  from: string;
  to: string;
};

type AvailabilityEditorProps = {
  properties: PlannerProperty[];
  role: StaffRole;
  selected: PlannerEvent | null;
  draft: NewRecordDraft | null;
  onClose: () => void;
};

const initialState: ActionResult = { ok: false, error: null };

function localExpiration(value: string | null): string {
  const date = value ? new Date(value) : new Date(Date.now() + 86_400_000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-deep px-4 py-2 text-sm font-bold text-cream disabled:opacity-50"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

function ResultMessage({ state }: { state: ActionResult }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
        {state.error}
      </p>
    );
  if (!state.ok) return null;
  return (
    <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
      Registro guardado.
      {state.oneTimePaymentUrl ? (
        <div className="mt-2">
          <strong className="block">Enlace de pago, visible una sola vez:</strong>
          <a className="break-all font-semibold underline" href={state.oneTimePaymentUrl}>
            {state.oneTimePaymentUrl}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function PropertySelect({
  properties,
  defaultValue,
  disabled = false,
}: {
  properties: PlannerProperty[];
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      Propiedad
      <select
        name="propertyId"
        defaultValue={defaultValue}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 disabled:bg-slate-100"
      >
        {properties.map((property) => (
          <option key={property.id} value={property.id}>
            {property.name}
          </option>
        ))}
      </select>
      {disabled ? <input type="hidden" name="propertyId" value={defaultValue} /> : null}
    </label>
  );
}

function BlockFields({
  properties,
  propertyId,
  from,
  to,
  event,
  lockOccupancy = false,
}: {
  properties: PlannerProperty[];
  propertyId: string;
  from: string;
  to: string;
  event?: PlannerEvent;
  lockOccupancy?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <PropertySelect
          properties={properties}
          defaultValue={propertyId}
          disabled={lockOccupancy}
        />
      </div>
      <label className="text-sm font-medium text-slate-700">
        Desde
        <input
          required
          name="from"
          type="date"
          defaultValue={from}
          disabled={lockOccupancy}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-100"
        />
        {lockOccupancy ? <input type="hidden" name="from" value={from} /> : null}
      </label>
      <label className="text-sm font-medium text-slate-700">
        Hasta (salida)
        <input
          required
          name="to"
          type="date"
          defaultValue={to}
          disabled={lockOccupancy}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-100"
        />
        {lockOccupancy ? <input type="hidden" name="to" value={to} /> : null}
      </label>
      <label className="text-sm font-medium text-slate-700">
        Tipo
        <select
          name="type"
          defaultValue={event?.blockType ?? "manual"}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
        >
          {["maintenance", "internal_use", "owner_use", "operational", "manual", "other"].map(
            (value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ),
          )}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Motivo
        <input
          name="reason"
          maxLength={500}
          defaultValue={event?.reason ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
        />
      </label>
    </div>
  );
}

function BookingFields({
  properties,
  propertyId,
  from,
  to,
  event,
  lockOccupancy = false,
  includeExpiration = true,
  isAffiliate = false,
}: {
  properties: PlannerProperty[];
  propertyId: string;
  from: string;
  to: string;
  event?: PlannerEvent;
  lockOccupancy?: boolean;
  includeExpiration?: boolean;
  isAffiliate?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <PropertySelect
          properties={properties}
          defaultValue={propertyId}
          disabled={lockOccupancy}
        />
      </div>
      <label className="text-sm font-medium text-slate-700">
        Check-in
        <input
          required
          name="checkIn"
          type="date"
          defaultValue={from}
          disabled={lockOccupancy}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-100"
        />
        {lockOccupancy ? <input type="hidden" name="checkIn" value={from} /> : null}
      </label>
      <label className="text-sm font-medium text-slate-700">
        Check-out
        <input
          required
          name="checkOut"
          type="date"
          defaultValue={to}
          disabled={lockOccupancy}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-100"
        />
        {lockOccupancy ? <input type="hidden" name="checkOut" value={to} /> : null}
      </label>
      <label className="text-sm font-medium text-slate-700">
        Huéspedes
        <input
          required
          name="guestCount"
          type="number"
          min={1}
          max={50}
          defaultValue={event?.guestCount ?? 1}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Nombre del huésped
        <input
          required
          name="guestName"
          defaultValue={event?.guestName ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Email
        <input
          required={!isAffiliate}
          name="guestEmail"
          type="email"
          defaultValue={event?.guestEmail ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Teléfono
        <input
          name="guestPhone"
          defaultValue={event?.guestPhone ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
        />
      </label>
      {includeExpiration ? (
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Vencimiento
          <input
            required
            name="holdExpiresLocal"
            type="datetime-local"
            defaultValue={localExpiration(event?.holdExpiresAt ?? null)}
            className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
          />
        </label>
      ) : (
        <input type="hidden" name="holdExpiresLocal" value="" />
      )}
    </div>
  );
}

function RefreshOnSuccess({ state }: { state: ActionResult }) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);
  return null;
}

function CreateEditor({
  properties,
  role,
  draft,
}: {
  properties: PlannerProperty[];
  role: StaffRole;
  draft: NewRecordDraft;
}) {
  const action = draft.kind === "blocked" ? createBlockAction : createAdminBookingAction;
  const [state, formAction] = useActionState(action, initialState);
  const label =
    draft.kind === "pre_reservation"
      ? "Nueva pre-reserva"
      : draft.kind === "rental"
        ? "Nuevo alquiler"
        : "Nuevo bloqueo";
  return (
    <form action={formAction} className="grid gap-5">
      <RefreshOnSuccess state={state} />
      <h2 className="text-xl font-bold text-night">{label}</h2>
      {draft.kind === "blocked" ? (
        <BlockFields
          properties={properties}
          propertyId={draft.propertyId}
          from={draft.from}
          to={draft.to}
        />
      ) : (
        <>
          <input type="hidden" name="kind" value={draft.kind} />
          <BookingFields
            properties={properties}
            propertyId={draft.propertyId}
            from={draft.from}
            to={draft.to}
            includeExpiration={draft.kind === "pre_reservation"}
          />
          {draft.kind === "rental" ? (
            <>
              <label className="text-sm font-medium text-slate-700">
                Motivo de confirmación
                <textarea
                  required
                  minLength={4}
                  name="reason"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                />
              </label>
              <label className="flex gap-2 text-sm">
                <input required type="checkbox" name="confirmed" /> Confirmo que este alquiler debe
                quedar registrado como pagado.
              </label>
            </>
          ) : (
            <input type="hidden" name="reason" value="" />
          )}
        </>
      )}
      {draft.kind === "rental" && role !== "admin" ? (
        <p className="text-sm text-rose-700">
          Solo un administrador puede crear un alquiler confirmado.
        </p>
      ) : (
        <SubmitButton label="Guardar" />
      )}
      <ResultMessage state={state} />
    </form>
  );
}

function EditEditor({
  properties,
  role,
  event,
}: {
  properties: PlannerProperty[];
  role: StaffRole;
  event: PlannerEvent;
}) {
  const isBlock = event.entity === "block";
  const isAffiliate = event.channel === "affiliate";
  const updateAction = isBlock
    ? updateBlockAction.bind(null, event.id)
    : updateAdminBookingAction.bind(null, event.id);
  const [state, formAction] = useActionState(updateAction, initialState);
  const paidRecordLocked =
    !isBlock &&
    ["paid", "refund_required", "refunded"].includes(event.paymentStatus ?? "") &&
    role !== "admin";
  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-5">
        <RefreshOnSuccess state={state} />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">{event.title}</p>
          <h2 className="mt-1 text-xl font-bold text-night">Editar registro</h2>
        </div>
        {paidRecordLocked ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Solo un administrador puede editar una reserva pagada o con ajuste financiero pendiente.
          </p>
        ) : isBlock ? (
          <BlockFields
            properties={properties}
            propertyId={event.propertyId}
            from={event.from}
            to={event.to}
            event={event}
          />
        ) : (
          <BookingFields
            properties={properties}
            propertyId={event.propertyId}
            from={event.from}
            to={event.to}
            event={event}
            includeExpiration={event.holdStatus === "active" && !isAffiliate}
            isAffiliate={isAffiliate}
          />
        )}
        {isAffiliate ? (
          <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
            Solicitud de afiliado: el bloqueo vence recién en la fecha de salida.{" "}
            <a className="font-semibold underline" href={`/admin/affiliates/${event.id}`}>
              Ver solicitud
            </a>
          </p>
        ) : null}
        {!isBlock && !paidRecordLocked ? (
          <label className="text-sm font-medium text-slate-700">
            Motivo del cambio
            <textarea
              required
              minLength={4}
              name="reason"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
            />
          </label>
        ) : null}
        {!isBlock && event.paymentStatus === "paid" && role === "admin" ? (
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="confirmed" /> Confirmo la edición de fechas o propiedad si
            cambia la ocupación.
          </label>
        ) : null}
        {!paidRecordLocked ? <SubmitButton label="Guardar cambios" /> : null}
        <ResultMessage state={state} />
      </form>
      {isBlock ? <ReleaseBlockForm event={event} /> : null}
    </div>
  );
}

function ReleaseBlockForm({ event }: { event: PlannerEvent }) {
  const [state, action] = useActionState(releaseBlockAction.bind(null, event.id), initialState);
  return (
    <form action={action} className="border-t border-slate-200 pt-5">
      <RefreshOnSuccess state={state} />
      <label className="text-sm font-medium text-slate-700">
        Motivo para liberar
        <textarea
          required
          minLength={4}
          name="reason"
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
        />
      </label>
      <div className="mt-3">
        <SubmitButton label="Liberar fechas" />
      </div>
      <div className="mt-3">
        <ResultMessage state={state} />
      </div>
    </form>
  );
}

export function AvailabilityEditor({
  properties,
  role,
  selected,
  draft,
  onClose,
}: AvailabilityEditorProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!selected && !draft) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [draft, onClose, selected]);
  if (!selected && !draft) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/35"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Editor de disponibilidad"
        className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="mb-5 ml-auto block rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold"
        >
          Cerrar
        </button>
        {draft ? (
          <CreateEditor properties={properties} role={role} draft={draft} />
        ) : selected ? (
          <EditEditor properties={properties} role={role} event={selected} />
        ) : null}
      </aside>
    </div>
  );
}
