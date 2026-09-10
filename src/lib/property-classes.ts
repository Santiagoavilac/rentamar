// Clases de inmueble. Módulo puro (sin server-only) porque lo usan tanto el formulario del
// panel como la portada pública, que son componentes cliente.
//
// El orden del arreglo es el orden en que se muestran: de mejor a más económica. La portada
// agrupa por clase respetándolo, y dentro de cada grupo ordena por precio.

export const PROPERTY_CLASSES = ["lujo", "a", "b", "c"] as const;

export type PropertyClass = (typeof PROPERTY_CLASSES)[number];

export const PROPERTY_CLASS_LABELS: Record<PropertyClass, string> = {
  lujo: "Lujo",
  a: "Clase A",
  b: "Clase B",
  c: "Clase C",
};

export const PROPERTY_CLASS_OPTIONS = PROPERTY_CLASSES.map(
  (value) => [value, PROPERTY_CLASS_LABELS[value]] as const,
);

export function isPropertyClass(value: unknown): value is PropertyClass {
  return typeof value === "string" && (PROPERTY_CLASSES as readonly string[]).includes(value);
}

export function propertyClassLabel(value: unknown): string | null {
  return isPropertyClass(value) ? PROPERTY_CLASS_LABELS[value] : null;
}

// Posición para ordenar. Las propiedades sin clasificar van al final: todavía nadie decidió
// qué son, y meterlas entre las clasificadas confundiría al que compara.
export function propertyClassRank(value: unknown): number {
  const index = isPropertyClass(value) ? PROPERTY_CLASSES.indexOf(value) : -1;
  return index === -1 ? PROPERTY_CLASSES.length : index;
}
