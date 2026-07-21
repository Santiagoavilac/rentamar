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

Las autorizaciones se validan en el servidor. Ocultar un botón no reemplaza
esa validación.

## Operación

- Bloqueos y reservas se coordinan transaccionalmente en las RPC de Supabase.
- Cancelar una reserva pagada la deriva a `refund_required`; no genera un
  reembolso automático.
- Las imágenes se suben desde el servidor a `property-images`; se aceptan JPG,
  PNG y WebP de hasta 8 MB.
- Auditoría es append-only y sanitiza tokens, hashes, QR y respuestas raw.
