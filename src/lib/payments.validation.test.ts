import { describe, it, expect } from "vitest";
import { createPaymentSchema, paymentIdSchema } from "./validation";

describe("createPaymentSchema", () => {
  it("acepta provider mock y method qr", () => {
    const r = createPaymentSchema.safeParse({ provider: "mock", method: "qr" });
    expect(r.success).toBe(true);
  });

  it("aplica defaults cuando faltan campos", () => {
    const r = createPaymentSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.provider).toBe("mock");
      expect(r.data.method).toBe("qr");
    }
  });

  it("rechaza un provider no soportado", () => {
    expect(createPaymentSchema.safeParse({ provider: "bnb" }).success).toBe(false);
  });

  it("rechaza un method no soportado", () => {
    expect(createPaymentSchema.safeParse({ method: "card" }).success).toBe(false);
  });

  it("ignora amount/status/externalId inyectados por el cliente", () => {
    const r = createPaymentSchema.safeParse({
      provider: "mock",
      method: "qr",
      amount: 1,
      status: "paid",
      externalId: "hacked",
      provider_status_code: "PAID",
    } as Record<string, unknown>);
    expect(r.success).toBe(true);
    if (r.success) {
      expect("amount" in r.data).toBe(false);
      expect("status" in r.data).toBe(false);
      expect("externalId" in r.data).toBe(false);
      expect("provider_status_code" in r.data).toBe(false);
    }
  });
});

describe("paymentIdSchema", () => {
  it("acepta un UUID válido", () => {
    expect(paymentIdSchema.safeParse("a1111111-1111-4111-8111-111111111111").success).toBe(true);
  });

  it("rechaza un valor no-UUID", () => {
    expect(paymentIdSchema.safeParse("123").success).toBe(false);
  });
});
