import { z } from "zod";
import { MAP_ITEM_TYPES } from "./maps/icons";
import { USERNAME_PATTERN } from "./co-owners";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe ser YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha inválida");

export const quoteSchema = z
  .object({
    propertyId: z.uuid(),
    checkIn: isoDate,
    checkOut: isoDate,
    guestCount: z.number().int().min(1).max(50),
  })
  .refine((d) => d.checkIn < d.checkOut, {
    message: "checkOut debe ser posterior a checkIn",
    path: ["checkOut"],
  });

// documentId, nationality y city existen porque la declaración jurada los pide. Se
// capturan en el formulario de reserva para no tener que perseguir al huésped después.
export const guestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(160),
  phone: z.string().trim().min(6).max(30).optional(),
  documentId: z.string().trim().min(4).max(40),
  nationality: z.string().trim().min(3).max(60),
  city: z.string().trim().min(2).max(80),
});

export const createBookingSchema = z
  .object({
    propertyId: z.uuid(),
    checkIn: isoDate,
    checkOut: isoDate,
    guestCount: z.number().int().min(1).max(50),
    guest: guestSchema,
  })
  .refine((d) => d.checkIn < d.checkOut, {
    message: "checkOut debe ser posterior a checkIn",
    path: ["checkOut"],
  });

// ---------- Fase 4 — canal de afiliados ----------
// El flujo es anónimo: no hay sesión que respalde estos datos, así que la validación
// es la única barrera antes de la RPC (que además revalida del lado SQL).

export const affiliateQuoteSchema = quoteSchema;

export const companionSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  documentId: z.string().trim().min(4).max(40),
  phone: z.string().trim().min(6).max(30).optional().or(z.literal("")),
});

export const createAffiliateRequestSchema = z
  .object({
    propertyId: z.uuid(),
    checkIn: isoDate,
    checkOut: isoDate,
    guestCount: z.number().int().min(1).max(50),
    affiliate: z.object({
      fullName: z.string().trim().min(2).max(120),
      documentId: z.string().trim().min(4).max(40),
      phone: z.string().trim().min(6).max(30),
      email: z.email().max(160).optional().or(z.literal("")),
      nationality: z.string().trim().min(3).max(60),
      city: z.string().trim().min(2).max(80),
    }),
    companions: z.array(companionSchema).max(20).default([]),
  })
  .refine((d) => d.checkIn < d.checkOut, {
    message: "checkOut debe ser posterior a checkIn",
    path: ["checkOut"],
  })
  .refine((d) => d.companions.length < d.guestCount, {
    message: "Los acompañantes no pueden superar la cantidad de huéspedes",
    path: ["companions"],
  });

export type CompanionInput = z.infer<typeof companionSchema>;
export type CreateAffiliateRequestInput = z.infer<typeof createAffiliateRequestSchema>;

export const propertiesQuerySchema = z.object({
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  guests: z.coerce.number().int().min(1).max(50).optional(),
  checkIn: isoDate.optional(),
  checkOut: isoDate.optional(),
});

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Slug inválido");

export const bookingIdSchema = z.uuid();

export const paymentIdSchema = z.uuid();

// El cliente solo elige proveedor y método. Nunca acepta amount, status, externalId
// ni provider_status_code. 'transfer' es el canal real (transferencia + comprobante);
// 'mock' se conserva para el flujo simulado de dev.
export const createPaymentSchema = z.object({
  provider: z.enum(["transfer", "mock"]).default("transfer"),
  method: z.enum(["qr"]).default("qr"),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ---------- Fase 3 — panel administrativo ----------
// El dinero se ingresa como string decimal en bolivianos (Bs 500,00) y se convierte
// a unidad menor en la capa de dominio. Nunca se acepta un minor directo del cliente.

const moneyDecimal = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Monto inválido (usá formato 1234.56)");

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Hora inválida");

// Motivo obligatorio en operaciones sensibles (cancelaciones, roles, bloqueos).
const reason = z.string().trim().min(4, "Indicá un motivo").max(500);

export const propertyStatusSchema = z.enum(["draft", "published", "paused", "archived"]);

export const towerInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(10000),
});

export const towerAssignmentSchema = z.object({
  propertyId: z.uuid(),
  towerId: z.uuid().nullable(),
});

// Columnas explícitas: anti mass-assignment. El cliente jamás fija id, created_at, etc.
export const propertyInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: slugSchema,
  shortDescription: z.string().trim().max(280).optional().or(z.literal("")),
  description: z.string().trim().max(6000).optional().or(z.literal("")),
  rules: z.string().trim().max(6000).optional().or(z.literal("")),
  locationReference: z.string().trim().max(1000).optional().or(z.literal("")),
  propertyType: z.string().trim().max(60).optional().or(z.literal("")),
  zone: z.string().trim().max(120).optional().or(z.literal("")),
  towerId: z.uuid().nullable(),
  status: propertyStatusSchema,
  featured: z.boolean(),
  basePrice: moneyDecimal,
  // Vacío significa que la propiedad todavía no tiene precio para afiliados:
  // se lista en /afiliados pero no se puede reservar.
  affiliatePrice: moneyDecimal.optional().or(z.literal("")),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  beds: z.number().int().min(0).max(100),
  maxGuests: z.number().int().min(1).max(100),
  minimumNights: z.number().int().min(1).max(365),
  checkInTime: timeString,
  checkOutTime: timeString,
});

export const rateInputSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    price: moneyDecimal,
    minimumNights: z.number().int().min(1).max(365).nullable(),
    label: z.string().trim().max(120).optional().or(z.literal("")),
  })
  .refine((d) => d.startDate < d.endDate, {
    message: "La fecha final debe ser posterior a la inicial",
    path: ["endDate"],
  });

// Recargo global de fin de semana: días en ISO (1 = lunes … 7 = domingo) y el
// porcentaje que se suma al precio base de esas noches. Lista vacía o 0% = apagado.
export const weekendPricingSchema = z.object({
  days: z.array(z.number().int().min(1).max(7)).max(7),
  surchargePercent: z.number().min(0).max(300),
});

export const stayPriceInputSchema = z.object({
  nights: z.number().int().min(1).max(365),
  total: moneyDecimal,
});

export const propertyPricingInputSchema = z
  .object({
    basePrice: moneyDecimal,
    durationPricingEnabled: z.boolean(),
    prices: z.array(stayPriceInputSchema).max(365),
    reason,
  })
  .superRefine((value, ctx) => {
    const seen = new Set<number>();
    const baseMinor = Math.round(Number(value.basePrice) * 100);
    value.prices.forEach((price, index) => {
      if (seen.has(price.nights)) {
        ctx.addIssue({
          code: "custom",
          message: "No repitas una cantidad de noches",
          path: ["prices", index, "nights"],
        });
      }
      seen.add(price.nights);
      if (Math.round(Number(price.total) * 100) > baseMinor * price.nights) {
        ctx.addIssue({
          code: "custom",
          message: "El precio configurado no puede superar el precio normal",
          path: ["prices", index, "total"],
        });
      }
    });
  });

export type PropertyPricingInput = z.infer<typeof propertyPricingInputSchema>;

export const availabilityBlockTypeSchema = z.enum([
  "maintenance",
  "internal_use",
  "owner_use",
  "operational",
  "manual",
  "other",
]);

export const availabilityBlockInputSchema = z
  .object({
    propertyId: z.uuid(),
    from: isoDate,
    to: isoDate,
    type: availabilityBlockTypeSchema,
    reason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => d.from < d.to, {
    message: "La fecha final debe ser posterior a la inicial",
    path: ["to"],
  });

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora inválidas");

export const adminBookingKindSchema = z.enum(["pre_reservation", "rental"]);
export const bookingOpSchema = z.enum(["cancel", "expire", "manual_review", "confirm_manual"]);
export const affiliateOpSchema = z.enum(["confirm", "cancel"]);
export const paymentOpSchema = z.enum(["confirm", "reject", "annotate"]);
export const receiptConfirmModeSchema = z.enum(["admin", "auto"]);
export const entityIdSchema = z.uuid();

const adminBookingBaseSchema = z.object({
  propertyId: z.uuid(),
  checkIn: isoDate,
  checkOut: isoDate,
  guestCount: z.number().int().min(1).max(50),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.email().max(160),
  guestPhone: z.string().trim().min(6).max(30).optional().or(z.literal("")),
  kind: adminBookingKindSchema,
  holdExpiresLocal: localDateTime.optional().or(z.literal("")),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const adminBookingInputSchema = adminBookingBaseSchema
  .refine((d) => d.checkIn < d.checkOut, {
    message: "La fecha final debe ser posterior a la inicial",
    path: ["checkOut"],
  })
  .refine((d) => d.kind !== "pre_reservation" || Boolean(d.holdExpiresLocal), {
    message: "Indicá cuándo vence la pre-reserva",
    path: ["holdExpiresLocal"],
  })
  .refine((d) => d.kind !== "rental" || (d.reason?.trim().length ?? 0) >= 4, {
    message: "Indicá el motivo de la confirmación manual",
    path: ["reason"],
  });

export const adminBookingUpdateSchema = adminBookingBaseSchema
  .omit({ kind: true })
  .extend({ bookingId: z.uuid(), reason })
  .refine((d) => d.checkIn < d.checkOut, {
    message: "La fecha final debe ser posterior a la inicial",
    path: ["checkOut"],
  });

export const availabilityBlockUpdateSchema = availabilityBlockInputSchema.safeExtend({
  blockId: z.uuid(),
});

export const plannerQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    propertyIds: z.array(z.uuid()).max(100).default([]),
    states: z
      .array(
        z.enum([
          "pre_reservation",
          "rental",
          "blocked",
          "affiliate_pending",
          "affiliate_confirmed",
        ]),
      )
      .max(5)
      .default([]),
    search: z.string().trim().max(160).default(""),
  })
  .refine((d) => d.from < d.to, { message: "Rango inválido", path: ["to"] });

export const reasonSchema = reason;

export const roleSchema = z.enum(["guest", "admin", "operator"]);

export const changeRoleInputSchema = z.object({
  userId: z.uuid(),
  role: roleSchema,
  reason,
});

export const createUserInputSchema = z.object({
  email: z.email().max(160),
  password: z.string().min(10, "Mínimo 10 caracteres").max(200),
  fullName: z.string().trim().min(2).max(160),
  role: z.enum(["admin", "operator"]),
  phone: z.string().trim().min(6).max(30).optional().or(z.literal("")),
});

export const imageMetaSchema = z.object({
  altText: z.string().trim().max(200).optional().or(z.literal("")),
  isCover: z.boolean().optional(),
});

// Filtros/orden de los listados: whitelist estricta, paginación server-side.
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------- Mapa interactivo ----------
// Coordenadas normalizadas: valor unitario en [0,1]. Se validan antes de guardar,
// además de las CHECK constraints de la DB (defensa en profundidad).
export const normalizedUnit = z.number().min(0).max(1);

export const mapItemTypeSchema = z.enum(MAP_ITEM_TYPES);

export const mapItemStatusSchema = z.enum(["draft", "published", "archived"]);

// Alta/edición de un marcador. El icon_key NO se acepta del cliente: se deriva del
// tipo en el servidor (ICON_KEY_BY_TYPE). linkedPropertyId es opcional (vínculo a un
// inmueble existente) y se valida como uuid o null.
export const mapItemInputSchema = z
  .object({
    type: mapItemTypeSchema,
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    normalizedX: normalizedUnit,
    normalizedY: normalizedUnit,
    normalizedWidth: normalizedUnit.gt(0),
    normalizedHeight: normalizedUnit.gt(0),
    rotation: z.number().min(-360).max(360),
    isVisible: z.boolean(),
    linkedPropertyId: z.uuid().nullable(),
    linkedTowerId: z.uuid().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "tower" && !value.linkedTowerId) {
      ctx.addIssue({
        code: "custom",
        message: "Un marcador de torre debe estar vinculado a una torre",
        path: ["linkedTowerId"],
      });
    }
    if (value.type === "tower" && value.linkedPropertyId) {
      ctx.addIssue({
        code: "custom",
        message: "Una torre no puede vincularse directamente a una propiedad",
        path: ["linkedPropertyId"],
      });
    }
    if (value.type !== "tower" && value.linkedTowerId) {
      ctx.addIssue({
        code: "custom",
        message: "Solo los marcadores de torre pueden vincular una torre",
        path: ["linkedTowerId"],
      });
    }
  });

// Movimiento (drag): solo posición, para no reescribir el resto del marcador.
export const mapItemMoveSchema = z.object({
  normalizedX: normalizedUnit,
  normalizedY: normalizedUnit,
});

export const mapCreateSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(2).max(160),
});

export type MapItemInput = z.infer<typeof mapItemInputSchema>;
export type MapItemMoveInput = z.infer<typeof mapItemMoveSchema>;
export type MapCreateInput = z.infer<typeof mapCreateSchema>;

// ---------- Cuentas con usuario y contraseña (copropietarios y limpieza) ----------

const accountUsername = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    USERNAME_PATTERN,
    "El usuario debe ir sin espacios y usar 3 a 32 caracteres: letras, números, punto, guion o _",
  );

const accountPassword = z.string().min(10, "Mínimo 10 caracteres").max(200);

// Alta en un solo paso: la propiedad y la cantidad de habitaciones son atributos de la
// cuenta, así que el mismo formulario que crea el usuario los define.
export const coOwnerAccountSchema = z.object({
  username: accountUsername,
  password: accountPassword,
  propertyName: z.string().trim().min(2, "Ingresá la propiedad").max(160),
  roomCount: z.coerce.number().int().min(1, "Debe haber al menos una habitación").max(200),
});

export const coOwnerPasswordSchema = z.object({
  accountId: z.uuid(),
  password: accountPassword,
});

export const coOwnerActiveSchema = z.object({
  accountId: z.uuid(),
  isActive: z.boolean(),
});

// El formulario usa <input type="date"> y type="time"> nativos, así que fecha y hora llegan
// por separado y se componen acá. El offset se fija a -04:00 (Bolivia, zona única del país)
// para que la hora que escribe el copropietario sea la que se lee después en el panel.
const BOLIVIA_UTC_OFFSET = "-04:00";
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const timeField = z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida");

const birthDateField = dateField.refine((v) => v < new Date().toISOString().slice(0, 10), {
  message: "La fecha de nacimiento debe ser anterior a hoy",
});

// Cada huésped se declara con nombre y apellido: la urbanización necesita saber quién ocupa
// el inmueble, no cuántos. Los menores de 2 años quedan fuera de esta lista y se cuentan
// aparte en `minors`.
export const coOwnerGuestSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá el nombre del huésped").max(160),
  documentId: z.string().trim().min(3, "Ingresá el CI del huésped").max(40),
  phone: z.string().trim().min(6, "Ingresá el teléfono del huésped").max(30),
  birthDate: birthDateField,
});

export const coOwnerStaySchema = z
  .object({
    fullName: z.string().trim().min(2, "Ingresá el nombre completo").max(160),
    documentId: z.string().trim().min(3, "Ingresá el CI").max(40),
    phone: z.string().trim().min(6, "Ingresá el teléfono").max(30),
    birthDate: birthDateField,
    nationality: z.string().trim().min(3, "Ingresá la nacionalidad").max(60),
    city: z.string().trim().min(2, "Ingresá la ciudad").max(80),
    checkInDate: dateField,
    checkInTime: timeField,
    checkOutDate: dateField,
    checkOutTime: timeField,
    // Del huésped 2 en adelante. El 1 es quien llena el formulario y firma la declaración.
    guests: z.array(coOwnerGuestSchema).max(19, "Máximo 20 huéspedes").default([]),
    minors: z.coerce.number().int().min(0).max(50).default(0),
  })
  .transform((value) => ({
    ...value,
    checkInAt: `${value.checkInDate}T${value.checkInTime}:00${BOLIVIA_UTC_OFFSET}`,
    checkOutAt: `${value.checkOutDate}T${value.checkOutTime}:00${BOLIVIA_UTC_OFFSET}`,
  }))
  .refine((value) => value.checkOutAt > value.checkInAt, {
    message: "La salida debe ser posterior a la entrada",
    path: ["checkOutDate"],
  });

export type CoOwnerAccountInput = z.infer<typeof coOwnerAccountSchema>;
export type CoOwnerStayInput = z.infer<typeof coOwnerStaySchema>;

// ---------- Módulo de personal de limpieza ----------

export const cleanerAccountSchema = z.object({
  username: accountUsername,
  password: accountPassword,
  fullName: z.string().trim().min(2, "Ingresá el nombre completo").max(160),
});

export const cleanerPasswordSchema = z.object({
  accountId: z.uuid(),
  password: accountPassword,
});

export const cleanerActiveSchema = z.object({
  accountId: z.uuid(),
  isActive: z.boolean(),
});

// Fecha y hora se guardan tal cual (columnas date y time), sin componer timestamp: la hora
// que escribe la persona es la que se lee en el panel, sin conversión de zona de por medio.
export const cleaningReportSchema = z
  .object({
    propertyId: z.uuid("Elegí una propiedad"),
    workDate: dateField,
    entryTime: timeField,
    exitTime: timeField,
  })
  .refine((value) => value.exitTime > value.entryTime, {
    message: "La salida debe ser posterior a la entrada",
    path: ["exitTime"],
  });

export type CleanerAccountInput = z.infer<typeof cleanerAccountSchema>;
export type CleaningReportInput = z.infer<typeof cleaningReportSchema>;

export type PropertyInput = z.infer<typeof propertyInputSchema>;
export type TowerInput = z.infer<typeof towerInputSchema>;
export type RateInput = z.infer<typeof rateInputSchema>;
export type WeekendPricing = z.infer<typeof weekendPricingSchema>;
export type AvailabilityBlockInput = z.infer<typeof availabilityBlockInputSchema>;
export type AvailabilityBlockUpdateInput = z.infer<typeof availabilityBlockUpdateSchema>;
export type AdminBookingInput = z.infer<typeof adminBookingInputSchema>;
export type AdminBookingUpdateInput = z.infer<typeof adminBookingUpdateSchema>;
export type PlannerQueryInput = z.infer<typeof plannerQuerySchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleInputSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type ImageMetaInput = z.infer<typeof imageMetaSchema>;
