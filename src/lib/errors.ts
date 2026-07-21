// Errores de dominio con mapeo a HTTP. No exponen detalles internos al cliente.

export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = code;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class ValidationError extends AppError {
  readonly details?: unknown;
  constructor(message = "Datos inválidos", details?: unknown) {
    super("VALIDATION_ERROR", message, 400);
    this.details = details;
  }
}

export class PropertyNotFoundError extends AppError {
  constructor() {
    super("PROPERTY_NOT_FOUND", "Propiedad no encontrada", 404);
  }
}

export class PropertyNotPublishedError extends AppError {
  constructor() {
    super("PROPERTY_NOT_PUBLISHED", "La propiedad no está disponible", 409);
  }
}

export class BookingConflictError extends AppError {
  constructor() {
    super("BOOKING_CONFLICT", "Las fechas seleccionadas ya no están disponibles", 409);
  }
}

export class MinimumNightsError extends AppError {
  constructor() {
    super("MINIMUM_NIGHTS", "La estadía no cumple la cantidad mínima de noches", 422);
  }
}

export class GuestCapacityError extends AppError {
  constructor() {
    super("GUEST_CAPACITY", "La cantidad de huéspedes supera el máximo permitido", 422);
  }
}

export class BookingExpiredError extends AppError {
  constructor() {
    super("BOOKING_EXPIRED", "La reserva expiró", 410);
  }
}

export class UnauthorizedBookingAccessError extends AppError {
  constructor() {
    super("UNAUTHORIZED_BOOKING_ACCESS", "No autorizado a ver esta reserva", 401);
  }
}

export class PaymentNotFoundError extends AppError {
  constructor() {
    super("PAYMENT_NOT_FOUND", "Pago no encontrado", 404);
  }
}

export class PaymentAlreadyPaidError extends AppError {
  constructor() {
    super("PAYMENT_ALREADY_PAID", "La reserva ya fue pagada", 409);
  }
}

export class PaymentExpiredError extends AppError {
  constructor() {
    super("PAYMENT_EXPIRED", "El pago expiró", 410);
  }
}

export class PaymentProviderUnavailableError extends AppError {
  constructor() {
    super("PAYMENT_PROVIDER_UNAVAILABLE", "El proveedor de pago no está disponible", 502);
  }
}

export class PaymentInvalidStateError extends AppError {
  constructor() {
    super("PAYMENT_INVALID_STATE", "El pago no está en un estado válido", 409);
  }
}

export class PaymentAmountMismatchError extends AppError {
  constructor() {
    super("PAYMENT_AMOUNT_MISMATCH", "El monto del pago no coincide con la reserva", 422);
  }
}

export class PaymentConfirmationFailedError extends AppError {
  constructor() {
    super("PAYMENT_CONFIRMATION_FAILED", "No se pudo confirmar el pago", 500);
  }
}

export class PaymentRateLimitedError extends AppError {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds = 0) {
    super("PAYMENT_RATE_LIMITED", "Demasiadas solicitudes, intenta más tarde", 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// ---------- Fase 3 — panel administrativo ----------

// Falta de permiso verificada en el servidor (no basta con ocultar botones en la UI).
export class ForbiddenError extends AppError {
  constructor(message = "No tenés permiso para esta acción") {
    super("FORBIDDEN", message, 403);
  }
}

export class RateOverlapError extends AppError {
  constructor() {
    super("RATE_OVERLAP", "La tarifa se solapa con otra ya existente", 409);
  }
}

export class AvailabilityBlockedError extends AppError {
  constructor() {
    super("AVAILABILITY_BLOCKED", "Las fechas están bloqueadas", 409);
  }
}

export class LastAdminError extends AppError {
  constructor() {
    super("LAST_ADMIN", "No se puede dejar el sistema sin administradores", 409);
  }
}

export class SlugTakenError extends AppError {
  constructor() {
    super("SLUG_TAKEN", "Ya existe una propiedad con ese slug", 409);
  }
}

export class ReasonRequiredError extends AppError {
  constructor() {
    super("REASON_REQUIRED", "El motivo es obligatorio", 422);
  }
}

export class BookingInvalidStateError extends AppError {
  constructor() {
    super("BOOKING_INVALID_STATE", "La reserva no está en un estado válido para esta acción", 409);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super("NOT_FOUND", message, 404);
  }
}

// Traduce un error de Postgres (lanzado por las funciones SQL) a un error de dominio.
export function mapPostgresError(message: string | undefined): AppError {
  switch (message) {
    case "PROPERTY_NOT_FOUND":
      return new PropertyNotFoundError();
    case "PROPERTY_NOT_PUBLISHED":
      return new PropertyNotPublishedError();
    case "BOOKING_CONFLICT":
      return new BookingConflictError();
    case "MINIMUM_NIGHTS":
      return new MinimumNightsError();
    case "GUEST_CAPACITY":
      return new GuestCapacityError();
    case "INVALID_DATES":
    case "INVALID_DATES_PAST":
      return new ValidationError("Fechas inválidas");
    case "BOOKING_NOT_FOUND":
      return new UnauthorizedBookingAccessError();
    case "PAYMENT_NOT_FOUND":
      return new PaymentNotFoundError();
    case "PAYMENT_ALREADY_PAID":
      return new PaymentAlreadyPaidError();
    case "PAYMENT_INVALID_STATE":
      return new PaymentInvalidStateError();
    case "PAYMENT_AMOUNT_MISMATCH":
      return new PaymentAmountMismatchError();
    // Fase 3 — RPC administrativas.
    case "RATE_OVERLAP":
      return new RateOverlapError();
    case "AVAILABILITY_BLOCKED":
      return new AvailabilityBlockedError();
    case "LAST_ADMIN":
      return new LastAdminError();
    case "SLUG_TAKEN":
      return new SlugTakenError();
    case "FORBIDDEN":
      return new ForbiddenError();
    case "REASON_REQUIRED":
      return new ReasonRequiredError();
    case "BOOKING_INVALID_STATE":
      return new BookingInvalidStateError();
    case "BOOKING_EXPIRED":
      return new BookingExpiredError();
    case "BLOCK_NOT_FOUND":
      return new NotFoundError("Bloqueo no encontrado");
    case "RATE_NOT_FOUND":
      return new NotFoundError("Tarifa no encontrada");
    case "USER_NOT_FOUND":
      return new NotFoundError("Usuario no encontrado");
    case "VALIDATION_ERROR":
      return new ValidationError();
    default:
      return new AppError("INTERNAL_ERROR", "Error interno", 500);
  }
}
