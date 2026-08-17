// Ayuda contextual del panel. Módulo puro (sin server-only) porque lo consume el
// botón "?" , que es un componente cliente.
//
// Convención de claves: `area.pantalla.seccion`. La pantalla completa usa
// `area.page` (o `area.detail` cuando es el detalle de un registro) y cada bloque
// interno cuelga de ahí. Se escribe en español, tuteando, como el resto del panel.

export type HelpBlock =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "lista"; items: string[] }
  | { tipo: "pasos"; items: string[] }
  | { tipo: "aviso"; texto: string };

export type HelpEntry = {
  /** Título del panel de ayuda. */
  title: string;
  /** Una o dos líneas: es lo que se ve al pasar el mouse. */
  short: string;
  /** Explicación larga, en bloques. */
  long: HelpBlock[];
};

export const HELP = {
  // ---------- Resumen ----------
  "dashboard.page": {
    title: "Centro operativo",
    short: "El tablero del día: cuánto entró, qué está pendiente y qué necesita que alguien actúe.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Es la primera pantalla del panel y resume el estado real del negocio en este momento. No se edita nada acá: cada tarjeta es un atajo a la pantalla donde sí se trabaja.",
      },
      { tipo: "subtitulo", texto: "Cómo leerla" },
      {
        tipo: "lista",
        items: [
          "Las cuatro tarjetas de arriba cuentan reservas y pagos por estado. Sirven para saber si hay cola de trabajo.",
          "Los bloques de abajo abren cada tema: ingresos, afiliados, catálogo, llegadas y pendientes.",
          "Los números se calculan en el momento en que se carga la página. Si acabás de confirmar algo, recargá para verlo reflejado.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Lo que ves depende de tu rol. Un operator no ve las secciones reservadas a administradores.",
      },
    ],
  },
  "dashboard.revenue": {
    title: "Ingresos confirmados",
    short: "Suma del dinero de las reservas ya confirmadas o completadas. No incluye lo pendiente.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Es la plata que podés dar por hecha: solo suma reservas en estado confirmada o completada.",
      },
      { tipo: "subtitulo", texto: "Qué NO entra en este número" },
      {
        tipo: "lista",
        items: [
          "Reservas pendientes de pago: todavía pueden vencerse y liberar las fechas.",
          "Solicitudes de afiliados sin confirmar: bloquean el calendario pero no son ingreso.",
          "Reservas canceladas o vencidas.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Si el número te parece bajo, revisá Pagos: seguramente hay comprobantes esperando revisión que todavía no se convirtieron en reservas confirmadas.",
      },
    ],
  },
  "dashboard.affiliates": {
    title: "Solicitudes de afiliados",
    short: "Pedidos de afiliados sin resolver. Bloquean fechas pero no cuentan como ingreso.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "El canal de afiliados es anónimo: alguien pide fechas desde /afiliados y esas fechas quedan bloqueadas hasta que un administrador confirme o cancele la solicitud.",
      },
      {
        tipo: "aviso",
        texto:
          "Mientras una solicitud está pendiente, esas noches no se pueden vender a nadie más. Conviene resolverlas rápido para no perder disponibilidad.",
      },
      {
        tipo: "parrafo",
        texto: "Entrá a Afiliados para ver el carnet, los acompañantes y decidir.",
      },
    ],
  },
  "dashboard.published": {
    title: "Propiedades publicadas",
    short: "Cuántas propiedades están visibles y reservables en la web pública.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Solo las propiedades en estado publicada aparecen en el sitio y aceptan reservas. Las que están en borrador, pausadas o archivadas no se muestran ni se pueden cotizar.",
      },
      {
        tipo: "parrafo",
        texto:
          "Si cargaste una propiedad y no aparece en la web, este es el primer lugar donde mirar: casi siempre quedó en borrador.",
      },
    ],
  },
  "dashboard.arrivals": {
    title: "Próximas llegadas",
    short: "Los check-in que vienen, para preparar limpieza y recepción.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Lista las reservas cuyo ingreso está por ocurrir, ordenadas por fecha. Es la vista rápida para coordinar la operación del día.",
      },
      {
        tipo: "lista",
        items: [
          "Para el detalle completo del huésped, entrá a la reserva.",
          "Para ver entradas y salidas junto con el trabajo de limpieza, usá la pantalla Limpieza.",
        ],
      },
    ],
  },
  "dashboard.attention": {
    title: "Requieren atención",
    short: "Reservas o pagos trabados que no avanzan solos: alguien tiene que intervenir.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Junta los casos que el sistema no puede resolver por su cuenta y quedarían olvidados: pagos en revisión manual, reservas marcadas para revisar, devoluciones pendientes.",
      },
      { tipo: "subtitulo", texto: "Qué hacer" },
      {
        tipo: "pasos",
        items: [
          "Abrí el caso desde el enlace.",
          "Revisá el historial para entender por qué quedó trabado.",
          "Resolvé desde el bloque Operaciones de esa pantalla, dejando siempre el motivo.",
        ],
      },
      {
        tipo: "aviso",
        texto: "Todo lo que hagas queda registrado en Auditoría con tu usuario y el motivo.",
      },
    ],
  },

  // ---------- Disponibilidad ----------
  "calendar.page": {
    title: "Disponibilidad y reservas",
    short: "El calendario de todas las propiedades: quién ocupa qué noches y qué está bloqueado.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Es la vista central de ocupación. Muestra en una sola grilla las reservas, las solicitudes de afiliados que bloquean fechas y los bloqueos administrativos (mantenimiento, uso interno, uso del dueño).",
      },
      { tipo: "subtitulo", texto: "Cómo se usa" },
      {
        tipo: "pasos",
        items: [
          "Elegí el mes y, si querés, filtrá por propiedad o por estado.",
          "Cambiá entre Calendario (grilla por noches) y Lista (tabla ordenada) según lo que necesites.",
          "Hacé clic y arrastrá sobre las noches libres de una propiedad para crear una pre-reserva o un bloqueo.",
          "Hacé clic sobre un registro existente para editarlo, moverlo o liberarlo.",
        ],
      },
      { tipo: "subtitulo", texto: "Cosas importantes" },
      {
        tipo: "lista",
        items: [
          "Se cuentan noches, no días: una estadía del viernes al domingo ocupa las noches del viernes y del sábado, y el domingo queda libre para que entre otro huésped.",
          "El sistema no deja superponer dos registros sobre la misma noche: si chocan, se rechaza la operación entera.",
          "Liberar un bloqueo no lo borra del historial: queda registrado quién lo liberó y por qué.",
        ],
      },
    ],
  },

  // ---------- Reservas ----------
  "bookings.detail.charges": {
    title: "Detalle de cobro",
    short: "El desglose del precio con el que se cerró la reserva, noche por noche.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Muestra cómo se armó el total: cuántas noches, a qué precio cada una, si hubo tarifa estacional, recargo de fin de semana o descuento por cantidad de noches.",
      },
      {
        tipo: "aviso",
        texto:
          "Estos importes quedan congelados al momento de reservar. Si después cambiás el precio base o el recargo, esta reserva no cambia: el huésped paga lo que se le cotizó.",
      },
      {
        tipo: "parrafo",
        texto:
          "El precio nunca lo manda el navegador: se calcula en el servidor con la misma función que usa la web pública, así que no se puede manipular desde afuera.",
      },
    ],
  },
  "bookings.detail.operations": {
    title: "Operaciones de la reserva",
    short:
      "Las acciones que podés ejecutar sobre esta reserva: cancelar, revisar, confirmar a mano.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Cada botón ejecuta un cambio de estado real y libera o retiene las fechas según corresponda.",
      },
      { tipo: "subtitulo", texto: "Qué hace cada acción" },
      {
        tipo: "lista",
        items: [
          "Cancelar: da de baja la reserva y libera las noches para que se puedan vender de nuevo.",
          "Vencer: se usa cuando el huésped nunca pagó dentro del plazo.",
          "Enviar a revisión manual: la deja marcada para que alguien la mire con calma, sin liberar las fechas.",
          "Confirmar a mano: confirma sin comprobante validado. Solo administradores.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "El motivo es obligatorio en las acciones sensibles y queda guardado en Auditoría junto con tu usuario.",
      },
    ],
  },
  "bookings.detail.history": {
    title: "Historial de la reserva",
    short: "Todo lo que le pasó a esta reserva, en orden, con quién lo hizo.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Registro cronológico de eventos: creación, pagos, cambios de estado, cancelaciones. Sirve para reconstruir qué pasó cuando un huésped reclama.",
      },
      {
        tipo: "parrafo",
        texto: "No se puede editar ni borrar. Es la fuente de verdad ante cualquier duda.",
      },
    ],
  },

  // ---------- Limpieza ----------
  "cleaning.page": {
    title: "Limpieza",
    short: "El movimiento del día para el equipo de limpieza y el registro de lo que ya se hizo.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Cruza dos cosas: qué departamentos se desocupan y se ocupan hoy, y qué limpiezas reportó el equipo.",
      },
      {
        tipo: "parrafo",
        texto:
          "Las cuentas de limpieza tienen su propio acceso en /limpieza, donde solo pueden reportar su trabajo. Acá lo ves consolidado.",
      },
    ],
  },
  "cleaning.today": {
    title: "Entradas y salidas del día",
    short: "Qué departamentos se desocupan y cuáles se ocupan hoy.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Se arma solo a partir de las reservas confirmadas. La columna de check-out marca lo que hay que limpiar; la de check-in, lo que tiene que estar listo.",
      },
      {
        tipo: "aviso",
        texto:
          "Cuando un departamento sale en las dos columnas el mismo día, la limpieza es urgente: alguien se va a la mañana y otro entra a la tarde.",
      },
    ],
  },
  "cleaning.reports": {
    title: "Limpiezas reportadas",
    short: "Los partes que cargó el equipo de limpieza, con fecha y horario de entrada y salida.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Cada línea es un reporte hecho desde la cuenta de limpieza: propiedad, día trabajado y hora de entrada y salida.",
      },
      {
        tipo: "parrafo",
        texto:
          "La hora se guarda tal cual la escribió la persona, sin conversión de zona horaria, así que es la hora local de Mar Adentro.",
      },
      { tipo: "parrafo", texto: "Sirve para controlar cumplimiento y para liquidar el trabajo." },
    ],
  },

  // ---------- Afiliados ----------
  "affiliates.page": {
    title: "Solicitudes de afiliados",
    short: "Los pedidos del canal de afiliados esperando confirmación o cancelación.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "El canal de afiliados tiene precio propio (tarifa plana por noche) y un flujo distinto al de la web: la persona pide las fechas, el sistema las bloquea y recién un administrador decide.",
      },
      { tipo: "subtitulo", texto: "Cómo trabajar la cola" },
      {
        tipo: "pasos",
        items: [
          "Filtrá por estado para ver primero las pendientes.",
          "Abrí la solicitud y verificá el carnet contra los datos declarados.",
          "Confirmá o cancelá. Si cancelás, las fechas se liberan enseguida.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Las solicitudes pendientes retienen inventario. Dejar la cola sin atender significa perder noches vendibles.",
      },
    ],
  },
  "affiliates.detail.id": {
    title: "Carnet de identidad",
    short: "La foto del documento que subió el afiliado, para contrastarla con lo que declaró.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Se pide el carnet porque la solicitud es anónima: es la única forma de saber quién está reservando.",
      },
      { tipo: "subtitulo", texto: "Qué mirar" },
      {
        tipo: "lista",
        items: [
          "Que el número del documento coincida con el declarado en el formulario.",
          "Que el nombre coincida con el del titular de la solicitud.",
          "Que la imagen se lea: si está borrosa o cortada, cancelá pidiendo que la suba de nuevo.",
        ],
      },
    ],
  },
  "affiliates.detail.companions": {
    title: "Acompañantes",
    short: "Las personas que vienen con el titular, tal como las cargó en la solicitud.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Se usan para la declaración jurada y para controlar que no se exceda la capacidad de la propiedad.",
      },
      {
        tipo: "parrafo",
        texto:
          "La cantidad de acompañantes siempre tiene que ser menor a la cantidad de huéspedes declarada, porque el titular también cuenta.",
      },
    ],
  },
  "affiliates.detail.operations": {
    title: "Operaciones de la solicitud",
    short: "Confirmar la solicitud o cancelarla y liberar las fechas.",
    long: [
      {
        tipo: "lista",
        items: [
          "Confirmar: la solicitud pasa a ser una reserva firme y las fechas quedan tomadas.",
          "Cancelar: se descarta y las noches vuelven a estar disponibles de inmediato.",
        ],
      },
      {
        tipo: "aviso",
        texto: "Ambas acciones son solo para administradores y quedan registradas en Auditoría.",
      },
    ],
  },
  "affiliates.detail.history": {
    title: "Historial de la solicitud",
    short: "Los eventos de esta solicitud desde que entró hasta ahora.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Muestra cuándo llegó, qué se hizo y quién lo hizo. Es el respaldo si después hay un reclamo.",
      },
    ],
  },

  // ---------- Pagos ----------
  "payments.page": {
    title: "Pagos",
    short: "Todos los pagos con su estado: pendientes, aprobados por IA, confirmados o rechazados.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "El cobro es por transferencia: el huésped paga al QR del banco y sube el comprobante. Cada comprobante lo analiza una IA y después una persona decide.",
      },
      { tipo: "subtitulo", texto: "Estados que vas a ver" },
      {
        tipo: "lista",
        items: [
          "Pendiente: falta que el huésped suba el comprobante.",
          "Aprobado por IA: la revisión automática no encontró problemas, pero todavía no está confirmado por una persona (depende del modo A/B).",
          "Confirmado: el dinero se da por recibido y la reserva queda firme.",
          "Rechazado o en revisión manual: hay algo que no cierra y necesita intervención.",
        ],
      },
      { tipo: "parrafo", texto: "Entrá a un pago para ver los comprobantes y resolverlo." },
    ],
  },
  "payments.detail.receipts": {
    title: "Comprobantes subidos",
    short:
      "Todos los intentos del huésped, con el resultado de la revisión automática de cada uno.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Cada vez que el huésped sube un comprobante se guarda un intento nuevo. Los ves todos, así podés seguir el ida y vuelta si tuvo que reintentar.",
      },
      { tipo: "subtitulo", texto: "Qué muestra cada intento" },
      {
        tipo: "lista",
        items: [
          "Número de intento y cuándo llegó.",
          "Resultado de la IA: qué leyó del comprobante y si detectó algo raro. Es una ayuda, no una decisión.",
          "SHA-256: la huella del archivo. Si dos intentos tienen la misma huella, es exactamente el mismo archivo subido de nuevo.",
          "Enlace para abrir el comprobante original.",
        ],
      },
      { tipo: "subtitulo", texto: "Cómo revisarlo" },
      {
        tipo: "pasos",
        items: [
          "Abrí el último comprobante y contrastá monto, fecha y cuenta destino con los datos de la reserva.",
          "Si cierra, confirmá el pago desde Operaciones.",
          "Si no cierra, rechazalo explicando el motivo, o dejá una observación si necesitás consultarlo antes de decidir.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Que la IA no haya podido analizarlo no significa que el comprobante esté mal: solo que el análisis automático no corrió. Revisalo a mano igual.",
      },
    ],
  },
  "payments.detail.operations": {
    title: "Operaciones del pago",
    short: "Confirmar, rechazar u observar el pago después de revisar el comprobante.",
    long: [
      {
        tipo: "lista",
        items: [
          "Confirmar: se da el pago por recibido y la reserva pasa a confirmada.",
          "Rechazar: el comprobante no sirve. Conviene explicar el motivo para que el huésped pueda corregir.",
          "Observar: deja una nota sin cambiar el estado, para cuando necesitás consultar antes de decidir.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Confirmar un pago es difícil de deshacer: si después hay que devolver plata, la reserva queda marcada para revisión manual. Revisá bien antes.",
      },
    ],
  },
  "payments.detail.mode": {
    title: "Modo de confirmación (A/B)",
    short: "Define si la IA puede confirmar sola los comprobantes o si siempre decide una persona.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Es un interruptor general del sistema, no de este pago: cambia cómo se procesan todos los comprobantes de acá en adelante.",
      },
      { tipo: "subtitulo", texto: "Los dos modos" },
      {
        tipo: "lista",
        items: [
          "Modo B (el que viene por defecto): la IA analiza y aprueba, pero la reserva se confirma solo cuando una persona lo confirma acá. Más lento, más control.",
          "Modo A: si la IA aprueba el comprobante, la reserva se confirma sola, sin intervención. Más rápido, menos control.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Ante cualquier duda o falla, el sistema cae en Modo B: nunca confirma solo por error. Cambiarlo es una acción de administrador y queda en Auditoría.",
      },
    ],
  },
  "payments.detail.events": {
    title: "Eventos del pago",
    short: "La línea de tiempo del pago: intentos, análisis, cambios de estado.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Es el rastro completo de lo que le pasó a este pago, incluido lo que hizo la IA. Sirve para explicar por qué quedó como quedó.",
      },
    ],
  },

  // ---------- Propiedades ----------
  "properties.page": {
    title: "Propiedades",
    short: "El catálogo completo: estado, zona y precio base de cada departamento.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Cada fila es una propiedad publicable. Desde acá entrás a editarla o a administrar sus imágenes.",
      },
      { tipo: "subtitulo", texto: "Los estados" },
      {
        tipo: "lista",
        items: [
          "Borrador: se está cargando, no se ve en la web.",
          "Publicada: visible y reservable.",
          "Pausada: sigue existiendo pero no acepta reservas nuevas.",
          "Archivada: fuera de operación.",
        ],
      },
      {
        tipo: "aviso",
        texto: "Una propiedad con precio base en cero no se puede cotizar aunque esté publicada.",
      },
    ],
  },
  "properties.new": {
    title: "Nueva propiedad",
    short: "Alta de un departamento nuevo. Después se le cargan imágenes y precios.",
    long: [
      {
        tipo: "parrafo",
        texto: "Creá la propiedad con los datos básicos; el resto se completa después.",
      },
      { tipo: "subtitulo", texto: "Campos que conviene pensar bien" },
      {
        tipo: "lista",
        items: [
          "Slug: es la dirección web de la propiedad. Solo minúsculas, números y guiones. Cambiarlo después rompe los enlaces que ya compartiste.",
          "Máx. huéspedes: se valida en cada reserva, nadie puede reservar por encima de ese número.",
          "Mínimo de noches: estadías más cortas se rechazan al cotizar.",
          "Estado: dejalo en borrador hasta tener fotos y precio cargados.",
        ],
      },
      {
        tipo: "parrafo",
        texto: "Al guardar te lleva al detalle, donde cargás imágenes, precios y tarifas.",
      },
    ],
  },
  "properties.detail.page": {
    title: "Detalle de la propiedad",
    short: "Todo lo de este departamento en una pantalla: datos, precios, tarifas e imágenes.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Acá se administra una propiedad completa. La columna izquierda es el editor: datos, precio base, recargo de fin de semana y tarifas estacionales, todo junto.",
      },
      {
        tipo: "aviso",
        texto:
          "El editor se guarda de una sola vez con el botón Guardar todo del final. No hace falta guardar el precio base antes de tocar las tarifas o el fin de semana.",
      },
      {
        tipo: "parrafo",
        texto:
          "La columna derecha es de consulta: estado, imágenes y los últimos cambios de precio. Las imágenes se administran en su propia pantalla.",
      },
    ],
  },
  "properties.detail.status": {
    title: "Estado actual",
    short: "Resumen rápido de la propiedad: si está publicada, su precio y qué le falta.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Sirve de control antes de publicar: si el precio está en cero o no hay imágenes, la propiedad todavía no está lista para salir a la venta.",
      },
    ],
  },
  "properties.detail.images": {
    title: "Imágenes de la propiedad",
    short: "Vista previa de la galería. El botón abre la pantalla donde se ordenan y se borran.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Acá solo ves las primeras fotos para confirmar que la propiedad tiene material cargado.",
      },
      {
        tipo: "parrafo",
        texto:
          "Para subir, reordenar o eliminar, entrá a Administrar imágenes: ahí se arrastra para definir en qué orden se muestran en la web.",
      },
    ],
  },
  "properties.detail.priceHistory": {
    title: "Cambios de precio",
    short: "Los últimos movimientos de precio de esta propiedad, con la fecha de cada uno.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Cada vez que cambia el precio base, el precio de afiliados o una tarifa, queda un registro. Sirve para responder “¿por qué esta reserva salió a este valor?”.",
      },
      {
        tipo: "parrafo",
        texto:
          "Las reservas ya cerradas conservan el precio que tenían al momento de reservar: cambiar el precio hoy no las modifica.",
      },
    ],
  },
  "properties.editor.data": {
    title: "Datos de la propiedad",
    short: "Toda la ficha del departamento: nombre, capacidad, precios base y textos públicos.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Es la información que se muestra en la web y la que usa el sistema para validar cada reserva.",
      },
      { tipo: "subtitulo", texto: "Los campos que más impactan" },
      {
        tipo: "lista",
        items: [
          "Precio base: el valor de una noche común. Todo lo demás (fin de semana, paquetes) se calcula a partir de acá.",
          "Precio para afiliados: tarifa plana por noche del canal de afiliados. Ignora tarifas estacionales y descuentos. Si lo dejás vacío, la propiedad se lista pero no se puede reservar por ese canal.",
          "Estado: define si la propiedad se ve en la web.",
          "Mínimo de noches y máximo de huéspedes: se validan en el servidor en cada cotización.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Todo lo que edites en esta pantalla —datos, fin de semana y tarifas— se guarda junto con el botón Guardar todo del final. No hace falta guardar por partes.",
      },
    ],
  },
  "properties.editor.weekend": {
    title: "Precio de fin de semana",
    short:
      "Recargo en porcentaje sobre el precio base para los días que marques como fin de semana.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "No se carga un monto: se carga un porcentaje y los días a los que se aplica. El sistema lo suma al precio base de cada noche que caiga en esos días.",
      },
      { tipo: "subtitulo", texto: "Cómo se calcula" },
      {
        tipo: "pasos",
        items: [
          "Se toma el precio base de la propiedad.",
          "Si la noche cae en uno de los días marcados, se le suma el porcentaje.",
          "Ese es el precio que ve el huésped por esa noche.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Ejemplo: precio base Bs 1.400 y recargo del 30 % con viernes y sábado marcados. Una noche de viernes sale Bs 1.820 y una de martes sigue en Bs 1.400.",
      },
      { tipo: "subtitulo", texto: "Qué tener en cuenta" },
      {
        tipo: "lista",
        items: [
          "Se cobra por noche: si alguien entra el viernes y sale el domingo, las noches son viernes y sábado.",
          "Es un ajuste general: los mismos días y el mismo porcentaje valen para todas las propiedades, aunque lo edites desde una en particular. Lo que cambia es el precio base de cada una.",
          "Las tarifas estacionales le ganan al recargo: si una noche está cubierta por una tarifa, se cobra ese precio fijo y el porcentaje no se aplica.",
          "Con 0 % o sin días marcados, el recargo queda apagado.",
          "La vista previa usa el precio base que estás tipeando arriba, así que podés probar valores antes de guardar.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "El cambio afecta a las reservas nuevas. Las ya confirmadas mantienen el precio con el que se cerraron.",
      },
    ],
  },
  "properties.editor.rates": {
    title: "Tarifas estacionales y feriados",
    short:
      "Precio fijo por noche para un rango de fechas. Le gana al precio base y al fin de semana.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Sirve para temporada alta, fines de semana largos y feriados: en vez de calcularse sobre el precio base, esas noches se cobran al valor que fijes acá.",
      },
      { tipo: "subtitulo", texto: "Cómo cargarla" },
      {
        tipo: "pasos",
        items: [
          "Tocá Añadir tarifa.",
          "Poné Desde (primera noche) y Hasta (la mañana en que se van, o sea el día siguiente a la última noche).",
          "Cargá el precio por noche y, si querés, una etiqueta para reconocerla.",
          "Guardá todo con el botón del final.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Para un feriado suelto: si el feriado es el 6 de agosto, poné Desde 06/08 y Hasta 07/08. Eso cubre la noche del 6.",
      },
      { tipo: "subtitulo", texto: "Prioridad de precios" },
      {
        tipo: "lista",
        items: [
          "1. Tarifa estacional o feriado: manda siempre.",
          "2. Recargo de fin de semana: solo si esa noche no tiene tarifa.",
          "3. Precio base: para el resto de las noches.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "El tacho quita la tarifa de la lista, pero recién se borra de verdad cuando apretás Guardar todo.",
      },
    ],
  },
  "properties.images.page": {
    title: "Imágenes de la propiedad",
    short: "Subir fotos, ordenarlas arrastrando y eliminar las que no van.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "El orden de esta pantalla es exactamente el orden en que se ven las fotos en la web, y la primera es la portada.",
      },
    ],
  },
  "properties.images.upload": {
    title: "Subir imagen",
    short: "Cargá una foto JPG, PNG o WebP de hasta 8 MB. Se agrega al final de la galería.",
    long: [
      {
        tipo: "lista",
        items: [
          "Formatos aceptados: JPG, PNG y WebP. Hasta 8 MB por archivo.",
          "La foto nueva se agrega al final; si querés que sea portada, arrastrala al primer lugar.",
          "El texto alternativo describe la imagen para quien no puede verla y ayuda al posicionamiento en buscadores. Es opcional pero conviene completarlo.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Subí fotos horizontales y bien iluminadas: se recortan a un formato apaisado en las tarjetas del sitio.",
      },
    ],
  },
  "properties.images.gallery": {
    title: "Galería",
    short: "Arrastrá para cambiar el orden. La número 1 es la portada. El tacho elimina la foto.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Este es el orden real de la galería pública: lo que ponés primero es lo primero que ve el huésped.",
      },
      { tipo: "subtitulo", texto: "Cómo ordenarlas" },
      {
        tipo: "pasos",
        items: [
          "Agarrá una foto y soltala sobre la posición donde la querés.",
          "El resto se renumera solo y el cambio se guarda al instante, sin botón de guardar.",
          "En celular o tablet usá las flechas ← y →, que hacen lo mismo.",
        ],
      },
      { tipo: "subtitulo", texto: "Portada y borrado" },
      {
        tipo: "lista",
        items: [
          "No hay casilla de portada: la portada es siempre la foto que está en la posición 1.",
          "El tacho elimina la foto del sitio y del almacenamiento. Pide confirmación y no se puede deshacer.",
          "Si se corta la conexión al guardar, el orden vuelve a como estaba y aparece un aviso.",
        ],
      },
    ],
  },

  // ---------- Torres ----------
  "towers.page": {
    title: "Torres",
    short: "Agrupá los departamentos por edificio para ordenar el catálogo y el mapa.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Una torre es un edificio de Mar Adentro. Sirve para agrupar departamentos en la web, en el mapa y en los filtros del panel.",
      },
      {
        tipo: "parrafo",
        texto:
          "Una propiedad puede no tener torre: sigue funcionando igual, solo que queda fuera de las agrupaciones.",
      },
    ],
  },
  "towers.new": {
    title: "Nueva torre",
    short: "Creá un edificio para después asignarle departamentos.",
    long: [
      {
        tipo: "lista",
        items: [
          "Nombre: es el que se ve en la web y en el mapa.",
          "Orden: define en qué posición aparece respecto de las otras torres. Menor número, más arriba.",
          "Una torre inactiva deja de ofrecerse para asignar, pero no rompe las propiedades que ya la tienen.",
        ],
      },
    ],
  },
  "towers.assigned": {
    title: "Departamentos asignados",
    short: "Qué propiedades pertenecen a esta torre.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "La asignación se cambia desde el detalle de cada propiedad, en el campo Torre. Acá lo ves consolidado por edificio.",
      },
    ],
  },
  "towers.unassigned": {
    title: "Propiedades sin torre",
    short: "Departamentos que todavía no están asignados a ningún edificio.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "No es un error: son propiedades que funcionan igual pero no aparecen agrupadas por edificio ni se pueden ubicar en el mapa por torre.",
      },
      { tipo: "parrafo", texto: "Para asignarlas, entrá a la propiedad y elegí la torre." },
    ],
  },

  // ---------- Tarifas y precios ----------
  "pricing.page": {
    title: "Tarifas y precios",
    short: "Paquetes por cantidad de noches y simulador para probar precios antes de publicarlos.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Esta pantalla trabaja sobre una propiedad a la vez: elegila arriba. El precio base y el recargo de fin de semana se editan en el detalle de la propiedad.",
      },
      { tipo: "subtitulo", texto: "Cómo se arma el precio de una reserva" },
      {
        tipo: "pasos",
        items: [
          "Se calcula noche por noche: tarifa estacional si la hay, si no precio base con el recargo de fin de semana cuando corresponde.",
          "Si la cantidad de noches coincide con un paquete configurado y no hay tarifa estacional de por medio, se aplica el precio del paquete.",
          "El resultado es el total que ve el huésped.",
        ],
      },
    ],
  },
  "pricing.seasonal": {
    title: "Tarifas estacionales",
    short: "Las tarifas por rango de fechas ya cargadas para esta propiedad.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Es una vista de solo lectura. Para crear, editar o borrar tarifas, entrá al detalle de la propiedad: ahí se cargan junto con el resto y se guardan de una vez.",
      },
      {
        tipo: "parrafo",
        texto:
          "Las tarifas estacionales tienen prioridad sobre el recargo de fin de semana y sobre los descuentos por cantidad de noches.",
      },
    ],
  },
  "pricing.stayPrices": {
    title: "Precios por estadía",
    short: "Paquetes: un precio total cerrado para una cantidad exacta de noches.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Sirve para premiar estadías largas: en vez de cobrar noche por noche, se cobra un total fijo para esa cantidad de noches.",
      },
      { tipo: "subtitulo", texto: "Cómo funciona" },
      {
        tipo: "lista",
        items: [
          "Cada fila es una cantidad de noches con su total. El descuento se calcula solo contra el precio normal.",
          "El total del paquete no puede ser mayor al precio normal: sería cobrar de más.",
          "El paquete se aplica solo si la estadía tiene exactamente esa cantidad de noches.",
          "Si alguna noche de la estadía tiene tarifa estacional, el paquete no se aplica: manda la tarifa.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Hay que activar la casilla de precios por cantidad de noches para que los paquetes se usen al cotizar.",
      },
    ],
  },
  "pricing.simulation": {
    title: "Simulación oficial",
    short: "Cotizá fechas de prueba con el mismo cálculo que usa la web pública.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "No es una aproximación: llama exactamente a la misma función del servidor que cotiza a los huéspedes, así que lo que ves acá es lo que se les va a cobrar.",
      },
      { tipo: "subtitulo", texto: "Cómo usarla" },
      {
        tipo: "pasos",
        items: [
          "Guardá primero los cambios de precio que quieras probar.",
          "Elegí fechas de ingreso y salida y la cantidad de huéspedes.",
          "Tocá Calcular y mirá el desglose: noches, descuentos y total.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Simula sobre precios guardados. Si cambiaste algo y no guardaste, vas a ver el precio viejo.",
      },
    ],
  },

  // ---------- Mapa ----------
  "map.page": {
    title: "Mapa de Mar Adentro",
    short: "Ubicá torres y puntos de interés en el plano que ve el visitante de la web.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "El mapa es lo que muestra el sitio para explicar dónde queda cada cosa: torres, amenities, accesos, la laguna.",
      },
      { tipo: "subtitulo", texto: "Cómo se trabaja" },
      {
        tipo: "pasos",
        items: [
          "Agregá o mové elementos sobre el plano.",
          "Asociá cada torre con su elemento para que el visitante pueda ir del mapa a las propiedades.",
          "Publicá cuando esté listo: hasta ese momento, los cambios no se ven en la web.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Editar y publicar son cosas distintas. Podés dejar el mapa a medio armar sin que se note afuera.",
      },
    ],
  },

  // ---------- Copropietarios ----------
  "coowners.page": {
    title: "Estadías declaradas",
    short: "Las estadías que declararon los copropietarios en sus propios departamentos.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Los copropietarios entran con su propio usuario y declaran cuándo van a usar su departamento. Esas fechas bloquean el calendario para que no se vendan.",
      },
      { tipo: "parrafo", texto: "Usá los filtros para ubicar una estadía por propiedad o fecha." },
    ],
  },
  "coowners.detail.guests": {
    title: "Huéspedes adicionales",
    short: "Las personas que el copropietario declaró que se alojan con él.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Se piden para la declaración jurada y para el control de ingreso: recepción tiene que saber quién entra.",
      },
    ],
  },

  // ---------- Sistema ----------
  "users.page": {
    title: "Usuarios",
    short: "Cuentas de acceso: equipo interno, copropietarios y personal de limpieza.",
    long: [
      {
        tipo: "parrafo",
        texto: "Cada tipo de cuenta entra por una puerta distinta y ve cosas distintas.",
      },
      { tipo: "subtitulo", texto: "Los tres tipos" },
      {
        tipo: "lista",
        items: [
          "Usuario interno: entra al panel. Puede ser admin (todo) u operator (todo menos lo sensible: roles, auditoría, afiliados, copropietarios, limpieza y confirmaciones a mano).",
          "Copropietario: entra a /copropietarios y solo declara estadías de su propio departamento.",
          "Cuenta de limpieza: entra a /limpieza y solo reporta el trabajo realizado.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Solo un administrador puede crear cuentas o cambiar roles, y cada cambio queda en Auditoría.",
      },
    ],
  },
  "audit.page": {
    title: "Actividad del panel",
    short: "Quién hizo qué y cuándo dentro del panel. No se puede editar ni borrar.",
    long: [
      {
        tipo: "parrafo",
        texto:
          "Cada acción sensible del panel deja un registro con el usuario, la fecha, qué se tocó y el motivo que se escribió.",
      },
      { tipo: "subtitulo", texto: "Para qué sirve" },
      {
        tipo: "lista",
        items: [
          "Reconstruir qué pasó cuando un precio, una reserva o un pago no está como se esperaba.",
          "Saber quién autorizó una confirmación a mano o una cancelación.",
          "Respaldar decisiones ante un reclamo.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Es de solo lectura y exclusiva de administradores. Nadie puede borrar su propio rastro.",
      },
    ],
  },
} satisfies Record<string, HelpEntry>;

export type HelpKey = keyof typeof HELP;
