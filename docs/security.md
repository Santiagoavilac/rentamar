# Seguridad — RentaMar (Fase 1)

## Secretos y variables de entorno

- `.env.local` (gitignored) contiene los valores reales. `.env.example` solo
  lleva placeholders.
- **Ninguna variable sensible usa el prefijo `NEXT_PUBLIC_`.** Ese prefijo
  expone el valor al bundle del navegador.

| Variable                        | Ámbito                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Público (URL del proyecto).                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Público (clave anónima, protegida por RLS).                             |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Solo servidor.** Nunca al cliente.                                    |
| `DEV_TASKS_SECRET`              | Solo servidor. Protege los endpoints dev de holds y pagos.              |
| `PAYMENT_PROVIDER`              | Solo servidor. Selecciona el proveedor (`mock` en Fase 2). No sensible. |

## Service role

- Se usa solo en `src/lib/supabase/admin.ts`, que empieza con `import
"server-only"`. Cualquier import accidental desde un componente cliente rompe
  el build.
- Verificado: la clave no aparece en `.next/static` tras `npm run build`.
- El cliente admin (bypass de RLS) se usa únicamente en código server-side:
  orquestación de reservas y acceso autorizado a una reserva.

## RLS (Row Level Security)

Activa en las 9 tablas públicas. Sin `using(true)` en tablas sensibles.

- **anon (público):** lee `properties` publicadas y sus `property_images`,
  `amenities`, `property_amenities`, `property_rates`. No lee `bookings`,
  `booking_holds`, `booking_price_items` ni `profiles` ajenos.
- **authenticated:** lee su `profile` y sus propias reservas. No puede cambiar
  montos, estados ni su propio `role` (trigger `enforce_profile_role_immutable`).
- **admin/operator (`is_staff()`):** administran propiedades, tarifas,
  disponibilidad y revisan reservas.
- Los `bookings` se insertan solo por `create_booking_with_hold()`
  (`SECURITY DEFINER`), no por `INSERT` directo del cliente.

### Pagos (Fase 2)

- `payments`: `authenticated` lee solo los pagos de sus propias reservas
  (`booking.guest_id = auth.uid()`). Las columnas sensibles
  (`create_response_raw`, `last_status_response_raw`, `idempotency_key`) tienen
  `SELECT` revocado a anon/authenticated. Los pagos de invitado se acceden por
  token vía cliente admin server-only.
- `payment_events` y `mock_payment_state`: solo staff/servicio. El público no lee.
- Sin `INSERT`/`UPDATE` para anon/authenticated: todo pasa por RPC / cliente admin.

## Funciones SECURITY DEFINER

Todas fijan `search_path`. Superficie pública **intencional** (camino de reservas
de invitado, validan todo internamente): `calculate_booking_price`,
`create_booking_with_hold`, `get_property_availability`. `expire_stale_holds` y
**todos los RPC de pago** (`create_payment_intent`, `attach_payment_provider_data`,
`confirm_booking_payment`, `record_payment_error`, `expire_payment`,
`expire_stale_payments`) solo los ejecuta service_role — `EXECUTE` revocado a
`public`, `anon` y `authenticated`. `is_admin`/`is_staff` quedan ejecutables porque
las políticas RLS los invocan; las funciones de trigger tienen `EXECUTE` revocado.

Los advisors de seguridad de Supabase reportan las funciones de superficie pública
intencional como WARN ("Public Can Execute SECURITY DEFINER Function"); son
**esperados y documentados**, no hallazgos críticos. Tras Fase 2, los RPC de pago
**ya no aparecen** en ese listado (verificado con `get_advisors`).

## Entrada y salida

- Validación con Zod en el borde (UUID, fechas `YYYY-MM-DD`, email, teléfono,
  longitudes, `guestCount`). Ver `src/lib/validation.ts`.
- `parseJsonBody` exige `Content-Type: application/json` y limita el body a 16 KB.
- **Sin mass assignment:** columnas explícitas en cada `select`; el cliente no
  puede inyectar `totalMinor` ni otros montos (test lo cubre).
- **Sin fuga de detalles:** los errores internos se mapean a `INTERNAL_ERROR`
  500 sin stack trace. Los logs no incluyen tokens ni PII completa.
- **Rate limiting** en memoria para `quote` y `create booking`
  (`src/lib/rate-limit.ts`). Suficiente para Fase 1; en Fase 2 debe ser
  distribuido (p. ej. Redis) si hay múltiples instancias.

## Tokens

Token de acceso de invitado: alta entropía, guardado como `sha256`, entregado en
claro una sola vez, comparado en tiempo constante. Ver `bookings.md`.

## Pendiente Fase 2

Rate limit distribuido, verificación de firma de webhooks de pago, rotación de
secretos, auditoría de accesos, mTLS/IP fija para el proveedor de pagos.

## Guardias y control de acceso

El rol `guard` tiene su propio login (`/guardias/login`, usuario → email interno
derivado) y una sola pantalla, de solo lectura. No lee ninguna tabla directamente:
`guard_accounts` le muestra únicamente su propia fila, `access_approvals` es de
staff, y todo lo que ve pasa por `list_access_entries`, que filtra las columnas
sensibles antes de devolverlas y corta con `FORBIDDEN` si el que llama no es
guardia ni staff.

Escribir (aprobar, quitar la aprobación, cargar acompañantes) es exclusivo del
panel: `approve_access` y `revoke_access` solo tienen `execute` para
`service_role`, y las server actions revalidan `access.review` con
`assertAdminAction` antes de llamarlas.

## Fotos de carnet, ingresos y vetados

- **`id-documents`** sigue siendo un bucket privado sin políticas de escritura: sube
  siempre el servidor con service_role, y al panel se le entregan URLs firmadas de
  10 minutos. Subir requiere `declaration.read` (recepción tiene el carnet en la
  mano); **borrar es admin-only**, porque destruye evidencia.
- **`access_checkins`**: `select` solo `is_staff()`, sin políticas de escritura. El
  guardia no lee esta tabla — lo que necesita saber le llega dentro de
  `list_access_entries`, que sigue sin devolver teléfonos, correos, montos ni
  tokens. El teléfono lo devuelve `list_office_checkins`, que corta con `FORBIDDEN`
  si el que llama no es staff y no está expuesta al rol `guard`.
- **`banned_guests` / `banned_guest_attempts`**: `select` solo `is_staff()`.
  `assert_not_banned` y `normalize_document` tienen `EXECUTE` revocado a `anon` y
  `authenticated`: expuestas serían un oráculo para averiguar quién está en la lista.
  Al público nunca se le dice que una persona está vetada ni por qué; recibe un
  mensaje genérico y el detalle queda en el panel.
- Los intentos guardan la IP **hasheada** con `AUDIT_IP_SALT`, nunca en claro, igual
  que la bitácora.
