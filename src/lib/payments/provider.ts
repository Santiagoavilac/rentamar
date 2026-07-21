// Contrato del proveedor de pago. El mock (Fase 2) y BNB (Fase 3) lo implementan
// por igual: la orquestación server-side no depende del proveedor concreto.

// Estado normalizado que la orquestación entiende, independiente del proveedor.
export type ProviderPaymentStatus = "pending" | "paid" | "expired" | "error";

export type CreatePaymentParams = {
  paymentId: string;
  bookingId: string;
  amountMinor: number;
  currency: string;
  expiresAt: string;
};

export type CreatePaymentResult = {
  externalId: string;
  qrCode: string;
  qrImageBase64: string;
  qrMimeType: string;
  providerStatusCode: string;
  // Crudo del proveedor: se persiste server-side, nunca se expone al cliente.
  rawResponse: unknown;
};

export type GetPaymentStatusResult = {
  status: ProviderPaymentStatus;
  providerStatusCode: string;
  rawResponse: unknown;
};

export interface PaymentProvider {
  readonly name: "mock" | "bnb";
  readonly mode: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  getPaymentStatus(externalId: string): Promise<GetPaymentStatusResult>;
}
