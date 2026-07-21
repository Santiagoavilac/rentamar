import "server-only";
import { MockPaymentProvider } from "./mock-provider";
import type { PaymentProvider } from "./provider";

// Selecciona el proveedor según PAYMENT_PROVIDER. En Fase 2 solo existe 'mock';
// BNB se enchufa aquí en Fase 3 sin tocar la orquestación.
export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      return new MockPaymentProvider();
    default:
      throw new Error(`PAYMENT_PROVIDER no soportado: ${name}`);
  }
}

// Acceso directo al mock para los endpoints dev de simulación.
export function getMockProvider(): MockPaymentProvider {
  return new MockPaymentProvider();
}
