# Reunión BNB — Integración pasarela QR (RentaMar)

Documento de preparación. Basado en la *Documentación de Servicios - Api Market (BNB, 2026)*
y en el estado actual del proyecto RentaMar.

---

## 1. Resumen en una frase

RentaMar ya tiene construida toda la lógica de cobro con QR (generación, espera,
confirmación, vencimiento, anti-duplicados) funcionando contra un banco simulado.
Lo único que falta es **cambiar el banco simulado por el BNB real**. No hay que
reescribir el sistema: hay que enchufar credenciales y direcciones.

---

## 2. Qué ofrece el BNB (lo que dice su documentación)

El BNB expone 6 servicios web. Todos se llaman por HTTPS con un token de seguridad
en la cabecera.

| # | Servicio | Para qué sirve | ¿Lo usamos? |
|---|----------|----------------|-------------|
| 1 | `auth/token` | Genera el token de seguridad (vale para todas las demás llamadas) | **Sí**, obligatorio |
| 2 | `auth/UpdateCredentials` | Cambiar la contraseña que da el banco | **Sí**, una sola vez, es obligatorio antes de empezar |
| 3 | `getQRWithImageAsync` | Genera el QR de cobro y devuelve la imagen | **Sí**, es el corazón |
| 4 | `getQRStatusAsync` | Consulta si un QR ya fue pagado | **Sí** |
| 5 | `getQRbyGenerationDateAsync` | Lista todos los QR de un día | **Sí**, para conciliación diaria |
| 6 | `CancelQRByIdAsync` | Anula un QR antes de que se pague | **Sí**, cuando la reserva vence |

Además, el BNB **nos llama a nosotros** cuando alguien paga: el servicio
`ReceiveNotification`. Eso lo tenemos que exponer nosotros y darles la URL.

### Datos que el BNB envía al generar un QR
`currency` (BOB/USD), `gloss` (descripción — usaremos el ID de reserva),
`amount`, `singleUse` (QR de un solo uso), `expirationDate`, `additionalData`
(campo libre — usaremos nuestro ID interno de pago), `destinationAccountId`
(1 = cuenta en bolivianos, 2 = cuenta en dólares).

### Estados de un QR según el BNB
`1 = No usado` · `2 = Usado` · `3 = Expirado` · `4 = Con error`

Y cuando se paga, devuelve un `voucherId` — el código de bancarización, que es
nuestro comprobante contable.

---

## 3. Qué hay que implementar de nuestro lado

Está todo mapeado. Son 5 piezas de trabajo:

**A. Cliente BNB.** Un módulo que traduce las llamadas del BNB a lo que nuestro
sistema ya entiende. Nuestro código ya define un "contrato" de proveedor de pago
con dos operaciones: *crear pago* y *consultar estado*. El BNB encaja directo:

| Nuestro contrato | Servicio BNB |
|---|---|
| `createPayment()` | `getQRWithImageAsync` |
| `getPaymentStatus()` | `getQRStatusAsync` |

**B. Gestión del token.** El token del BNB caduca (su ejemplo trae un campo de
expiración). Hay que guardarlo en memoria y renovarlo automáticamente, y
reintentar la llamada si el banco responde "no autorizado".

**C. Endpoint de notificación (`ReceiveNotification`).** Publicar una URL nuestra
que el BNB llame cuando entra un pago. Debe responder `{"success": true, "message": "OK"}`.
Esto hace que la reserva se confirme al instante en vez de esperar a que el
cliente refresque la página.
→ **Este es el punto que más hay que aclarar con el BNB** (ver sección 4).

**D. Cancelación de QR.** Hoy, cuando una reserva vence, liberamos las fechas.
Con el BNB hay que además llamar a `CancelQRByIdAsync` para que ese QR quede
muerto en el banco y nadie pueda pagarlo tarde.

**E. Conciliación diaria.** Un proceso automático que una vez al día llame a
`getQRbyGenerationDateAsync` y compare lo que dice el banco contra lo que dice
nuestra base. Si algo no cuadra, se marca para revisión manual. Es la red de
seguridad si una notificación se pierde.

### Riesgos técnicos ya detectados

1. **La documentación usa `http://` (no `https://`) para el ambiente de prueba.**
   Hay que confirmar que producción sea HTTPS. Enviar credenciales por HTTP sin
   cifrar no es aceptable en producción.
2. **Inconsistencia en la documentación del token.** El cuerpo del ejemplo dice
   `accountId`/`authorizationId`, pero el ejemplo de `curl` de la misma página
   dice `username`/`password`. Hay que confirmar cuál es el correcto.
3. **La notificación no trae firma ni autenticación.** Tal como está documentada,
   cualquiera que descubra nuestra URL podría enviarnos una notificación falsa de
   pago. Necesitamos que el BNB nos diga cómo validamos que la llamada es de
   ellos. **Es el punto más importante de seguridad de toda la integración.**
   (Nuestra mitigación: nunca confiar en la notificación como prueba de pago —
   siempre re-consultamos `getQRStatusAsync` antes de confirmar la reserva.)

---

## 4. Qué necesitamos del BNB — checklist para la reunión

Imprimí esta lista y pedí respuesta a cada punto.

### Credenciales y acceso
- [ ] `accountId` y `authorizationId` **de prueba** (ambiente test)
- [ ] `accountId` y `authorizationId` **de producción**
- [ ] Confirmar: en el servicio de token, ¿los campos se llaman `accountId`/`authorizationId` o `username`/`password`? (la documentación se contradice)
- [ ] ¿Cómo nos entregan las credenciales de forma segura? (no por correo en texto plano)

### Direcciones (URLs)
- [ ] URL base de **producción** — la documentación solo muestra `test.bnb.com.bo`
- [ ] Confirmar que producción es **HTTPS** y no HTTP
- [ ] ¿El certificado es público o hay que instalar uno propio del banco?

### Token
- [ ] ¿Cuánto dura el token antes de expirar?
- [ ] ¿Hay límite de cuántos tokens se pueden pedir por hora/día?
- [ ] ¿Qué código de error devuelven cuando el token venció?

### Cuenta de abono
- [ ] Confirmar el número de cuenta BNB de RentaMar donde caen los pagos
- [ ] Confirmar que `destinationAccountId = 1` corresponde a nuestra cuenta en bolivianos
- [ ] ¿Habilitamos también cobro en dólares (posición 2)? ¿Requiere otra cuenta?

### Notificación de pagos (`ReceiveNotification`)
- [ ] ¿Cómo validamos que la notificación viene realmente del BNB? ¿Firma, clave secreta, o solo lista blanca de IPs?
- [ ] ¿Desde qué **IPs** salen las llamadas del BNB? (para permitirlas en nuestro firewall)
- [ ] ¿Reintentan si nuestro servidor no responde? ¿Cuántas veces y cada cuánto?
- [ ] ¿Cuánto tiempo esperan nuestra respuesta antes de darla por fallida?
- [ ] ¿Cómo registramos/actualizamos nuestra URL de notificación? ¿Se puede tener una para test y otra para producción?

### Restricciones operativas
- [ ] ¿El BNB exige que llamemos desde una **IP fija**? (afecta dónde alojamos el sistema)
- [ ] ¿Piden certificado cliente / mTLS?
- [ ] ¿Hay límite de cuántos QR podemos generar por minuto/día?
- [ ] ¿Monto mínimo y máximo por QR?
- [ ] ¿Cuál es el plazo máximo de expiración que acepta un QR? (nuestras reservas retienen fechas por tiempo limitado)

### Devoluciones y contabilidad
- [ ] ¿Existe API de **reversión/devolución**? La documentación no la incluye. Si no existe, ¿cuál es el procedimiento manual?
- [ ] El `voucherId` (código de bancarización) — ¿sirve como respaldo para facturación?
- [ ] ¿Nos dan acceso a un portal para ver los cobros de forma independiente?

### Comercial y proceso
- [ ] Comisión por transacción y costo de la integración
- [ ] Plazo de acreditación del dinero en cuenta (¿mismo día, T+1?)
- [ ] ¿Qué contrato/documentación legal hay que firmar antes de tener credenciales?
- [ ] ¿Hay proceso de certificación? ¿Nos aprueban las pruebas antes de pasar a producción?
- [ ] Canal y horario de **soporte técnico** cuando algo falle en producción
- [ ] Contacto técnico directo (nombre, correo, teléfono)

---

## 5. Arquitectura del proyecto — para explicar al BNB

### En lenguaje simple

RentaMar es una plataforma web de alquiler de propiedades vacacionales. El
recorrido de un cliente es:

1. Elige una propiedad y fechas → el sistema calcula el precio
2. Crea una **prerreserva**: las fechas quedan bloqueadas temporalmente para que
   nadie más las tome
3. Se le muestra un **QR** para pagar
4. Paga desde su app bancaria
5. La reserva pasa a **confirmada** y las fechas quedan tomadas en firme
6. Si no paga a tiempo, el QR vence, la reserva se anula y las fechas se liberan

El QR es hoy simulado. Con el BNB, el paso 3 y 4 pasan a ser reales.

### Componentes técnicos

| Capa | Tecnología |
|---|---|
| Sitio web y servidor | **Next.js 15** (React 19, TypeScript) |
| Base de datos | **PostgreSQL** gestionado por **Supabase** |
| Seguridad de datos | Row Level Security a nivel de base de datos |
| Generación de QR | Librería `qrcode` (se reemplaza por la imagen del BNB) |

### Puntos que probablemente el BNB pregunte

**¿Dónde se ejecuta el código que llama al banco?**
En el servidor, nunca en el navegador del cliente. Las credenciales del BNB
nunca salen del servidor ni viajan al dispositivo del usuario.

**¿Cómo guardan las credenciales?**
Como variables de entorno del servidor, fuera del código fuente. Ya existe esa
separación: hoy hay claves de base de datos manejadas así.

**¿Cómo evitan cobrar dos veces al mismo cliente?**
Hay dos defensas a nivel de base de datos, no solo en el programa:
- Un índice único que impide que exista más de un pago activo por reserva
- Un bloqueo de fila que serializa los intentos simultáneos
Resultado: doble clic, refresh o dos pestañas abiertas producen **un solo pago**.

**¿Cómo confirman una reserva?**
Con una operación transaccional atómica: o se hace todo (pago pagado + reserva
confirmada + fechas tomadas) o no se hace nada. No puede quedar a medias.
Antes de confirmar valida que el **monto pagado coincida exactamente** con el
monto de la reserva; si no coincide, no confirma y lo marca para revisión manual.

**¿Guardan las respuestas del banco?**
Sí. Cada pago guarda la respuesta cruda del proveedor (`create_response_raw`,
`last_status_response_raw`) para auditoría y disputas. Esos datos nunca se
exponen al cliente final.

**¿Consultan al banco constantemente?**
No. La página del cliente consulta **nuestro** estado interno cada ~12 segundos.
La consulta real al banco solo ocurre en momentos puntuales y está limitada por
un intervalo mínimo entre consultas y por límite de peticiones por IP. No vamos a
saturar sus servicios.

**¿Qué pasa si una notificación se pierde?**
Tres redes de seguridad: (1) verificación bajo demanda contra el banco,
(2) proceso automático de expiración, (3) conciliación diaria contra
`getQRbyGenerationDateAsync`.

**¿Registran quién hizo qué?**
Sí, hay tabla de auditoría y de eventos de reserva. Las IPs se guardan
enmascaradas con salt, no en claro.

### Cómo está preparado el código para el BNB

El sistema define un **contrato de proveedor de pago** con dos operaciones.
Hoy lo cumple un proveedor simulado; mañana lo cumplirá el BNB. Se cambia una
variable de configuración (`PAYMENT_PROVIDER=bnb`) y el resto del sistema —
pantallas, endpoints, base de datos, lógica de reservas — **no se toca**.

Archivos relevantes:
- `src/lib/payments/provider.ts` — el contrato
- `src/lib/payments/factory.ts` — el selector de proveedor
- `src/lib/payments/mock-provider.ts` — el simulado (a reemplazar)
- `src/lib/payments.ts` — la orquestación (no cambia)
- `supabase/migrations/012_payments.sql` — la tabla de pagos

---

## 6. Plan de trabajo propuesto (a acordar con el BNB)

| Etapa | Qué pasa | Depende de |
|---|---|---|
| 1 | BNB entrega credenciales de test | Contrato firmado |
| 2 | Cambiamos la contraseña inicial (`UpdateCredentials`) | Etapa 1 |
| 3 | Generamos y pagamos QR de prueba de punta a punta | Etapa 2 |
| 4 | Publicamos la URL de notificación y probamos que el BNB nos llegue | Confirmar seguridad de la notificación |
| 5 | Certificación / aprobación del BNB | Etapa 4 |
| 6 | Credenciales de producción y salida en vivo | Etapa 5 |

---

## 7. Los 5 puntos que no podés salir de la reunión sin resolver

1. **Credenciales de test** — sin esto no se puede empezar nada
2. **URL de producción y confirmación de HTTPS**
3. **Cómo validamos que la notificación de pago es auténtica** (firma o IPs)
4. **Si exigen IP fija o certificado cliente** — define dónde alojamos el sistema
5. **Si existe API de devoluciones** — y si no, cuál es el procedimiento
