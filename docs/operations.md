# Runbook operativo

## Disponibilidad

Usar el calendario de `/admin/calendar` para bloqueos de mantenimiento, uso
interno o dueño. Los rangos son de entrada inclusiva y salida exclusiva. Un
bloqueo no puede solaparse con un hold o reserva vigente.

## Reservas y pagos

Solicitar un motivo para cancelar, expirar, enviar a revisión o confirmar una
reserva. La confirmación manual requiere doble confirmación en la interfaz y
está limitada a administradores. Nunca compartir tokens de acceso, datos raw de
proveedor o claves de idempotencia.

## Incidencias

Si una operación falla, conservar el `requestId` de auditoría y revisar la
bitácora con un administrador. No editar tablas administrativas manualmente ni
eliminar auditoría.
