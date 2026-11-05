import type { LegalSection } from "@rapitrip/ui";

/** Textos legales de la consola (equipo de Rapitrip y comercios afiliados), basados en el Manual de Políticas de TI. */
export const LEGAL_UPDATED = "4 de noviembre de 2026";
export const LEGAL_BASIS = "Basados en el Manual de Políticas, Normas, Controles y Procedimientos de TI de Rapitrip (septiembre de 2026), que puedes leer completo en «Mi cuenta» → «Políticas de TI».";

export const consoleTerms: LegalSection[] = [
  {
    id: "alcance",
    title: "1. A quién aplican",
    body: [
      "Estos términos regulan el uso de la consola de Rapitrip por el equipo (dirección, administración, caja y coordinación) y por los comercios afiliados. Al ingresar aceptas estos términos, la Política de privacidad de la consola y el Manual de Políticas de TI de Rapitrip.",
    ],
  },
  {
    id: "cuenta",
    title: "2. Tu cuenta",
    items: [
      "La cuenta es personal e intransferible: nadie más puede usarla, ni siquiera un compañero de trabajo.",
      "Solo se crea por invitación de la administración, después de confirmar tu relación con Rapitrip. El equipo usa su correo institucional; cada comercio, un correo propio distinto del de su cuenta de la tienda.",
      "Cada cuenta es de una sola app: la cuenta de la consola no compra en la tienda ni entra a la app del repartidor.",
      "El rol lo define la administración al habilitar la cuenta. Nadie puede cambiar su propio rol.",
      "Cada ingreso pide tu contraseña y el código de tu aplicación de autenticación. Tras cinco (5) intentos fallidos el acceso se bloquea quince (15) minutos.",
      "La sesión se cierra sola tras quince (15) minutos sin actividad y debes volver a ingresar tus credenciales.",
    ],
    body: [],
  },
  {
    id: "equipos",
    title: "3. Equipos compartidos",
    items: [
      "Cierra tu sesión al terminar, antes de entregar el equipo a otra persona. Si te alejas, bloquea la pantalla.",
      "Nunca uses la sesión abierta de otra persona. Si encuentras una, ciérrala y repórtala como incidente.",
    ],
    body: [],
  },
  {
    id: "informacion",
    title: "4. Uso de la información",
    items: [
      "Usa la información de la consola solo para las tareas propias de tu función. Usarla para cualquier otro fin está prohibido.",
      "No copies, exportes ni compartas información fuera de los canales autorizados por Rapitrip.",
      "No tomes capturas de pantalla, fotografías ni impresiones con información de clientes, comercios o pagos, salvo que tu función lo requiera de forma expresa.",
      "El comercio no puede copiar, exportar ni guardar fuera de la plataforma los datos de un cliente que no correspondan a un pedido activo con él.",
      "Toda salida de información de clientes, comercios o pagos la autoriza la administración, que indica el motivo y el destinatario, verifica su identidad y la envía por un canal cifrado. Las exportaciones masivas de datos personales son solo de la administración.",
    ],
    body: [],
  },
  {
    id: "incidentes",
    title: "5. Incidentes de seguridad",
    items: [
      "Reporta todo incidente de seguridad (pérdida de un dispositivo, acceso indebido, filtración o suplantación) en un plazo máximo de veinticuatro (24) horas desde «Reportar incidente», indicando la fecha, la información involucrada y las personas afectadas.",
      "Ante un mensaje sospechoso o de phishing, no respondas ni entregues información: repórtalo antes de hacer cualquier otra cosa.",
      "Los errores que impidan procesar pedidos, pagos o entregas se reportan de inmediato.",
    ],
    body: [],
  },
  {
    id: "comercios",
    title: "6. Obligaciones del comercio afiliado",
    items: [
      "Confirmar la disponibilidad de cada pedido en un máximo de quince (15) minutos desde que lo recibe, y avisar con el motivo cuando no pueda completarlo, antes de prepararlo.",
      "Actualizar el estado del pedido en cada etapa de su preparación, hasta dejarlo listo para el repartidor.",
      "Publicar cada producto con nombre, descripción, precio y disponibilidad; marcar como no disponible lo agotado antes de que un cliente pueda pedirlo, y actualizar la disponibilidad por lo menos una vez al día.",
      "Cobrar el mismo precio publicado al momento del pedido, y retirar o marcar como no disponible lo que deje de ofrecer en un máximo de veinticuatro (24) horas.",
      "Corregir en veinticuatro (24) horas una inconsistencia de su catálogo que le notifique Rapitrip. La reincidencia la evalúa la administración.",
      "Consultar y modificar solo el catálogo, el inventario y los pedidos de su propio negocio. Las liquidaciones y devoluciones se rigen por su convenio de afiliación.",
    ],
    body: [],
  },
  {
    id: "operacion",
    title: "7. Obligaciones del equipo de operación",
    items: [
      "Coordinación da seguimiento a los pedidos sin avance de estado por más de treinta (30) minutos y a los que el comercio no confirme a tiempo.",
      "Las decisiones sobre un pedido que el comercio no puede completar, y las incidencias que escale un repartidor, se resuelven en un máximo de treinta (30) minutos.",
      "Caja registra cada cobro por el monto exacto del pedido, incluido el envío, y confirma el efectivo que entrega cada repartidor.",
    ],
    body: [],
  },
  {
    id: "administracion",
    title: "8. Obligaciones de la administración",
    items: [
      "Revisar cada tres (3) meses los accesos de cada rol, y actualizar las reglas de acceso cuando se cree, modifique o elimine un rol.",
      "Inhabilitar en un máximo de veinticuatro (24) horas la cuenta de quien deja de tener relación con Rapitrip, resolviendo antes sus pedidos, entregas o liquidaciones pendientes.",
      "Aprobar o rechazar una devolución en un máximo de tres (3) días hábiles.",
      "Mantener los respaldos de la base de datos, autorizar los cambios al sistema y atender los incidentes conforme al Manual de Políticas de TI.",
    ],
    body: [],
  },
  {
    id: "auditoria",
    title: "9. Registro y auditoría",
    body: [
      "Cada inicio de sesión queda registrado con la cuenta, la fecha, la hora y el dispositivo, y las acciones importantes quedan en la auditoría con quién las hizo y cuándo. Estos registros se usan para la seguridad de la plataforma y para verificar quién ejecutó cada acción.",
    ],
  },
  {
    id: "incumplimiento",
    title: "10. Incumplimiento",
    body: [
      "El incumplimiento de estos términos o del Manual de Políticas de TI puede llevar a la suspensión o revocación del acceso, sin perjuicio de las medidas que correspondan según el convenio de afiliación o la relación laboral. Una cuenta inhabilitada no puede ingresar ni ejecutar acciones, y solo la administración puede reactivarla.",
    ],
  },
  {
    id: "cambios",
    title: "11. Cambios y ley aplicable",
    body: [
      "Estos términos y el manual pueden actualizarse; la versión vigente es la publicada con su fecha. Se rigen por las leyes de la República de Nicaragua.",
    ],
  },
];

export const consolePrivacy: LegalSection[] = [
  {
    id: "responsable",
    title: "1. Responsable",
    body: [
      "Rapitrip es responsable del tratamiento de los datos personales de su equipo y de los comercios afiliados en la consola, de acuerdo con la Ley N.° 787, Ley de Protección de Datos Personales de Nicaragua. Los datos de los clientes que se ven en la consola se rigen por la Política de privacidad de la tienda.",
    ],
  },
  {
    id: "datos",
    title: "2. Qué datos tratamos",
    items: [
      "Cuenta: nombre, correo institucional o del comercio, teléfono (opcional), foto de perfil (opcional), roles y su historial.",
      "Acceso: la contraseña, que se guarda cifrada, y el segundo factor de tu aplicación de autenticación.",
      "Seguridad: inicios de sesión (fecha, hora, dirección IP y dispositivo), actividad de la sesión y las acciones registradas en la auditoría.",
      "Incidentes que reportas y lo que escribes en ellos.",
      "Comercios: nombre del negocio, RUC o cédula del vendedor, representante, dirección, teléfono y los datos de su solicitud de afiliación.",
    ],
    body: [],
  },
  {
    id: "finalidad",
    title: "3. Para qué los usamos",
    body: [
      "Para darte acceso según tu rol, proteger la consola, saber quién hizo cada acción, atender incidentes, gestionar la afiliación de los comercios y cumplir obligaciones legales. No se usan para ningún otro fin.",
    ],
  },
  {
    id: "acceso",
    title: "4. Quién los ve",
    items: [
      "La administración y la dirección ven las cuentas, los roles, los accesos y la auditoría para gestionarlas y revisarlas.",
      "Tu foto de perfil solo la ves tú (y la dirección, para atender la eliminación de cuentas).",
      "Los demás roles no ven los datos de otras cuentas del equipo.",
      "Los proveedores que nos ayudan, solo para prestar el servicio: Supabase (base de datos y autenticación), Resend (correos del servicio), Cloudflare Turnstile (verificación contra bots) y Mapbox (mapas).",
    ],
    body: [],
  },
  {
    id: "conservacion",
    title: "5. Cuánto tiempo los conservamos",
    items: [
      "Los datos de la cuenta, mientras dure tu relación con Rapitrip. Al inhabilitarla se conservan lo necesario para obligaciones legales y de auditoría, y las cuentas sin actividad durante doce (12) meses se revisan para eliminar o anonimizar sus datos.",
      "Los registros de inicios de sesión y de auditoría, treinta (30) días.",
      "La base de datos se respalda automáticamente; los respaldos anteriores a una eliminación conservan el dato hasta que vencen.",
    ],
    body: [],
  },
  {
    id: "derechos",
    title: "6. Tus derechos",
    body: [
      "Puedes pedir acceder a tus datos, rectificarlos, oponerte a su uso o que se eliminen, salvo los que una obligación legal o de auditoría obligue a conservar. Tu nombre, teléfono y foto los cambias en «Mi cuenta»; el correo y los roles los gestiona la administración. Las solicitudes de eliminación se atienden en un máximo de treinta (30) días.",
    ],
  },
  {
    id: "seguridad",
    title: "7. Cómo los protegemos",
    body: [
      "Reglas de acceso por rol en la base de datos, segundo factor obligatorio, bloqueo tras intentos fallidos, cierre por inactividad, cuentas separadas por app, correos institucionales para el equipo y registro de accesos. Si un incidente expone tus datos personales, te lo notificamos en un máximo de setenta y dos (72) horas.",
    ],
  },
  {
    id: "cambios",
    title: "8. Cambios",
    body: ["Si cambia esta política, publicaremos la nueva versión con su fecha."],
  },
];
