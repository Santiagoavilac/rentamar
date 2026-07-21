import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, ValidationError } from "./errors";

const MAX_BODY_BYTES = 16 * 1024; // 16 KB: los payloads de reserva son pequeños.

// Parsea y valida un body JSON: exige Content-Type, limita tamaño y aplica Zod.
export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ValidationError("Content-Type debe ser application/json");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    throw new ValidationError("El cuerpo de la solicitud es demasiado grande");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ValidationError("JSON inválido");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ValidationError("Datos inválidos", result.error.issues);
  }
  return result.data;
}

// Convierte cualquier error en una respuesta segura (sin stack ni detalles internos).
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.code, message: error.message, details: error.details },
      { status: error.httpStatus },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.httpStatus },
    );
  }
  // Nunca filtrar el error real al cliente.
  console.error("[unhandled]", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "Error interno" }, { status: 500 });
}

export function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
