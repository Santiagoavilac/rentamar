// Rate limiting básico en memoria (por instancia). Suficiente para Fase 1.
// Fase 2: reemplazar por un store compartido (Upstash/Redis) si hay varias instancias.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

// Deriva una clave de cliente desde headers de proxy. No confiar como identidad.
export function clientKey(headers: Headers, scope: string): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}
