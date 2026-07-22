// Conversión entre coordenadas NORMALIZADAS (0..1, independientes del tamaño) y
// píxeles del contenedor renderizado. Los datos SIEMPRE se guardan normalizados para
// que el mismo marcador caiga en el mismo lugar en Next.js y Flutter a cualquier
// resolución. Funciones puras, sin React, testeables de forma aislada.

// Recorta un valor al rango unitario [0, 1]. Se aplica tras un drag para que un
// marcador nunca quede fuera de la imagen aunque el puntero salga del contenedor.
export function clampUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

// Normalizado -> píxel. pixel = unit * tamañoVisible.
export function normalizedToPixel(unit: number, size: number): number {
  return unit * size;
}

// Píxel -> normalizado. Recorta a [0,1]; si el contenedor mide 0 devuelve 0 (evita
// división por cero durante el primer render antes de conocer el layout).
export function pixelToNormalized(pixel: number, size: number): number {
  if (size <= 0) return 0;
  return clampUnit(pixel / size);
}

// --- Zoom/pan del visor (estilo Google Maps) ---
// Matemática pura del transform `translate(tx,ty) scale(s)` con transform-origin 0 0.
// El componente aplica estos resultados; testeables sin React.

// Recorta la escala al rango permitido.
export function clampScale(scale: number, min: number, max: number): number {
  if (Number.isNaN(scale)) return min;
  return Math.min(max, Math.max(min, scale));
}

// Zoom manteniendo fijo el punto (px, py) —en coords del viewport— bajo el cursor.
// Deriva de: screen = translate + scale * local  ⇒  local = (p - t) / scale.
// Para que `local` no se mueva al pasar a nextScale: t2 = p - (p - t) * (nextScale/scale).
export function zoomToPoint(
  scale: number,
  tx: number,
  ty: number,
  nextScale: number,
  px: number,
  py: number,
): { tx: number; ty: number } {
  if (scale <= 0) return { tx, ty };
  const ratio = nextScale / scale;
  return {
    tx: px - (px - tx) * ratio,
    ty: py - (py - ty) * ratio,
  };
}

// Mantiene la imagen pegada a los bordes del viewport: la traslación válida vive en
// [size*(1-scale), 0]. A scale=1 el único valor posible es 0 (sin paneo), como en
// Google Maps en zoom mínimo.
export function clampTranslate(
  tx: number,
  ty: number,
  scale: number,
  viewportW: number,
  viewportH: number,
): { tx: number; ty: number } {
  const minTx = viewportW * (1 - scale);
  const minTy = viewportH * (1 - scale);
  return {
    tx: Math.min(0, Math.max(minTx, tx)),
    ty: Math.min(0, Math.max(minTy, ty)),
  };
}
