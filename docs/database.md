# Base de datos — RentaMar (Fase 1)

Proyecto Supabase: `cxozsfrwyvncdfulkcbi`. Postgres con extensiones `pgcrypto` y
`btree_gist`. Toda la lógica de negocio sensible vive en la base (constraints,
funciones `SECURITY DEFINER`, RLS), no en la aplicación.

## Convenciones

- **Dinero en unidad menor** (`*_minor`, entero). `Bs 500,00` → `50000`. Nunca
  `float`. Moneda por defecto `BOB`.
- **Fechas de estadía**: rango semiabierto `[check_in, check_out)`. La salida el
  día X no colisiona con una entrada el día X.
- Solo `properties.status = 'published'` es visible al público.

## Tablas

| Tabla                 | Rol                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `profiles`            | Perfil ligado a `auth.users`. `role` ∈ (`guest`, `admin`, `operator`).                                    |
| `properties`          | Propiedad comercializable. Precio base, capacidad, mínimo de noches, estado.                              |
| `property_images`     | Imágenes por propiedad. Índice parcial: una sola `is_cover`.                                              |
| `amenities`           | Catálogo de comodidades.                                                                                  |
| `property_amenities`  | N:M propiedad↔comodidad (PK compuesta).                                                                   |
| `property_rates`      | Tarifas por temporada. Exclusion constraint anti-solapamiento por propiedad.                              |
| `bookings`            | Reserva/prerreserva. Guarda `access_token_hash` (nunca el token en claro).                                |
| `booking_price_items` | Desglose de precio por reserva (noches, limpieza, servicio, descuento).                                   |
| `booking_holds`       | **Fuente de verdad del calendario.** Un hold por booking, con `stay_range daterange`.                     |
| `payments`            | Pagos (Fase 2). `amount_minor bigint > 0`, `idempotency_key` unique, índice único parcial de pago activo. |
| `payment_events`      | Bitácora append-only de eventos de pago (nunca se borra ni actualiza).                                    |
| `mock_payment_state`  | Backing store privado del proveedor mock (emula el banco externo). No es dominio RentaMar.                |

`bookings` incorpora en Fase 2 la columna `payment_status`
(`booking_payment_status`, default `unpaid`).

## Enums

- `property_status`: `draft | published | paused | archived`
- `booking_status`: `draft | pending_payment | confirmed | expired | cancelled | completed | manual_review`
- `hold_status`: `active | converted | expired | released`
- `price_item_type`: `nightly_rate | cleaning_fee | service_fee | discount`
- `user_role`: `guest | admin | operator`
- `payment_status`: `created | pending | paid | expired | error | cancelled | refunded | manual_review`
- `payment_provider`: `mock | bnb`
- `payment_method`: `qr`
- `payment_event_source`: `create | browser_poll | manual_verify | cron | admin | reconciliation`
- `booking_payment_status`: `unpaid | pending | paid | expired | failed | refunded`

## Precio por noche

Para cada noche, si cae dentro de una `property_rate` vigente se usa
`nightly_price_minor`; si no, `properties.base_price_minor`. El cálculo agrupa
noches por precio y arma los `booking_price_items`. Se ejecuta **siempre en el
servidor** vía `calculate_booking_price()`; el cliente nunca envía montos.

## Prevención de doble reserva

`booking_holds` es la única fuente de verdad de disponibilidad. La regla se
aplica a nivel de base con un exclusion constraint GiST:

```sql
EXCLUDE USING gist (property_id WITH =, stay_range WITH &&)
  WHERE (status IN ('active','converted'))
```

- `active` = prerreserva (`pending_payment`) → bloquea.
- `converted` = reserva confirmada → sigue bloqueando.
- `expired` / `released` = no bloquea.

La creación de `booking` + `booking_price_items` + `booking_holds` ocurre dentro
de la función transaccional `create_booking_with_hold()`. No hay ventana de
carrera entre validar y crear: si dos solicitudes compiten por las mismas fechas,
el constraint rechaza la segunda (`exclusion_violation`, SQLSTATE `23P01`) y la
transacción hace rollback. La función traduce eso a `BOOKING_CONFLICT`.

## Funciones

| Función                                                                       | Seguridad | Expuesta a                        |
| ----------------------------------------------------------------------------- | --------- | --------------------------------- |
| `calculate_booking_price(property, check_in, check_out, guests)`              | DEFINER   | anon, authenticated, service_role |
| `create_booking_with_hold(...)`                                               | DEFINER   | anon, authenticated, service_role |
| `get_property_availability(property, from, to)`                               | DEFINER   | anon, authenticated, service_role |
| `expire_stale_holds()`                                                        | DEFINER   | solo service_role                 |
| `generate_booking_code()`                                                     | DEFINER   | interna (código `RM-YYYY-NNNNNN`) |
| `is_admin()` / `is_staff()`                                                   | DEFINER   | usadas por políticas RLS          |
| `set_updated_at()` / `handle_new_user()` / `enforce_profile_role_immutable()` | DEFINER   | solo triggers                     |
| `create_payment_intent(...)`                                                  | DEFINER   | **solo service_role**             |
| `attach_payment_provider_data(...)`                                           | DEFINER   | **solo service_role**             |
| `confirm_booking_payment(payment)`                                            | DEFINER   | **solo service_role**             |
| `record_payment_error(...)`                                                   | DEFINER   | **solo service_role**             |
| `expire_payment(payment)`                                                     | DEFINER   | **solo service_role**             |
| `expire_stale_payments()`                                                     | DEFINER   | **solo service_role**             |

Todas fijan `search_path` explícito. Las funciones de trigger tienen `EXECUTE`
revocado a `public/anon/authenticated`. Los RPC de pago revocan `EXECUTE` a
`public`, `anon` y `authenticated` (los grants por default de Supabase otorgan
`EXECUTE` a anon/authenticated en funciones nuevas; se revoca explícitamente). Ver
`payments.md`.

## RLS

Ver `security.md`. Resumen: público lee solo propiedades publicadas (y sus
imágenes/amenities/rates); nadie lee `bookings`/`booking_holds`/
`booking_price_items` de forma anónima; los bookings se insertan solo por la RPC
`SECURITY DEFINER`, no por `INSERT` directo.

## Migraciones

`supabase/migrations/001…018`. Versionadas en el repo y aplicadas al proyecto
remoto. `001…010` = Fase 1; `011…018` = Fase 2 (pagos). `supabase/seed.sql` carga
4 propiedades, 8 amenities y una tarifa de temporada de ejemplo.

## Pendiente Fase 3

BNB real, webhooks, reembolsos, cron productivo para `expire_stale_payments` /
`expire_stale_holds`, tarifas y disponibilidad administradas por panel, histórico
de precios. Ver `payments.md`.
