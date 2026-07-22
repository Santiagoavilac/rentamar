import { z } from "zod";
import { MAP_ITEM_TYPES } from "./maps/icons";

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

export const guestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(160),
  phone: z.string().trim().min(6).max(30).optional(),
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

// El cliente solo elige proveedor y método (ambos con un único valor válido en
// Fase 2). Nunca acepta amount, status, externalId ni provider_status_code.
export const createPaymentSchema = z.object({
  provider: z.enum(["mock"]).default("mock"),
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

// Columnas explícitas: anti mass-assignment. El cliente jamás fija id, created_at, etc.
export const propertyInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: slugSchema,
  shortDescription: z.string().trim().max(280).optional().or(z.literal("")),
  description: z.string().trim().max(6000).optional().or(z.literal("")),
  propertyType: z.string().trim().max(60).optional().or(z.literal("")),
  zone: z.string().trim().max(120).optional().or(z.literal("")),
  status: propertyStatusSchema,
  featured: z.boolean(),
  basePrice: moneyDecimal,
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
export const mapItemInputSchema = z.object({
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

export type PropertyInput = z.infer<typeof propertyInputSchema>;
export type RateInput = z.infer<typeof rateInputSchema>;
export type AvailabilityBlockInput = z.infer<typeof availabilityBlockInputSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleInputSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type ImageMetaInput = z.infer<typeof imageMetaSchema>;
