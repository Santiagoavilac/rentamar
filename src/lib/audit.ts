import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import type { Database } from "./supabase/types";

// Bitácora central sanitizada. NUNCA registra tokens, hashes, service role, QR
// completo, respuestas raw del proveedor, headers completos ni PII innecesaria.
// La IP se guarda hasheada y truncada, nunca completa. La escritura es best-effort:
// una falla de auditoría no debe romper la operación de negocio (pero se loguea).

type UserRole = Database["public"]["Enums"]["user_role"];

// Claves cuyo valor jamás debe persistirse (se reemplaza por "[redacted]").
const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|hash|idempotency|service_role|authorization|cookie|qr_image|qr_code|raw|create_response|status_response|access_token)/i;

const MAX_STRING = 500;
const MAX_DEPTH = 6;

// Sanea recursivamente un valor para auditoría: elimina claves sensibles, trunca
// strings largos (QR base64, respuestas grandes) y limita la profundidad.
export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (depth > MAX_DEPTH) return "[truncated]";

  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((v) => sanitizeForAudit(v, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = sanitizeForAudit(val, depth + 1);
    }
    return out;
  }

  // Funciones, symbols, bigint u otros: no se persisten.
  return "[unsupported]";
}

// Hash truncado de la IP: permite correlacionar sin almacenar la IP en claro.
// Se usa un salt de entorno para que el hash no sea reversible por fuerza bruta.
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip || ip === "unknown") return null;
  const salt = process.env.AUDIT_IP_SALT ?? "rentamar-audit";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}

export function requestId(): string {
  return randomUUID();
}

// Extrae una IP de proxy y un resumen corto del user-agent desde headers.
// Nunca se guarda el user-agent completo (puede tener datos identificatorios).
export function summarizeRequest(headers: Headers): {
  ipHash: string | null;
  userAgentSummary: string | null;
} {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
  const ua = headers.get("user-agent") ?? "";
  const summary = ua ? ua.slice(0, 120) : null;
  return { ipHash: hashIp(ip), userAgentSummary: summary };
}

export type AuditEntry = {
  actorId: string | null;
  actorRole: UserRole | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  requestId?: string | null;
  ipHash?: string | null;
  userAgentSummary?: string | null;
};

// Inserta una fila en audit_logs con los datos ya saneados. Best-effort.
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("audit_logs").insert({
      actor_id: entry.actorId,
      actor_role: entry.actorRole,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      before_data: (sanitizeForAudit(entry.before ?? null) ?? null) as never,
      after_data: (sanitizeForAudit(entry.after ?? null) ?? null) as never,
      reason: entry.reason ?? null,
      request_id: entry.requestId ?? null,
      ip_hash: entry.ipHash ?? null,
      user_agent_summary: entry.userAgentSummary ?? null,
    });
  } catch (err) {
    console.error("[audit] no se pudo registrar", err instanceof Error ? err.message : "unknown");
  }
}
