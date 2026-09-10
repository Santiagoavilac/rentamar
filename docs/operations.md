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

## Ingresos

Recepción marca a cada persona desde el detalle del registro (Registros → huéspedes,
afiliados o copropietarios). No se puede registrar el ingreso de un grupo sin
aprobación vigente en Control de acceso: primero la declaración, la garantía y las
manillas.

`/admin/ingresos` muestra los registros del día con fecha y hora, titular, teléfono y
fecha de salida, y se refresca solo mientras se mira hoy. "Descargar CSV" baja
exactamente lo que está en pantalla; abre en Excel con las tildes correctas.

Marcar a la persona equivocada se revierte con "Deshacer registro". Volver a marcar a
alguien actualiza la manilla pero **no** cambia la hora original: esa hora es un hecho
registrado.

## Huéspedes vetados

La lista está en `/admin/vetados` y es exclusiva de administradores. Desde que se
agrega a alguien, cualquier intento de registrarlo falla en los tres canales, sea
titular o acompañante. Se compara por documento ignorando mayúsculas, espacios,
puntos y guiones.

Quitar a alguien de la lista no borra el registro: queda quién lo vetó y hasta
cuándo. Los intentos bloqueados se ven al costado de la misma pantalla.
