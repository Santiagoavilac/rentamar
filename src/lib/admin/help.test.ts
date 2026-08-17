import { describe, expect, it } from "vitest";
import { HELP } from "./help";

const entries = Object.entries(HELP);

describe("ayuda contextual del panel", () => {
  it("cada sección tiene título, resumen corto y explicación larga", () => {
    expect(entries.length).toBeGreaterThan(30);
    for (const [key, entry] of entries) {
      expect(entry.title.length, `${key}: falta título`).toBeGreaterThan(3);
      // El resumen se muestra en un tooltip: si es largo, no entra.
      expect(entry.short.length, `${key}: resumen vacío`).toBeGreaterThan(20);
      expect(entry.short.length, `${key}: resumen demasiado largo`).toBeLessThanOrEqual(160);
      expect(entry.long.length, `${key}: sin explicación larga`).toBeGreaterThan(0);
    }
  });

  it("los bloques largos no vienen vacíos", () => {
    for (const [key, entry] of entries) {
      for (const block of entry.long) {
        if (block.tipo === "lista" || block.tipo === "pasos") {
          expect(block.items.length, `${key}: lista vacía`).toBeGreaterThan(0);
          for (const item of block.items) expect(item.trim()).not.toBe("");
        } else {
          expect(block.texto.trim(), `${key}: bloque vacío`).not.toBe("");
        }
      }
    }
  });
});
