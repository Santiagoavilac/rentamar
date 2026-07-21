# Reservas — flujo y API (Fase 1)

El flujo cubre hasta el punto 8: **cotizar → crear prerreserva → bloquear
fechas**. No hay pagos ni confirmación real (Fase 2).

## Flujo

1. El cliente pide una **cotización** (`POST /api/bookings/quote`). El precio se
   calcula en el servidor con `calculate_booking_price()`. El cliente nunca
   envía montos.
2. El cliente crea la **prerreserva** (`POST /api/bookings`). El servidor:
   - genera un `access_token` aleatorio de alta entropía,
   - llama a `create_booking_with_hold()` guardando solo el **hash** del token,
   - devuelve el token en claro **una única vez**.
3. La RPC crea, en una transacción, `bookings` (`pending_payment`) +
   `booking_price_items` + `booking_holds` (`active`). El exclusion constraint
   bloquea las fechas y rechaza solapamientos.
4. El invitado consulta su reserva (`GET /api/bookings/:id`) presentando el token
   (o con sesión, si es el dueño). Nunca por UUID/`booking_code` solos.
5. Los holds sin confirmar caducan con `expire_stale_holds()` (manual en Fase 1
   vía endpoint interno; cron en Fase 2), liberando las fechas.

## Endpoints

| Método | Ruta                        | Descripción                                                            |
| ------ | --------------------------- | ---------------------------------------------------------------------- |
| `GET`  | `/api/properties`           | Lista publicadas. Filtros `featured`, `guests`, `checkIn`, `checkOut`. |
| `GET`  | `/api/properties/[slug]`    | Ficha: datos, imágenes, amenities, tarifas, disponibilidad.            |
| `POST` | `/api/bookings/quote`       | Cotiza precio server-side.                                             |
| `POST` | `/api/bookings`             | Crea prerreserva + hold. Devuelve `accessToken` (una vez).             |
| `GET`  | `/api/bookings/[bookingId]` | Requiere token válido o sesión del dueño.                              |
| `POST` | `/api/dev/expire-holds`     | Interno. 404 en producción. Header `x-dev-secret`.                     |

### `POST /api/bookings/quote`

Body: `{ propertyId, checkIn, checkOut, guestCount }`.
Respuesta: `{ currency, nights, subtotalMinor, ..., totalMinor, items[] }`.

### `POST /api/bookings`

Body: `{ propertyId, checkIn, checkOut, guestCount, guest: { name, email, phone? } }`.
Respuesta: `{ bookingId, bookingCode, status, currency, totalMinor,
holdExpiresAt, accessToken }`. `accessToken` no se puede recuperar después.

### `GET /api/bookings/[bookingId]`

Autorización: header `x-booking-token` o query `?token=` (comparación con
`timingSafeEqual` contra el hash), **o** sesión del dueño (`guest_id`). Sin
ninguno de los dos → `401`. Nunca se concede acceso solo por conocer el UUID.

## Token de acceso de invitado

- `randomBytes(32).toString("base64url")` (alta entropía).
- Se guarda `sha256(token)` en `bookings.access_token_hash`; el token en claro se
  entrega una sola vez en la respuesta de creación.
- Comparación en tiempo constante (`timingSafeEqual`).

## Códigos de error

Los errores SQL se traducen a errores de dominio con HTTP (`src/lib/errors.ts`):

| Código                        | HTTP | Causa                                        |
| ----------------------------- | ---- | -------------------------------------------- |
| `VALIDATION_ERROR`            | 400  | Body/params inválidos (Zod).                 |
| `UNAUTHORIZED_BOOKING_ACCESS` | 401  | Sin token válido ni sesión de dueño.         |
| `PROPERTY_NOT_FOUND`          | 404  | Propiedad inexistente.                       |
| `PROPERTY_NOT_PUBLISHED`      | 409  | Propiedad no publicada.                      |
| `BOOKING_CONFLICT`            | 409  | Fechas ya reservadas (exclusion constraint). |
| `BOOKING_EXPIRED`             | 410  | La prerreserva caducó.                       |
| `MINIMUM_NIGHTS`              | 422  | No cumple el mínimo de noches.               |
| `GUEST_CAPACITY`              | 422  | Supera la capacidad de huéspedes.            |
| `INTERNAL_ERROR`              | 500  | Cualquier otro. Sin stack trace al cliente.  |

## Pendiente Fase 2

Pago (BNB/QR), transición `hold active → converted` y `booking → confirmed`,
reenvío/rotación de token, notificaciones reales (email/WhatsApp), cancelaciones
y reembolsos.
