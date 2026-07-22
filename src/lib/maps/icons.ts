// Fuente única del vínculo tipo de marcador -> icon_key estable. El icon_key es un
// identificador string que NUNCA cambia (se persiste en la DB y lo comparten el
// editor Next.js, el visor y la futura app Flutter). Los SVG viven en
// public/map-icons/{icon_key}.svg; jamás se guarda el SVG en la base de datos.

export const MAP_ITEM_TYPES = [
  "house",
  "tower",
  "restaurant",
  "clubhouse",
  "entrance",
  "pool",
  "sports",
  "parking",
  "office",
  "social_area",
  "poi",
] as const;

export type MapItemType = (typeof MAP_ITEM_TYPES)[number];

// El icon_key coincide con el tipo por ahora, pero se mantiene como mapeo explícito
// para poder divergir en el futuro sin migrar datos (p. ej. varios tipos -> un icono).
export const ICON_KEY_BY_TYPE: Record<MapItemType, string> = {
  house: "house",
  tower: "tower",
  restaurant: "restaurant",
  clubhouse: "clubhouse",
  entrance: "entrance",
  pool: "pool",
  sports: "sports",
  parking: "parking",
  office: "office",
  social_area: "social_area",
  poi: "poi",
};

// Etiquetas legibles en español para la UI (toolbar, panel de propiedades, ficha).
export const LABEL_BY_TYPE: Record<MapItemType, string> = {
  house: "Casa",
  tower: "Torre",
  restaurant: "Restaurante",
  clubhouse: "Club house",
  entrance: "Entrada",
  pool: "Piscina",
  sports: "Deportes",
  parking: "Estacionamiento",
  office: "Oficina",
  social_area: "Área social",
  poi: "Punto de interés",
};

export function iconKeyForType(type: MapItemType): string {
  return ICON_KEY_BY_TYPE[type];
}

// Ruta pública del SVG a partir del icon_key. El visor y el editor la usan igual.
export function iconSrc(iconKey: string): string {
  return `/map-icons/${iconKey}.svg`;
}
