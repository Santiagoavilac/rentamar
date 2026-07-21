"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff, requireAdmin, assertAdminAction, type AdminAction } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildAuditContext, assertSameOrigin } from "./context";
import * as properties from "./properties";
import * as rates from "./rates";
import * as availability from "./availability";
import * as bookings from "./bookings";
import * as users from "./users";
import {
  propertyInputSchema,
  rateInputSchema,
  availabilityBlockInputSchema,
  changeRoleInputSchema,
  createUserInputSchema,
  reasonSchema,
  imageMetaSchema,
} from "@/lib/validation";

export type ActionResult = { ok: boolean; error: string | null; id?: string };

const OK: ActionResult = { ok: true, error: null };

// Convierte cualquier excepción en un mensaje seguro para la UI (sin internals).
function fail(error: unknown): ActionResult {
  if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
    return { ok: false, error: "Solicitud rechazada (origen inválido)." };
  }
  console.error("[admin-action]", error instanceof Error ? error.message : "unknown");
  return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
}

// Fuente de verdad del actor para eventos de dominio: admin o operator.
function eventSource(role: "admin" | "operator"): "admin" | "operator" {
  return role;
}

function num(v: FormDataEntryValue | null): number {
  return Number(v ?? 0);
}
function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}
function bool(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true";
}

// ---------- Propiedades ----------

function parsePropertyForm(formData: FormData) {
  return propertyInputSchema.parse({
    name: str(formData.get("name")),
    slug: str(formData.get("slug")),
    shortDescription: str(formData.get("shortDescription")),
    description: str(formData.get("description")),
    propertyType: str(formData.get("propertyType")),
    zone: str(formData.get("zone")),
    status: str(formData.get("status")),
    featured: bool(formData.get("featured")),
    basePrice: str(formData.get("basePrice")),
    bedrooms: num(formData.get("bedrooms")),
    bathrooms: num(formData.get("bathrooms")),
    beds: num(formData.get("beds")),
    maxGuests: num(formData.get("maxGuests")),
    minimumNights: num(formData.get("minimumNights")),
    checkInTime: str(formData.get("checkInTime")),
    checkOutTime: str(formData.get("checkOutTime")),
  });
}

export async function createPropertyAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let newId: string | null = null;
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    const input = parsePropertyForm(formData);
    const { id } = await properties.createProperty(input);
    newId = id;
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "property.create",
      entityType: "property",
      entityId: id,
      after: input,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/properties");
  redirect(`/admin/properties/${newId}`);
}

export async function updatePropertyAction(
  propertyId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    const input = parsePropertyForm(formData);
    const { before, after } = await properties.updateProperty(propertyId, input);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "property.update",
      entityType: "property",
      entityId: propertyId,
      before,
      after,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/properties/${propertyId}`);
  return OK;
}

export async function setPropertyAmenitiesAction(
  propertyId: string,
  amenityIds: string[],
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    await properties.setPropertyAmenities(propertyId, amenityIds);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "property.amenities",
      entityType: "property",
      entityId: propertyId,
      after: { amenityIds },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/properties/${propertyId}`);
  return OK;
}

export async function addPropertyImageAction(
  propertyId: string,
  params: { url: string; altText: string; isCover: boolean },
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    const meta = imageMetaSchema.parse({ altText: params.altText, isCover: params.isCover });
    await properties.addPropertyImage({
      propertyId,
      url: params.url,
      altText: meta.altText || null,
      isCover: Boolean(meta.isCover),
    });
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "property.image.add",
      entityType: "property",
      entityId: propertyId,
      after: { url: params.url, isCover: params.isCover },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/properties/${propertyId}`);
  return OK;
}

export async function setCoverImageAction(
  propertyId: string,
  imageId: string,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    await properties.setCoverImage(propertyId, imageId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "property.image.cover",
      entityType: "property",
      entityId: propertyId,
      after: { imageId },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/properties/${propertyId}`);
  return OK;
}

export async function deletePropertyImageAction(
  propertyId: string,
  imageId: string,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    await properties.deletePropertyImage(propertyId, imageId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "property.image.delete",
      entityType: "property",
      entityId: propertyId,
      before: { imageId },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/properties/${propertyId}`);
  return OK;
}

// ---------- Tarifas / precios ----------

function parseRateForm(formData: FormData) {
  const minNightsRaw = str(formData.get("minimumNights"));
  return rateInputSchema.parse({
    startDate: str(formData.get("startDate")),
    endDate: str(formData.get("endDate")),
    price: str(formData.get("price")),
    minimumNights: minNightsRaw ? Number(minNightsRaw) : null,
    label: str(formData.get("label")),
  });
}

export async function createRateAction(
  propertyId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "rate.manage");
    const input = parseRateForm(formData);
    const res = await rates.createRate(propertyId, input, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "rate.create",
      entityType: "property_rate",
      entityId: res.rateId,
      after: input,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/admin/pricing");
  return OK;
}

export async function updateRateAction(
  propertyId: string,
  rateId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "rate.manage");
    const input = parseRateForm(formData);
    await rates.updateRate(rateId, input, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "rate.update",
      entityType: "property_rate",
      entityId: rateId,
      after: input,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/properties/${propertyId}`);
  return OK;
}

export async function removeRateAction(propertyId: string, rateId: string): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "rate.manage");
    await rates.removeRate(rateId, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "rate.remove",
      entityType: "property_rate",
      entityId: rateId,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/properties/${propertyId}`);
  return OK;
}

export async function changeBasePriceAction(
  propertyId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "rate.manage");
    const price = str(formData.get("basePrice"));
    const reason = reasonSchema.parse(str(formData.get("reason")));
    await rates.changeBasePrice(propertyId, price, reason, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "property.base_price",
      entityType: "property",
      entityId: propertyId,
      after: { price },
      reason,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/properties/${propertyId}`);
  return OK;
}

// ---------- Disponibilidad ----------

export async function createBlockAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let propertyId = "";
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "availability.manage");
    const input = availabilityBlockInputSchema.parse({
      propertyId: str(formData.get("propertyId")),
      from: str(formData.get("from")),
      to: str(formData.get("to")),
      type: str(formData.get("type")),
      reason: str(formData.get("reason")),
    });
    propertyId = input.propertyId;
    const res = await availability.createBlock(input, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "availability.block",
      entityType: "availability_block",
      entityId: res.blockId,
      after: input,
      reason: input.reason || null,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/calendar");
  if (propertyId) revalidatePath(`/admin/properties/${propertyId}`);
  return OK;
}

export async function releaseBlockAction(
  blockId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "availability.manage");
    const reason = reasonSchema.parse(str(formData.get("reason")));
    await availability.releaseBlock(blockId, reason, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "availability.release",
      entityType: "availability_block",
      entityId: blockId,
      reason,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/calendar");
  return OK;
}

// ---------- Reservas ----------

type BookingOp = "cancel" | "expire" | "manual_review" | "confirm_manual";

export async function bookingAction(
  bookingId: string,
  op: BookingOp,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();

    const permission: Record<BookingOp, AdminAction> = {
      cancel: "booking.cancel",
      expire: "booking.review",
      manual_review: "booking.manual_review",
      confirm_manual: "booking.confirm_manual",
    };
    assertAdminAction(session.role, permission[op]);

    // confirm_manual es una operación crítica: exige doble confirmación en la UI.
    const reason = reasonSchema.parse(str(formData.get("reason")));
    const src = eventSource(session.role);

    let result: { ok: boolean; status: string; refundRequired?: boolean };
    if (op === "cancel") result = await bookings.cancelBooking(bookingId, reason, session.userId, src);
    else if (op === "expire") result = await bookings.expireBooking(bookingId, reason, session.userId, src);
    else if (op === "manual_review")
      result = await bookings.markManualReview(bookingId, reason, session.userId, src);
    else result = await bookings.confirmManual(bookingId, reason, session.userId, src);

    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: `booking.${op}`,
      entityType: "booking",
      entityId: bookingId,
      after: { status: result.status, refundRequired: result.refundRequired ?? false },
      reason,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  return OK;
}

// ---------- Usuarios (solo admin) ----------

export async function createUserAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    await assertSameOrigin();
    assertAdminAction(session.role, "user.manage");
    const input = createUserInputSchema.parse({
      email: str(formData.get("email")),
      password: str(formData.get("password")),
      fullName: str(formData.get("fullName")),
      role: str(formData.get("role")),
      phone: str(formData.get("phone")),
    });
    const { userId } = await users.createStaffUser(input, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "user.create",
      entityType: "user",
      entityId: userId,
      after: { email: input.email, role: input.role, fullName: input.fullName },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/users");
  return OK;
}

export async function changeRoleAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    await assertSameOrigin();
    assertAdminAction(session.role, "role.change");
    const input = changeRoleInputSchema.parse({
      userId: str(formData.get("userId")),
      role: str(formData.get("role")),
      reason: str(formData.get("reason")),
    });
    const res = await users.changeUserRole(input.userId, input.role, input.reason, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "user.role_change",
      entityType: "user",
      entityId: input.userId,
      before: { role: res.oldRole },
      after: { role: res.role },
      reason: input.reason,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/users");
  return OK;
}
