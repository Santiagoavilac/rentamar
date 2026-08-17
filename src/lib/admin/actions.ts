"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import {
  requireStaff,
  requireAdmin,
  assertAdminAction,
  canPerformAdminAction,
  type AdminAction,
} from "@/lib/auth";
import { AppError, mapPostgresError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { setReceiptConfirmMode, setWeekendPricing } from "@/lib/settings";
import { buildAuditContext, assertSameOrigin } from "./context";
import * as properties from "./properties";
import * as rates from "./rates";
import * as availability from "./availability";
import * as bookings from "./bookings";
import * as users from "./users";
import {
  propertyInputSchema,
  rateInputSchema,
  propertyPricingInputSchema,
  availabilityBlockInputSchema,
  availabilityBlockUpdateSchema,
  adminBookingInputSchema,
  adminBookingUpdateSchema,
  bookingOpSchema,
  affiliateOpSchema,
  paymentOpSchema,
  receiptConfirmModeSchema,
  weekendPricingSchema,
  entityIdSchema,
  changeRoleInputSchema,
  createUserInputSchema,
  reasonSchema,
  imageMetaSchema,
} from "@/lib/validation";

export type ActionResult = {
  ok: boolean;
  error: string | null;
  id?: string;
  oneTimePaymentUrl?: string;
};

const OK: ActionResult = { ok: true, error: null };

// Convierte cualquier excepción en un mensaje seguro para la UI (sin internals).
function fail(error: unknown): ActionResult {
  if (error instanceof ZodError) {
    return { ok: false, error: "Revisá los datos ingresados." };
  }
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

function parsePropertyForm(formData: FormData, canManageAffiliates: boolean) {
  return propertyInputSchema.parse({
    name: str(formData.get("name")),
    slug: str(formData.get("slug")),
    shortDescription: str(formData.get("shortDescription")),
    description: str(formData.get("description")),
    rules: str(formData.get("rules")),
    locationReference: str(formData.get("locationReference")),
    propertyType: str(formData.get("propertyType")),
    zone: str(formData.get("zone")),
    towerId: str(formData.get("towerId")) || null,
    status: str(formData.get("status")),
    featured: bool(formData.get("featured")),
    basePrice: str(formData.get("basePrice")),
    // Sin el permiso el campo no se renderiza; se ignora lo que llegue por POST.
    affiliatePrice: canManageAffiliates ? str(formData.get("affiliatePrice")) : undefined,
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
    const input = parsePropertyForm(
      formData,
      canPerformAdminAction(session.role, "affiliate.manage"),
    );
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
    const input = parsePropertyForm(
      formData,
      canPerformAdminAction(session.role, "affiliate.manage"),
    );
    const { before, after } = await properties.updateProperty(propertyId, input, session.userId);
    const previousPrice = (before as { base_price_minor?: number }).base_price_minor;
    const nextPriceMinor = Math.round(Number(input.basePrice) * 100);
    if (previousPrice !== nextPriceMinor) {
      await rates.changeBasePrice(
        propertyId,
        input.basePrice,
        "Actualización de propiedad",
        session.userId,
      );
    }
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
  revalidatePath("/afiliados");
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

export async function uploadPropertyImageAction(
  propertyId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "property.manage");
    const file = formData.get("image");
    if (!(file instanceof File))
      throw new AppError("VALIDATION_ERROR", "Seleccioná una imagen", 422);
    const meta = imageMetaSchema.parse({
      altText: str(formData.get("altText")),
      isCover: bool(formData.get("isCover")),
    });
    const result = await properties.uploadPropertyImage({
      propertyId,
      file,
      altText: meta.altText || null,
      isCover: Boolean(meta.isCover),
    });
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "property.image.upload",
      entityType: "property",
      entityId: propertyId,
      after: { imageId: result.id, isCover: Boolean(meta.isCover) },
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

export async function savePropertyPricingAction(
  propertyId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "rate.manage");
    const rawPrices = JSON.parse(str(formData.get("pricesJson")) || "[]") as unknown;
    const input = propertyPricingInputSchema.parse({
      basePrice: str(formData.get("basePrice")),
      durationPricingEnabled: bool(formData.get("durationPricingEnabled")),
      prices: rawPrices,
      reason: str(formData.get("reason")),
    });
    await rates.savePropertyPricing(propertyId, input, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "property.pricing",
      entityType: "property",
      entityId: propertyId,
      after: {
        basePrice: input.basePrice,
        durationPricingEnabled: input.durationPricingEnabled,
        prices: input.prices,
      },
      reason: input.reason,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/pricing");
  revalidatePath(`/admin/properties/${propertyId}`);
  return OK;
}

// Recargo global de fin de semana: días marcados + %. Aplica a todas las propiedades
// sobre el precio base; las tarifas estacionales (y los feriados cargados como tal)
// siguen teniendo prioridad porque fijan el precio de la noche.
export async function setWeekendPricingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "rate.manage");
    const input = weekendPricingSchema.parse({
      days: formData.getAll("days").map((day) => Number(str(day))),
      surchargePercent: Number(str(formData.get("surchargePercent")) || "0"),
    });
    await setWeekendPricing(input);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "pricing.weekend",
      entityType: "setting",
      entityId: "weekend_pricing",
      after: input,
    });
  } catch (error) {
    return fail(error);
  }
  // El ajuste es global: se refresca el detalle de cualquier propiedad, no solo la abierta.
  revalidatePath("/admin/properties/[propertyId]", "page");
  revalidatePath("/admin/pricing");
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
    const validatedBlockId = entityIdSchema.parse(blockId);
    const reason = reasonSchema.parse(str(formData.get("reason")));
    await availability.releaseBlock(validatedBlockId, reason, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "availability.release",
      entityType: "availability_block",
      entityId: validatedBlockId,
      reason,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/calendar");
  return OK;
}

export async function updateBlockAction(
  blockId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "availability.manage");
    const input = availabilityBlockUpdateSchema.parse({
      blockId,
      propertyId: str(formData.get("propertyId")),
      from: str(formData.get("from")),
      to: str(formData.get("to")),
      type: str(formData.get("type")),
      reason: str(formData.get("reason")),
    });
    await availability.updateBlock(input, session.userId);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "availability.update",
      entityType: "availability_block",
      entityId: blockId,
      after: input,
      reason: input.reason || null,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/calendar");
  return OK;
}

// ---------- Reservas ----------

function parseAdminBookingForm(formData: FormData) {
  return adminBookingInputSchema.parse({
    propertyId: str(formData.get("propertyId")),
    checkIn: str(formData.get("checkIn")),
    checkOut: str(formData.get("checkOut")),
    guestCount: num(formData.get("guestCount")),
    guestName: str(formData.get("guestName")),
    guestEmail: str(formData.get("guestEmail")),
    guestPhone: str(formData.get("guestPhone")),
    kind: str(formData.get("kind")),
    holdExpiresLocal: str(formData.get("holdExpiresLocal")),
    reason: str(formData.get("reason")),
  });
}

export async function createAdminBookingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    const input = parseAdminBookingForm(formData);
    if (input.kind === "rental") {
      assertAdminAction(session.role, "booking.confirm_manual");
      if (!bool(formData.get("confirmed"))) {
        throw new AppError("VALIDATION_ERROR", "Confirmá la creación del alquiler", 422);
      }
    } else {
      assertAdminAction(session.role, "booking.create");
    }
    const result = await availability.createAdminBooking(
      input,
      session.userId,
      eventSource(session.role),
    );
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: input.kind === "rental" ? "booking.create_rental" : "booking.create_hold",
      entityType: "booking",
      entityId: result.bookingId,
      after: input,
      reason: input.reason || null,
    });
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/bookings");
    return {
      ok: true,
      error: null,
      id: result.bookingId,
      oneTimePaymentUrl: result.accessToken
        ? `/pago/${result.bookingId}?token=${encodeURIComponent(result.accessToken)}`
        : undefined,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function updateAdminBookingAction(
  bookingId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    const input = adminBookingUpdateSchema.parse({
      bookingId,
      propertyId: str(formData.get("propertyId")),
      checkIn: str(formData.get("checkIn")),
      checkOut: str(formData.get("checkOut")),
      guestCount: num(formData.get("guestCount")),
      guestName: str(formData.get("guestName")),
      guestEmail: str(formData.get("guestEmail")),
      guestPhone: str(formData.get("guestPhone")),
      holdExpiresLocal: str(formData.get("holdExpiresLocal")),
      reason: str(formData.get("reason")),
    });
    const { booking: current } = await bookings.getBookingDetail(input.bookingId);
    const changesOccupancy =
      current.property_id !== input.propertyId ||
      current.check_in !== input.checkIn ||
      current.check_out !== input.checkOut;
    const requiresAdmin = ["paid", "refund_required", "refunded"].includes(current.payment_status);
    if (requiresAdmin) {
      assertAdminAction(session.role, "booking.confirm_manual");
      if (changesOccupancy && !bool(formData.get("confirmed"))) {
        throw new AppError("VALIDATION_ERROR", "Confirmá la edición de la reserva pagada", 422);
      }
    } else {
      assertAdminAction(session.role, "booking.edit");
    }
    const result = await availability.updateAdminBooking(
      input,
      session.userId,
      eventSource(session.role),
    );
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "booking.update",
      entityType: "booking",
      entityId: input.bookingId,
      before: current,
      after: { ...input, ...result },
      reason: input.reason,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  return OK;
}

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
    const validatedBookingId = entityIdSchema.parse(bookingId);
    const validatedOp = bookingOpSchema.parse(op);

    const permission: Record<BookingOp, AdminAction> = {
      cancel: "booking.cancel",
      expire: "booking.review",
      manual_review: "booking.manual_review",
      confirm_manual: "booking.confirm_manual",
    };
    assertAdminAction(session.role, permission[validatedOp]);

    // confirm_manual es una operación crítica: exige doble confirmación en la UI.
    if (validatedOp === "confirm_manual" && !bool(formData.get("confirmed"))) {
      throw new AppError("VALIDATION_ERROR", "Confirmá manualmente la operación", 422);
    }
    const reason = reasonSchema.parse(str(formData.get("reason")));
    const src = eventSource(session.role);

    let result: { ok: boolean; status: string; refundRequired?: boolean };
    if (validatedOp === "cancel")
      result = await bookings.cancelBooking(validatedBookingId, reason, session.userId, src);
    else if (validatedOp === "expire")
      result = await bookings.expireBooking(validatedBookingId, reason, session.userId, src);
    else if (validatedOp === "manual_review")
      result = await bookings.markManualReview(validatedBookingId, reason, session.userId, src);
    else result = await bookings.confirmManual(validatedBookingId, reason, session.userId, src);

    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: `booking.${validatedOp}`,
      entityType: "booking",
      entityId: validatedBookingId,
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

// ---------- Solicitudes de afiliados ----------

type AffiliateOp = "confirm" | "cancel";

// Confirmar deja payment_status='unpaid' (el afiliado no paga por QR); cancelar libera
// el hold y devuelve las fechas al calendario público.
export async function affiliateRequestAction(
  bookingId: string,
  op: AffiliateOp,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "affiliate.review");
    const validatedBookingId = entityIdSchema.parse(bookingId);
    const validatedOp = affiliateOpSchema.parse(op);
    if (validatedOp === "confirm" && !bool(formData.get("confirmed"))) {
      throw new AppError("VALIDATION_ERROR", "Confirmá manualmente la operación", 422);
    }
    const reason = reasonSchema.parse(str(formData.get("reason")));
    const src = eventSource(session.role);

    const result =
      validatedOp === "confirm"
        ? await bookings.confirmManual(validatedBookingId, reason, session.userId, src)
        : await bookings.cancelBooking(validatedBookingId, reason, session.userId, src);

    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: `affiliate.${validatedOp}`,
      entityType: "booking",
      entityId: validatedBookingId,
      after: { status: result.status },
      reason,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/affiliates/${bookingId}`);
  revalidatePath("/admin/affiliates");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
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

// ---------- Pagos: verificación de comprobantes ----------

type PaymentOp = "confirm" | "reject" | "annotate";

// confirm: ai_approved → paid/confirmed (Modo B). reject: manda a error/expired.
// annotate: solo deja constancia en la bitácora, sin cambiar estado.
export async function paymentAction(
  paymentId: string,
  op: PaymentOp,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    await assertSameOrigin();
    assertAdminAction(session.role, "payment.review");
    const validatedPaymentId = entityIdSchema.parse(paymentId);
    const validatedOp = paymentOpSchema.parse(op);
    if (validatedOp === "confirm" && !bool(formData.get("confirmed"))) {
      throw new AppError("VALIDATION_ERROR", "Confirmá manualmente la operación", 422);
    }
    const reason = reasonSchema.parse(str(formData.get("reason")));

    if (validatedOp === "annotate") {
      const ctx = await buildAuditContext(session);
      await writeAudit({
        ...ctx,
        action: "payment.annotate",
        entityType: "payment",
        entityId: validatedPaymentId,
        reason,
      });
    } else {
      const supabase = createAdminClient();
      const { error } =
        validatedOp === "confirm"
          ? await supabase.rpc("admin_confirm_ai_payment", {
              p_payment_id: validatedPaymentId,
              p_actor_id: session.userId,
            })
          : await supabase.rpc("admin_reject_payment", {
              p_payment_id: validatedPaymentId,
              p_actor_id: session.userId,
              p_reason: reason,
            });
      if (error) throw mapPostgresError(error.message);

      const ctx = await buildAuditContext(session);
      await writeAudit({
        ...ctx,
        action: `payment.${validatedOp}`,
        entityType: "payment",
        entityId: validatedPaymentId,
        reason,
      });
    }
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath("/admin/payments");
  return OK;
}

// Cambia el modo de confirmación de comprobantes (Modo A/B). Solo admin.
export async function setReceiptModeAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    await assertSameOrigin();
    assertAdminAction(session.role, "payment.review");
    const mode = receiptConfirmModeSchema.parse(str(formData.get("mode")));
    await setReceiptConfirmMode(mode);
    const ctx = await buildAuditContext(session);
    await writeAudit({
      ...ctx,
      action: "payment.set_mode",
      entityType: "setting",
      entityId: "receipt_confirm_mode",
      after: { mode },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/payments");
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
