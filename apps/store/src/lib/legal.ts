/** Versión vigente de los textos legales. Se guarda en el perfil al crear la cuenta para saber qué aceptó cada persona. */
export const LEGAL_VERSION = "2026-11";
export const LEGAL_UPDATED = "4 de noviembre de 2026";
/** Los dos textos se basan en el manual de políticas de TI; se cita para que se sepa de dónde salen las reglas. */
export const LEGAL_BASIS = "Basados en el Manual de Políticas, Normas, Controles y Procedimientos de TI de Rapitrip (septiembre de 2026).";

export type LegalSection = { id: string; title: string; body: string[]; items?: string[] };

export const termsSections: LegalSection[] = [
  {
    id: "quienes-somos",
    title: "1. Qué es Rapitrip",
    body: [
      "Rapitrip es una plataforma que conecta a clientes con comercios afiliados para pedir productos y recibirlos por reparto. Estos términos regulan el uso de la tienda y de las cuentas de cliente.",
      "Al crear una cuenta o usar la tienda declaras que leíste y aceptas estos términos y la Política de privacidad.",
    ],
  },
  {
    id: "cuenta",
    title: "2. Tu cuenta",
    body: ["Para comprar o pedir la afiliación de un negocio necesitas una cuenta de cliente propia."],
    items: [
      "La cuenta es personal: no se comparte con otras personas. Cada correo corresponde a una sola cuenta.",
      "Se habilita cuando confirmas tu correo con el enlace que te enviamos.",
      "Tu contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y símbolo. Eres responsable de mantenerla en secreto.",
      "Puedes ingresar con tu correo y contraseña o con tu cuenta de Google.",
      "Si usas un dispositivo compartido, cierra tu sesión al terminar. Por seguridad la sesión también se cierra sola tras un tiempo sin actividad.",
      "La cuenta de la tienda sirve solo para comprar. El equipo de Rapitrip, los comercios y los repartidores usan cuentas aparte, con otro correo; nunca se mezclan.",
    ],
  },
  {
    id: "uso",
    title: "3. Uso permitido",
    body: ["Te comprometes a usar Rapitrip de buena fe y solo para lo que fue creado. No está permitido:"],
    items: [
      "Suplantar a otra persona o comercio, o dar información falsa.",
      "Intentar acceder a cuentas, datos o áreas que no te corresponden, o vulnerar las medidas de seguridad.",
      "Usar la plataforma para actividades ilícitas o para comprar productos prohibidos por la ley.",
      "Automatizar el uso de forma que afecte el servicio de otras personas.",
    ],
  },
  {
    id: "mensajes",
    title: "4. Mensajes sospechosos",
    body: [
      "Rapitrip nunca te pedirá tu contraseña ni los datos completos de tu tarjeta por correo, mensaje o teléfono. Si recibes un mensaje que lo pida o que parezca suplantar a Rapitrip, no respondas ni compartas información y avísanos por «Ayuda» en la tienda.",
    ],
  },
  {
    id: "pedidos",
    title: "5. Pedidos y precios",
    items: [
      "Antes de confirmar un pedido revisa los productos, las cantidades y la dirección de entrega. Al confirmarlo queda registrado con un número único para darle seguimiento.",
      "Pagas el precio publicado en el catálogo al momento del pedido. Si tu carrito tiene productos de varios comercios, se crea un pedido por comercio, cada uno con su envío.",
      "Un producto agotado no se puede pedir. El comercio debe confirmar la disponibilidad de tu pedido; si no lo confirma a tiempo, el pedido se cancela solo y no se te cobra.",
      "Si el comercio no puede completar tu pedido, te avisamos el motivo y se cancela o se resuelve contigo antes de prepararlo.",
      "Puedes seguir el estado de cada pedido en «Mis pedidos».",
    ],
    body: [],
  },
  {
    id: "entrega",
    title: "6. Entrega",
    items: [
      "Un repartidor de Rapitrip recoge el pedido en el comercio y lo lleva a la dirección que indicaste.",
      "Para entregarlo, el repartidor confirma la recepción contigo o con la persona que autorices, con el código de entrega del pedido, y toma una fotografía como evidencia asociada al pedido.",
      "Si no estás en la dirección, el repartidor reporta la incidencia antes de devolver el pedido y el equipo de Rapitrip decide cómo continuar.",
    ],
    body: [],
  },
  {
    id: "pagos",
    title: "7. Pagos y devoluciones",
    items: [
      "Puedes pagar con tarjeta, procesada por Stripe, o en efectivo al recibir. Rapitrip no guarda los datos de tu tarjeta.",
      "En efectivo, pagas al repartidor el monto exacto del pedido, incluido el envío.",
      "Si un pedido con tarjeta se cancela o se rechaza, el reembolso se procesa automáticamente.",
      "Puedes pedir la devolución de un pedido entregado desde su detalle, indicando el motivo. La administración la aprueba o la rechaza en un plazo máximo de tres (3) días hábiles.",
    ],
    body: [],
  },
  {
    id: "comercios",
    title: "8. Afiliar tu negocio",
    body: [
      "Desde la tienda puedes pedir que tu negocio se afilie. La administración revisa la solicitud y puede aprobarla o rechazarla indicando el motivo; la aprobación exige un convenio de afiliación firmado.",
      "Si se aprueba, el negocio recibe una invitación para crear su cuenta de la consola con el correo que indicaste para ella, distinto del de tu cuenta de la tienda. Los comercios son responsables de la calidad, el precio, la disponibilidad y la legalidad de lo que ofrecen.",
    ],
  },
  {
    id: "responsabilidad",
    title: "9. Disponibilidad y responsabilidad",
    body: [
      "Hacemos lo razonable para mantener el servicio disponible y seguro, incluidos respaldos de la información y medios alternos de conexión para no detener la atención de pedidos. Aun así, no garantizamos que funcione sin interrupciones.",
      "Rapitrip no responde por daños indirectos ni por hechos fuera de su control, salvo lo que la ley no permita excluir.",
    ],
  },
  {
    id: "suspension",
    title: "10. Suspensión y cierre de cuentas",
    body: [
      "Podemos suspender o cerrar una cuenta que incumpla estos términos o ponga en riesgo a otras personas o a la plataforma. Una cuenta suspendida no puede ingresar ni hacer pedidos.",
      "Puedes pedir el cierre de tu cuenta y la eliminación de tus datos en cualquier momento desde «Ajustes». Las cuentas sin actividad durante doce (12) meses se revisan para eliminar o anonimizar sus datos, como explica la Política de privacidad.",
    ],
  },
  {
    id: "cambios",
    title: "11. Cambios y ley aplicable",
    body: [
      "Podemos actualizar estos términos. Publicaremos la nueva versión con su fecha y, si el cambio es importante, te avisaremos. Seguir usando Rapitrip después del cambio implica aceptarlo.",
      "Estos términos se rigen por las leyes de la República de Nicaragua.",
    ],
  },
];

export const privacySections: LegalSection[] = [
  {
    id: "responsable",
    title: "1. Quién es responsable de tus datos",
    body: [
      "Rapitrip es responsable del tratamiento de los datos personales que recibe a través de la tienda, de acuerdo con la Ley N.° 787, Ley de Protección de Datos Personales de Nicaragua, y con su Manual de Políticas de TI.",
    ],
  },
  {
    id: "datos",
    title: "2. Qué datos tratamos",
    body: ["Solo pedimos lo necesario para registrar tu cuenta y completar tus pedidos:"],
    items: [
      "Cuenta: nombre completo, correo, teléfono (opcional), foto de perfil (opcional) y la contraseña, que se guarda cifrada y nadie puede ver.",
      "Ingreso con Google: tu nombre y correo, que Google comparte con nosotros cuando lo autorizas.",
      "Pedidos: direcciones de entrega con su ubicación en el mapa, teléfono de contacto, notas para el repartidor, productos y montos.",
      "Pagos: el método y el estado del pago. Los datos de la tarjeta los procesa Stripe; Rapitrip no los recibe ni los guarda.",
      "Entregas: la fotografía de evidencia y los códigos de recogida y de entrega de cada pedido.",
      "Solicitud de afiliación: datos del negocio y del representante (nombre, cédula o RUC, teléfono, dirección y categoría) y el correo para la consola.",
      "Seguridad: registro de inicios de sesión (fecha, hora, dirección IP y dispositivo) y de las acciones sobre tu cuenta.",
      "Aceptación de estos textos: la versión que aceptaste y la fecha.",
    ],
  },
  {
    id: "finalidad",
    title: "3. Para qué los usamos",
    body: [
      "Tus datos se usan únicamente para la operación de Rapitrip: crear y proteger tu cuenta, procesar y entregar tus pedidos, cobrar y reembolsar, evaluar solicitudes de afiliación, enviarte correos del servicio, atender reclamos, prevenir fraudes y cumplir obligaciones legales. No vendemos tus datos ni los usamos para publicidad de terceros.",
    ],
  },
  {
    id: "acceso",
    title: "4. Quién puede ver tus datos",
    body: ["Cada persona ve solo lo que necesita para su función, y la base de datos lo exige con reglas de acceso por rol:"],
    items: [
      "El comercio de tu pedido: tu nombre, la dirección de entrega y el contenido del pedido. No ve tus datos de pago ni tus compras en otros comercios.",
      "El repartidor asignado: la dirección y el teléfono de contacto, solo mientras dura la entrega. Al cerrarse, deja de verlos.",
      "El equipo de Rapitrip: lo necesario para dar seguimiento a pedidos y reclamos, según su rol.",
      "Nadie más dentro de Rapitrip puede copiar, exportar ni compartir tus datos fuera de la plataforma. Cualquier salida de información la autoriza la administración, con motivo y destinatario, por un canal cifrado, y queda registrada.",
    ],
  },
  {
    id: "encargados",
    title: "5. Proveedores que nos ayudan",
    body: ["Usamos proveedores que tratan datos por encargo nuestro y solo para prestar el servicio:"],
    items: [
      "Supabase: base de datos, autenticación y almacenamiento de archivos.",
      "Stripe: cobro con tarjeta y reembolsos.",
      "Mapbox: mapas, direcciones y cálculo del envío.",
      "Resend: envío de los correos del servicio.",
      "Cloudflare Turnstile: verificación contra bots en los formularios de acceso.",
      "Google: solo si eliges ingresar con tu cuenta de Google.",
      "Autoridades, cuando una ley o una orden válida nos obligue.",
    ],
  },
  {
    id: "cookies",
    title: "6. Cookies y almacenamiento del navegador",
    body: [
      "Usamos únicamente las cookies necesarias para mantener tu sesión. Tus preferencias, como el tema o reducir animaciones, se guardan en tu propio navegador. No usamos cookies de publicidad ni de seguimiento, por eso no mostramos un aviso de consentimiento de cookies.",
    ],
  },
  {
    id: "conservacion",
    title: "7. Cuánto tiempo los conservamos",
    items: [
      "Tus datos se conservan mientras tu cuenta esté activa y no más de lo necesario para la operación o para cumplir una obligación legal, contable o de atención de reclamos.",
      "Las cuentas sin actividad durante doce (12) meses se revisan para eliminar o anonimizar sus datos.",
      "La anonimización se aplica sobre el registro completo de la base de datos, no solo sobre lo que se ve en la tienda.",
      "Las fotografías de entrega se borran pasado el plazo de conservación configurado por la administración.",
      "Los registros de inicios de sesión y de auditoría se conservan treinta (30) días.",
      "La base de datos se respalda automáticamente. Los respaldos anteriores a una eliminación pueden conservar el dato hasta que venzan; los posteriores ya no lo contienen.",
    ],
    body: [],
  },
  {
    id: "derechos",
    title: "8. Tus derechos",
    body: [
      "Según la Ley N.° 787 puedes pedir acceder a tus datos, rectificarlos o actualizarlos, oponerte a su uso y que los eliminemos o anonimicemos. Puedes corregir tu nombre, teléfono y direcciones en «Ajustes», y pedir la eliminación de tu cuenta desde «Ajustes» → «Datos».",
      "Atendemos las solicitudes de eliminación en un plazo máximo de treinta (30) días, salvo que una obligación legal nos impida eliminar algún dato; en ese caso te explicamos cuál y por qué.",
    ],
  },
  {
    id: "seguridad",
    title: "9. Cómo los protegemos",
    body: [
      "Aplicamos reglas de acceso por rol en la base de datos, cifrado en tránsito, contraseñas cifradas, cierre automático de sesiones, bloqueo temporal tras varios intentos fallidos, verificación en dos pasos obligatoria para el equipo de Rapitrip y registro de accesos.",
    ],
  },
  {
    id: "incidentes",
    title: "10. Si ocurre un incidente",
    body: [
      "Si un incidente expone o compromete tus datos personales, lo contenemos, lo registramos y te lo notificamos en un plazo máximo de setenta y dos (72) horas, indicando qué datos se vieron afectados y qué puedes hacer.",
    ],
  },
  {
    id: "cambios",
    title: "11. Cambios a esta política",
    body: ["Si cambiamos esta política publicaremos la nueva versión con su fecha. Si el cambio es importante, te lo avisaremos."],
  },
];

/** Versión de los términos del comercio afiliado. Se guarda en la solicitud para saber exactamente qué texto aceptó cada negocio. */
export const MERCHANT_TERMS_VERSION = "2026-11";

/** Compromisos del comercio afiliado. Cada sección cita la política del manual de TI de la que sale. */
export const merchantTermsSections: LegalSection[] = [
  {
    id: "alcance",
    title: "1. Qué aceptas al enviar la solicitud",
    body: [
      "Estos términos regulan cómo trabajará tu negocio como comercio afiliado de Rapitrip. Al marcar la casilla del formulario declaras que los leíste, que los datos que enviaste son verdaderos y que te comprometes a cumplirlos si tu solicitud es aprobada.",
      "Enviar la solicitud no te afilia: la administración la revisa y puede aprobarla o rechazarla indicando el motivo. La afiliación solo existe con el convenio firmado.",
    ],
  },
  {
    id: "cuenta",
    title: "2. Tu cuenta de la consola (Política 2)",
    body: [],
    items: [
      "Si te aprueban, recibes una invitación al correo que indicaste para la consola. Esa cuenta es aparte de tu cuenta de la tienda y no se mezclan.",
      "La cuenta es propia del negocio y no se comparte entre personas. Cada persona que trabaje por el comercio debe usar su acceso.",
      "Solo puedes consultar y modificar los productos, pedidos y datos de tu propio negocio; la plataforma te niega el acceso a los de otros comercios.",
      "Debes cerrar tu sesión al terminar si usas un dispositivo compartido.",
      "Si el convenio termina o dejas de operar, la administración inhabilita tu cuenta en un plazo máximo de 24 horas, una vez resueltas las liquidaciones pendientes.",
    ],
  },
  {
    id: "catalogo",
    title: "3. Catálogo, precios e inventario (Política 8)",
    items: [
      "Publicas cada producto con nombre, descripción, precio y disponibilidad, y respondes por la calidad, la legalidad y la veracidad de lo que ofreces.",
      "Los precios y las descripciones deben corresponder a lo que realmente vendes. Cobras al cliente el mismo precio publicado al momento del pedido.",
      "Marcas como no disponible todo producto agotado, antes de que un cliente pueda elegirlo, y actualizas la disponibilidad al menos una vez al día.",
      "Retiras del catálogo, o marcas como no disponible, los productos que dejes de ofrecer en un máximo de 24 horas.",
      "Si un cliente reporta una inconsistencia y se confirma, tienes 24 horas adicionales para corregirla. La reincidencia se reporta a la administración, que decide la medida que corresponde en un máximo de 5 días hábiles.",
    ],
    body: [],
  },
  {
    id: "pedidos",
    title: "4. Pedidos (Política 6)",
    items: [
      "Confirmas la disponibilidad de cada pedido en un máximo de 15 minutos desde que lo recibes.",
      "Si no puedes completar un pedido como se pidió, lo comunicas con el motivo antes de empezar a prepararlo. El equipo de ventas decide con el cliente si se cancela, se modifica o se sustituye.",
      "Actualizas el estado del pedido en cada etapa de su preparación, hasta que queda listo para el repartidor. Un pedido sin cambios por más de 30 minutos lo revisa el equipo de ventas y te contacta.",
    ],
    body: [],
  },
  {
    id: "entrega",
    title: "5. Entrega al repartidor (Política 7)",
    items: [
      "Entregas al repartidor los productos que corresponden al pedido. Desde ese momento el pedido queda bajo custodia del repartidor hasta la entrega o una devolución autorizada.",
      "Cualquier incidencia entre la recogida y la entrega se reporta por la plataforma y la resuelve el equipo de Rapitrip.",
    ],
    body: [],
  },
  {
    id: "pagos",
    title: "6. Cobros, liquidaciones y devoluciones (Política 9)",
    items: [
      "Rapitrip registra cada liquidación a tu comercio con el pedido, el monto y la fecha, con la periodicidad de tu convenio, que nunca excede 15 días.",
      "Una liquidación puede adelantarse antes de que el cliente confirme la recepción. Si se acepta una devolución sobre un pedido ya liquidado, se genera una reversión por el monto correspondiente.",
      "La reversión se descuenta de tu siguiente liquidación pendiente, sin exigirte devolver el dinero de inmediato. En tu convenio se define quién asume el costo de la devolución según su causa.",
      "Rapitrip no guarda los datos de tarjeta de los clientes.",
    ],
    body: [],
  },
  {
    id: "datos",
    title: "7. Datos de clientes (Políticas 1 y 3)",
    items: [
      "Solo ves el nombre, la dirección de entrega y el contenido de los pedidos de tu comercio. No ves datos de pago ni el historial de compras de otros comercios.",
      "No puedes copiar, exportar, fotografiar ni guardar fuera de la plataforma datos de clientes que no correspondan a un pedido activo con tu comercio.",
      "Los datos del cliente se usan solo para cumplir el pedido, nunca para publicidad propia ni para compartir con terceros.",
    ],
    body: [],
  },
  {
    id: "incidentes",
    title: "8. Incidentes de seguridad (Política 1)",
    body: [
      "Si pierdes un dispositivo, sospechas que alguien entró a tu cuenta o recibes mensajes que parecen suplantar a Rapitrip, debes avisar de inmediato a la administración por «Ayuda». La administración puede cambiar tus credenciales y cerrar tus sesiones para contener el incidente. Rapitrip nunca te pedirá tu contraseña.",
    ],
  },
  {
    id: "incumplimiento",
    title: "9. Incumplimiento y cierre",
    body: [
      "Si incumples estos términos o el convenio, la administración puede advertirte, suspender tu comercio o dar de baja tu cuenta. Puedes pedir la baja cuando quieras; se resuelven antes las liquidaciones y los pedidos pendientes.",
      "Los cambios a estos términos se publican en esta página con una nueva versión; se te pedirá aceptarla cuando corresponda. Cada solicitud guarda la versión y la fecha en que la aceptaste.",
    ],
  },
];
