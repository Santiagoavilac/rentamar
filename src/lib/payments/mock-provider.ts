import "server-only";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  GetPaymentStatusResult,
  PaymentProvider,
  ProviderPaymentStatus,
} from "./provider";

// Proveedor mock: emula el banco externo con la tabla privada mock_payment_state.
// Genera un QR PNG real (server-side) y expone la misma interfaz que tendrá BNB.
// El estado del "banco" solo cambia por simulate() (endpoints dev), nunca por el
// navegador; la confirmación real ocurre siempre vía verify.
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;
  readonly mode = "sandbox";

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const externalId = `mock_${randomBytes(16).toString("hex")}`;
    const qrCode = `rentamar://mock-payment/${externalId}`;

    const dataUrl = await QRCode.toDataURL(qrCode, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    });
    // toDataURL devuelve "data:image/png;base64,XXXX"; separamos el base64 puro.
    const qrImageBase64 = dataUrl.split(",", 2)[1] ?? "";

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("mock_payment_state")
      .insert({ external_id: externalId, status: "pending" });
    if (error) {
      throw new Error(`MOCK_PROVIDER_CREATE_FAILED: ${error.message}`);
    }

    return {
      externalId,
      qrCode,
      qrImageBase64,
      qrMimeType: "image/png",
      providerStatusCode: "PENDING",
      rawResponse: {
        provider: "mock",
        externalId,
        status: "pending",
        amountMinor: params.amountMinor,
        currency: params.currency,
        expiresAt: params.expiresAt,
      },
    };
  }

  async getPaymentStatus(externalId: string): Promise<GetPaymentStatusResult> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("mock_payment_state")
      .select("status")
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) {
      throw new Error(`MOCK_PROVIDER_STATUS_FAILED: ${error.message}`);
    }
    if (!data) {
      return {
        status: "error",
        providerStatusCode: "NOT_FOUND",
        rawResponse: { provider: "mock", externalId, status: "not_found" },
      };
    }

    const status = data.status as ProviderPaymentStatus;
    return {
      status,
      providerStatusCode: status.toUpperCase(),
      rawResponse: { provider: "mock", externalId, status },
    };
  }

  // Solo para simulación dev: mueve el estado del "banco". No confirma la reserva.
  async simulate(externalId: string, status: "paid" | "expired" | "error"): Promise<boolean> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("mock_payment_state")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("external_id", externalId)
      .select("external_id")
      .maybeSingle();

    if (error) {
      throw new Error(`MOCK_PROVIDER_SIMULATE_FAILED: ${error.message}`);
    }
    return Boolean(data);
  }
}
