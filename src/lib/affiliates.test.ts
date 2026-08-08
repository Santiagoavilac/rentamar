import { describe, expect, it } from "vitest";
import { buildWhatsappMessage, buildWhatsappUrl } from "./affiliates";
import { canPerformAdminAction } from "./permissions";

const result = {
  bookingId: "8f6d1c4e-2f3a-4b6c-9d0e-1a2b3c4d5e6f",
  bookingCode: "RM-AF-0001",
  currency: "BOB",
  nights: 3,
  nightlyMinor: 25_000,
  totalMinor: 75_000,
  checkIn: "2030-03-10",
  checkOut: "2030-03-13",
};

const affiliate = {
  fullName: "Ana Rojas",
  documentId: "7654321",
  phone: "78013406",
  email: "",
  nationality: "Boliviana",
  city: "Santa Cruz",
};

describe("mensaje de WhatsApp del afiliado", () => {
  it("usa los importes que devolvió la RPC, no los del cliente", () => {
    const message = buildWhatsappMessage({
      propertyName: "Casa Mar Adentro",
      result,
      affiliate,
      companions: [{ fullName: "Luis Rojas", documentId: "1234567", phone: "" }],
      guestCount: 2,
    });
    expect(message).toContain("RM-AF-0001");
    expect(message).toContain("Casa Mar Adentro");
    expect(message).toContain("CI: 7654321");
    expect(message).toContain("1. Luis Rojas — CI 1234567");
    expect(message).toContain("Noches: 3");
    expect(message).toContain("Tarifa afiliado: BOB 250,00 por noche");
    expect(message).toContain("Total: BOB 750,00");
  });

  it("omite el email vacío y marca la ausencia de acompañantes", () => {
    const message = buildWhatsappMessage({
      propertyName: "Casa Mar Adentro",
      result,
      affiliate,
      companions: [],
      guestCount: 1,
    });
    expect(message).not.toContain("Email:");
    expect(message).toContain("Sin acompañantes");
  });

  it("codifica el mensaje en la URL de wa.me", () => {
    const url = buildWhatsappUrl("Hola & chau\nlínea 2", "59178013406");
    expect(url.startsWith("https://wa.me/59178013406?text=")).toBe(true);
    expect(url).not.toContain("\n");
    expect(decodeURIComponent(url.split("?text=")[1])).toBe("Hola & chau\nlínea 2");
  });
});

describe("permisos del canal de afiliados", () => {
  it("reserva la configuración de tarifa para admin", () => {
    expect(canPerformAdminAction("admin", "affiliate.manage")).toBe(true);
    expect(canPerformAdminAction("operator", "affiliate.manage")).toBe(false);
  });

  it("permite al operator revisar solicitudes", () => {
    expect(canPerformAdminAction("operator", "affiliate.review")).toBe(true);
    expect(canPerformAdminAction("admin", "affiliate.review")).toBe(true);
  });
});
