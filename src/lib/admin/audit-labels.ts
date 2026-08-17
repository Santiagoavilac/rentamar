import { formatCurrency } from "@/lib/money";

// Traduce los códigos de audit_logs a algo que un administrador pueda leer.
// Módulo puro (sin server-only) para poder testearlo y usarlo desde el cliente.

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "property.create": "Propiedad creada",
  "property.update": "Propiedad actualizada",
  "property.tower": "Torre de la propiedad actualizada",
  "property.base_price": "Precio base actualizado",
  "property.pricing": "Precios por duración actualizados",
  "pricing.weekend": "Recargo de fin de semana actualizado",
  "property.amenities": "Comodidades actualizadas",
  "property.image.add": "Imagen agregada",
  "property.image.upload": "Imagen subida",
  "property.image.cover": "Portada cambiada",
  "property.image.reorder": "Orden de las imágenes cambiado",
  "property.image.delete": "Imagen eliminada",
  "rate.create": "Tarifa de temporada creada",
  "rate.update": "Tarifa de temporada actualizada",
  "rate.remove": "Tarifa de temporada eliminada",
  "availability.block": "Fechas bloqueadas",
  "availability.release": "Fechas liberadas",
  "availability.update": "Bloqueo modificado",
  "booking.update": "Reserva actualizada",
  "booking.cancel": "Reserva cancelada",
  "booking.expire": "Reserva vencida",
  "booking.manual_review": "Reserva enviada a revisión manual",
  "booking.confirm_manual": "Reserva confirmada a mano",
  "declaration.generate": "Declaración jurada emitida",
  "affiliate.confirm": "Solicitud de afiliado confirmada",
  "affiliate.cancel": "Solicitud de afiliado cancelada",
  "map.create": "Mapa creado",
  "map.publish": "Mapa publicado",
  "map.item.create": "Punto del mapa creado",
  "map.item.update": "Punto del mapa actualizado",
  "map.item.delete": "Punto del mapa eliminado",
  "map.item.visibility": "Visibilidad del punto cambiada",
  "tower.create": "Torre creada",
  "tower.update": "Torre actualizada",
  "tower.active": "Estado de la torre actualizado",
  "user.create": "Usuario creado",
  "user.role_change": "Rol de usuario cambiado",
  "coowner.account.create": "Cuenta de copropietario creada",
  "coowner.account.password": "Contraseña de copropietario cambiada",
  "coowner.account.active": "Cuenta de copropietario activada o desactivada",
  "coowner.account.delete": "Cuenta de copropietario eliminada",
  "cleaner.account.create": "Cuenta de limpieza creada",
  "cleaner.account.password": "Contraseña de limpieza cambiada",
  "cleaner.account.active": "Cuenta de limpieza activada o desactivada",
  "cleaner.account.delete": "Cuenta de limpieza eliminada",
};

export function describeAction(action: string): string {
  const known = AUDIT_ACTION_LABELS[action];
  if (known) return known;
  const words = action.split(".").join(" · ").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const ENTITY_LABELS: Record<string, string> = {
  property: "Propiedad",
  booking: "Reserva",
  map: "Mapa",
  map_item: "Punto del mapa",
  tower: "Torre",
  property_rate: "Tarifa",
  availability_block: "Bloqueo",
  user: "Usuario",
  setting: "Ajuste",
  co_owner_account: "Cuenta de copropietario",
};

export function describeEntityType(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

export function entityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case "property":
      return `/admin/properties/${entityId}`;
    case "booking":
      return `/admin/bookings/${entityId}`;
    case "map":
    case "map_item":
      return "/admin/mapa";
    case "tower":
      return "/admin/towers";
    case "user":
      return "/admin/users";
    case "co_owner_account":
      return "/admin/users";
    default:
      return null;
  }
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "administrador",
  operator: "operador",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  slug: "Enlace",
  status: "Estado",
  description: "Descripción",
  base_price_minor: "Precio base",
  affiliate_nightly_price_minor: "Precio para afiliados",
  nightly_price_minor: "Precio por noche",
  total_price_minor: "Precio total",
  total_minor: "Total",
  currency: "Moneda",
  max_guests: "Huéspedes máximos",
  bedrooms: "Dormitorios",
  bathrooms: "Baños",
  minimum_nights: "Mínimo de noches",
  duration_pricing_enabled: "Precios por duración",
  check_in: "Entrada",
  check_out: "Salida",
  guest_name: "Huésped",
  payment_status: "Estado de pago",
  is_visible: "Visible",
  start_date: "Desde",
  end_date: "Hasta",
  role: "Rol",
  label: "Etiqueta",
  type: "Tipo",
};

const MAX_DIFF_FIELDS = 6;

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "vacío";
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (field.endsWith("_minor") && typeof value === "number") return formatCurrency(value);
  if (typeof value === "object") return "(varios datos)";
  return String(value);
}

export type FieldChange = { label: string; from: string; to: string };

// Compara las dos fotos que guarda writeAudit. Solo tiene sentido cuando ambas son
// filas de la base (ediciones); en las altas solo hay `after` y no se muestra nada.
export function diffChangedFields(before: unknown, after: unknown): FieldChange[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  if (Array.isArray(before) || Array.isArray(after)) return [];

  const previous = before as Record<string, unknown>;
  const next = after as Record<string, unknown>;
  const changes: FieldChange[] = [];

  for (const [field, value] of Object.entries(next)) {
    if (changes.length >= MAX_DIFF_FIELDS) break;
    if (!(field in previous)) continue;
    const old = previous[field];
    if (old === "[redacted]" || value === "[redacted]") continue;
    if (JSON.stringify(old ?? null) === JSON.stringify(value ?? null)) continue;
    changes.push({
      label: FIELD_LABELS[field] ?? field,
      from: formatValue(field, old),
      to: formatValue(field, value),
    });
  }
  return changes;
}
