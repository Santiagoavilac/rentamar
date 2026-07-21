import "server-only";
import { headers } from "next/headers";
import { requestId, summarizeRequest } from "@/lib/audit";
import type { StaffSession } from "@/lib/auth";

// Contexto de auditoría de una operación admin: quién, con qué request y desde
// dónde (IP hasheada, UA resumido). Se arma una vez por acción y se pasa a writeAudit.
export type AuditContext = {
  actorId: string;
  actorRole: StaffSession["role"];
  requestId: string;
  ipHash: string | null;
  userAgentSummary: string | null;
};

export async function buildAuditContext(session: StaffSession): Promise<AuditContext> {
  const h = await headers();
  const { ipHash, userAgentSummary } = summarizeRequest(h);
  return {
    actorId: session.userId,
    actorRole: session.role,
    requestId: requestId(),
    ipHash,
    userAgentSummary,
  };
}

// Valida el header Origin en mutaciones admin (defensa CSRF adicional a las
// cookies SameSite). En desarrollo se permite la ausencia de Origin.
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  if (!origin) return; // navegaciones same-origin GET no siempre envían Origin.
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      throw new Error("ORIGIN_MISMATCH");
    }
  } catch {
    throw new Error("ORIGIN_MISMATCH");
  }
}
