# Desarrollo local — RentaMar

## Requisitos

- Node.js y npm.
- Un proyecto Supabase (ya existe: `cxozsfrwyvncdfulkcbi`).

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá los valores:

```
NEXT_PUBLIC_SUPABASE_URL=https://cxozsfrwyvncdfulkcbi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable>
SUPABASE_SERVICE_ROLE_KEY=<server-only>
DEV_TASKS_SECRET=<secreto para los endpoints dev de holds y pagos>
PAYMENT_PROVIDER=mock
```

`PAYMENT_PROVIDER` selecciona el proveedor de pagos (Fase 2 solo soporta `mock`;
default `mock` si se omite). No es sensible.

`.env.local` está en `.gitignore`. Nunca subir claves al repo.

Si Supabase no está configurado, el landing hace **fallback** al array mock de
`src/lib/properties.ts` (solo en desarrollo; en producción un error no se oculta).

## Migraciones y seed

Las migraciones viven en `supabase/migrations/001…018` y ya están aplicadas al
proyecto remoto (`001…010` = Fase 1; `011…018` = Fase 2, pagos). Para un proyecto
nuevo, aplicarlas en orden y luego cargar `supabase/seed.sql` (4 propiedades,
8 amenities, una tarifa de temporada).

## Comandos

```
npm run dev        # servidor de desarrollo
npm run build      # build de producción
npm run start      # servir el build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # Prettier (escribe)
npm run test       # Vitest (unit + integración)
npm run test:watch # Vitest en modo watch
```

## Tests

- **Unitarios** (`src/**/*.test.ts`): `money`, `validation`. No requieren red.
- **Integración** (`tests/integration.test.ts`): golpea el Supabase remoto. Se
  **salta automáticamente** si faltan `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` o `SUPABASE_SERVICE_ROLE_KEY`. Usa el email
  marcador `itest@rentamar.test` y limpia sus datos al terminar.
- **Integración de pagos** (`tests/payments.integration.test.ts`): mismas
  condiciones de skip. Cubre creación/idempotencia, confirmación transaccional,
  expiración y RLS de pagos. Usa el email marcador `ptest@rentamar.test` y limpia
  sus datos al terminar.

`vitest.config.ts` carga `.env.local` con `loadEnv` para que la suite de
integración vea las credenciales.

## Probar el vencimiento de holds

Con `DEV_TASKS_SECRET` configurado y en desarrollo:

```
curl -X POST http://localhost:3000/api/dev/expire-holds \
  -H "x-dev-secret: $DEV_TASKS_SECRET"
```

Devuelve 404 en producción.

## Simular un pago (dev)

Con `DEV_TASKS_SECRET` configurado y en desarrollo, tras crear un pago (`POST
/api/bookings/[bookingId]/payments`) se mueve el estado del "banco" mock y luego
se verifica para confirmar la reserva:

```
# marca pagado en el banco mock (no confirma la reserva)
curl -X POST http://localhost:3000/api/dev/payments/$PID/mark-paid \
  -H "x-dev-secret: $DEV_TASKS_SECRET"

# verifica contra el proveedor → confirma la reserva
curl -X POST "http://localhost:3000/api/payments/$PID/verify?token=$TOKEN"

# barrido de pagos vencidos (libera fechas)
curl -X POST http://localhost:3000/api/dev/expire-payments \
  -H "x-dev-secret: $DEV_TASKS_SECRET"
```

Variantes: `mark-expired`, `mark-error`. Todos devuelven 404 en producción y no
usan el token de reserva. Ver `payments.md`.

## Regenerar tipos

Tras cambiar el esquema, regenerar `src/lib/supabase/types.ts` (Supabase MCP
`generate_typescript_types`). **Reaplicar el ajuste manual** de
`create_booking_with_hold.p_guest_phone` a `string | null` (el generador siempre
emite `string`, pero el parámetro SQL acepta NULL).

## Pendiente Fase 3

Supabase CLI para stack local, migraciones vía CLI, edge functions locales,
seed diferenciado por entorno, cron productivo para expiración.
