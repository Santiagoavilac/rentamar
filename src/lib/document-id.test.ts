import { describe, expect, it } from "vitest";
import { normalizeDocumentId } from "./document-id";

// Estos casos son el contrato con `public.normalize_document`. Si acá cambia algo, la
// función de la base tiene que cambiar igual: si se separan, un vetado entra escribiendo
// el carnet distinto.
describe("normalización del documento", () => {
  it("ignora guiones, puntos y espacios", () => {
    expect(normalizeDocumentId("1234567-1B")).toBe("12345671B");
    expect(normalizeDocumentId("1.234.567 1B")).toBe("12345671B");
    expect(normalizeDocumentId(" 1234567 1B ")).toBe("12345671B");
  });

  it("ignora mayúsculas y minúsculas", () => {
    expect(normalizeDocumentId("1234567-1b")).toBe("12345671B");
  });

  it("un documento vacío o solo con símbolos no identifica a nadie", () => {
    expect(normalizeDocumentId("")).toBeNull();
    expect(normalizeDocumentId("   ")).toBeNull();
    expect(normalizeDocumentId("---")).toBeNull();
    expect(normalizeDocumentId(null)).toBeNull();
    expect(normalizeDocumentId(undefined)).toBeNull();
  });

  it("no confunde a dos personas distintas", () => {
    expect(normalizeDocumentId("1234567")).not.toBe(normalizeDocumentId("12345678"));
  });
});
