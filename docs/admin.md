# Panel administrativo

El panel vive en `/admin` y requiere una sesión de Supabase con rol `admin` u
`operator`. No hay registro público de staff.

## Primer administrador

Con las variables de entorno de servidor configuradas, ejecutar una sola vez:

```bash
npx tsx scripts/create-admin.mts
```

El script crea el usuario de Auth y lo promueve a `admin`. No guardar la
contraseña ni la service role en documentación, commits o tickets.

## Roles

- `operator`: gestiona propiedades, tarifas, disponibilidad y la revisión de
  reservas/pagos.
- `admin`: además administra usuarios, roles, auditoría y confirmaciones
  manuales de reserva.

Fuera del panel hay tres roles operativos con su propia pantalla y su propio
login (`co_owner` en `/copropietarios`, `cleaner` en `/limpieza`, `guard` en
`/guardias`). Ninguno ve el panel.

Las autorizaciones se validan en el servidor. Ocultar un botón no reemplaza
esa validación.

## Operación

- Bloqueos y reservas se coordinan transaccionalmente en las RPC de Supabase.
- Cancelar una reserva pagada la deriva a `refund_required`; no genera un
  reembolso automático.
- Las imágenes se suben desde el servidor a `property-images`; se aceptan JPG,
  PNG y WebP de hasta 8 MB.
- Auditoría es append-only y sanitiza tokens, hashes, QR y respuestas raw.

## Control de acceso (`/admin/accesos`)

Nadie entra al condominio sin pasar antes por la oficina de RentaMar. Los tres
orígenes —alquileres del canal directo, solicitudes de afiliados y estadías de
copropietarios— aparecen solos en un único listado apenas quedan registrados; no
se cargan a mano y no cambia nada de esos flujos de alta.

- Sin aprobar, el grupo se ve **rojo** en `/guardias` y el guardia no lo deja pasar.
- Recepción marca las tres casillas (declaración jurada firmada, garantía dejada,
  manillas retiradas) y aprueba: el grupo pasa a **verde**. Permiso `access.review`,
  disponible también para `operator`.
- Quitar la aprobación lo devuelve a rojo en el acto.
- Los alquileres del canal directo solo guardan el titular y la cantidad de
  huéspedes: los nombres del resto se cargan en esta misma pantalla (reutiliza
  `set_booking_companions`) para que el guardia sepa a quién dejar entrar.

El guardia **solo consulta**: ve el listado del día, puede buscar por nombre o
carnet y no tiene ningún botón de edición. Su cuenta se crea en
`/admin/users?tab=guardias` (permiso `guard.manage`, solo admin).
