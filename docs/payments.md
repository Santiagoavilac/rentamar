# Pagos — RentaMar (Fase 2)

Sistema de pagos interno con un **proveedor mock funcional** (QR de prueba real).
La arquitectura queda lista para enchufar BNB en Fase 3 sin reescribir la
orquestación. Todo el cobro se orquesta **server-side** con el cliente admin; los
RPC de pago solo los ejecuta `service_role`.

## Flujo

```
prerreserva (pending_payment, hold active)
  → crear pago         POST /api/bookings/[bookingId]/payments   → QR + pending
  → (simular en dev)   POST /api/dev/payments/[paymentId]/mark-paid
  → verificar          POST /api/payments/[paymentId]/verify     → confirma
  → reserva confirmed, hold active → converted, payment_status = paid
```

La confirmación real ocurre **siempre** por `verify` (una sola vía). Los endpoints
dev solo mueven el estado del "banco" mock, nunca confirman la reserva.

## Estados

- `payment_status`: `created | pending | paid | expired | error | cancelled | refunded | manual_review`
  - `created`: intento creado, aún sin datos del proveedor.
  - `pending`: QR adjuntado, esperando pago.
  - `paid`: confirmado (transaccional).
  - `expired`: venció sin pagarse.
  - `error`: el proveedor reportó error.
  - `manual_review`: inconsistencia (p. ej. mismatch de monto) — no se confirma.
- `booking_payment_status` (en `bookings`): `unpaid | pending | paid | expired | failed | refunded`.
  Resume el cobro; no duplica `booking.status` (ciclo de vida de la reserva).

## Idempotencia y anti-duplicado

Defensa en dos capas de base (no solo un `if` en TS):

1. **Índice único parcial** `payments_one_active_per_booking` sobre `(booking_id)
where status in ('created','pending')`: a lo sumo un pago activo por reserva.
2. **Lock de fila** en `create_payment_intent()`: `select ... for update` sobre la
   reserva serializa creaciones concurrentes; si ya hay un pago activo lo devuelve
   (`isNew: false`); si hay uno `paid`, señaliza `PAYMENT_ALREADY_PAID`.

Resultado: doble clic, refresh, dos pestañas, retries y creaciones simultáneas
convergen en **un solo pago**. La `idempotency_key` (unique) se genera en el
servidor por intento; el dedup real lo da la regla "un pago activo por reserva".

## Confirmación transaccional

`confirm_booking_payment(p_payment_id)` (`SECURITY DEFINER`, atómica):

- Lockea payment + booking. Valida monto (`amount_minor = total_minor`), payment no
  `paid`, booking `pending_payment`, hold `active` vigente.
- En éxito: payment `paid` (+`paid_at`), booking `confirmed` (+`confirmed_at`,
  `payment_status = paid`), hold `active → converted`, evento `payment_confirmed`.
- **Idempotente**: si ya está `paid`, devuelve el estado final sin duplicar.
- **Mismatch de monto**: marca `manual_review` en payment y booking y persiste el
  evento (no lanza excepción, para no perder el registro), devuelve `{ ok: false,
reason: 'PAYMENT_AMOUNT_MISMATCH' }`.
- **Hold vencido o estado inválido**: lanza `PAYMENT_INVALID_STATE` → rollback, sin
  confirmar.

## Proveedor mock = "banco externo" simulado

`MockPaymentProvider` (`src/lib/payments/mock-provider.ts`, server-only):

- `createPayment()` genera un `externalId` único, un **QR PNG real** (`qrcode`) a
  partir de `rentamar://mock-payment/{externalId}`, e inserta estado `pending` en
  la tabla privada `mock_payment_state`.
- `getPaymentStatus()` lee `mock_payment_state` (no depende del navegador).
- `simulate(externalId, status)` cambia ese estado (`paid | expired | error`) —
  lo invocan los endpoints dev. Misma interfaz que tendrá BNB.

`getPaymentProvider()` (factory) lee `PAYMENT_PROVIDER` (default `mock`; en Fase 2
solo `mock`). BNB se enchufa aquí en Fase 3 sin tocar `src/lib/payments.ts`.

## Expiración coordinada

Dos barridos que no se pisan:

- `expire_stale_payments()` gobierna reservas **con** pago: marca pagos vencidos
  como `expired` y, si la reserva sigue `pending_payment` sin otro pago activo,
  vence la reserva y libera el hold (fechas disponibles otra vez).
- `expire_stale_holds()` (reemplazada en Fase 2) barre **solo** reservas **sin**
  pago activo (abandono pre-pago).

## Polling

La página de pago hace polling de `GET /api/payments/[paymentId]/status` cada ~12 s
(estado interno, **no** llama al proveedor). La verificación real contra el
proveedor ocurre solo en `POST verify`, que además throttlea por
`last_provider_check_at` (intervalo mínimo) y tiene rate limit por IP.

## Endpoints

| Método | Ruta                                                                | Acceso                                         |
| ------ | ------------------------------------------------------------------- | ---------------------------------------------- |
| POST   | `/api/bookings/[bookingId]/payments`                                | dueño (sesión) o `x-booking-token` / `?token=` |
| POST   | `/api/payments/[paymentId]/verify`                                  | dueño o token                                  |
| GET    | `/api/payments/[paymentId]/status`                                  | dueño o token (polling)                        |
| POST   | `/api/dev/payments/[paymentId]/mark-paid\|mark-expired\|mark-error` | solo dev, `x-dev-secret`, sin token            |
| POST   | `/api/dev/expire-payments`                                          | solo dev, `x-dev-secret`                       |

La respuesta de creación incluye `qr.imageBase64` una vez; **nunca** `rawResponse`,
`idempotency_key` ni los `*_raw` del proveedor.

## Cómo simular un pago (dev)

```
# 1. Crear el pago (obtené paymentId de la respuesta)
curl -X POST "http://localhost:3000/api/bookings/$BID/payments?token=$TOKEN" \
  -H "content-type: application/json" -d '{"provider":"mock","method":"qr"}'

# 2. Marcar pagado en el "banco" mock
curl -X POST "http://localhost:3000/api/dev/payments/$PID/mark-paid" \
  -H "x-dev-secret: $DEV_TASKS_SECRET"

# 3. Verificar → confirma la reserva
curl -X POST "http://localhost:3000/api/payments/$PID/verify?token=$TOKEN"
```

## Reemplazar el mock por BNB (Fase 3)

Implementar `PaymentProvider` (`src/lib/payments/provider.ts`) con el cliente BNB y
registrarlo en `getPaymentProvider()`. La orquestación (`src/lib/payments.ts`), los
endpoints y la página no cambian.

## Pendiente Fase 3 (fuera de alcance)

BNB real, `accountId` / `authorizationId` / `QueryCompanyId` / token BNB, Railway,
IP fija, mTLS, webhooks con verificación de firma, reembolsos reales, facturación,
WhatsApp/emails, cron productivo, rate limit distribuido (Redis).
