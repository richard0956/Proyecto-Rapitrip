import type { LegalSection } from "@rapitrip/ui";

/** Textos legales de la app del repartidor, basados en el Manual de Políticas de TI de Rapitrip. */
export const LEGAL_UPDATED = "4 de noviembre de 2026";
export const LEGAL_BASIS = "Basados en el Manual de Políticas, Normas, Controles y Procedimientos de TI de Rapitrip (septiembre de 2026).";

export const courierTerms: LegalSection[] = [
  {
    id: "alcance",
    title: "1. A quién aplican",
    body: [
      "Estos términos regulan el uso de la app del repartidor de Rapitrip. Al ingresar aceptas estos términos y la Política de privacidad del repartidor.",
    ],
  },
  {
    id: "cuenta",
    title: "2. Tu cuenta",
    items: [
      "Tu cuenta nace de la invitación que coordinación te envía desde tu ficha, después de verificar tus requisitos. Es personal: nadie más puede usarla.",
      "Es una cuenta solo de repartidor: no sirve para comprar en la tienda ni para entrar a la consola.",
      "Si otra persona va a usar tu teléfono, cierra tu sesión antes de entregárselo. Nunca entregues el teléfono con la app abierta.",
      "Cuando dejas de prestar el servicio, Rapitrip inhabilita tu cuenta en un máximo de veinticuatro (24) horas, después de reasignar tus entregas pendientes.",
    ],
    body: [],
  },
  {
    id: "pedidos",
    title: "3. Pedidos y custodia",
    items: [
      "Acepta solo los pedidos que te propone o asigna Rapitrip en la app, y revisa que la información coincida antes de salir.",
      "Al recoger, confirma con el código de recogida y revisa que los productos correspondan a lo indicado. Desde ese momento el pedido queda bajo tu custodia hasta entregarlo o devolverlo con autorización.",
      "Registra en la app cada avance del pedido, para que coordinación pueda darle seguimiento.",
    ],
    body: [],
  },
  {
    id: "entrega",
    title: "4. Entrega y evidencia",
    items: [
      "No marques un pedido como entregado sin confirmar la recepción con el cliente o la persona autorizada, con el código de entrega.",
      "Toma al menos una (1) fotografía del pedido entregado desde la app, en el momento de la entrega. Queda asociada al pedido con la fecha y la hora.",
      "Si la fotografía no se guarda, repórtalo e inténtalo de nuevo antes de seguir con otro pedido; si el problema sigue, avisa a coordinación.",
      "Si el cliente no está, reporta la incidencia antes de devolver el pedido.",
    ],
    body: [],
  },
  {
    id: "incidencias",
    title: "5. Incidencias en el camino",
    items: [
      "Reporta en la app toda incidencia en el momento en que ocurre (dirección incorrecta, cliente ausente, pedido dañado u otra) y nunca después de terminar tu turno. Indica el pedido, el tipo de incidencia y una descripción breve.",
      "Lo que pase de tu responsabilidad (cancelaciones, devoluciones extraordinarias o cambios importantes en el pedido) lo resuelve coordinación o la administración, en un máximo de treinta (30) minutos. No continúes sin su indicación.",
    ],
    body: [],
  },
  {
    id: "efectivo",
    title: "6. Pedidos en efectivo",
    body: [
      "Cobra al cliente el monto exacto del pedido, incluido el envío, y entrega el efectivo en caja para que lo confirme. Cada cobro queda registrado con tu nombre.",
    ],
  },
  {
    id: "datos-clientes",
    title: "7. Datos de los clientes",
    items: [
      "Ves la dirección y el teléfono del cliente solo mientras dura la entrega; al cerrarse, la app deja de mostrarlos.",
      "No conserves, copies ni compartas la dirección o el teléfono de un cliente, y no tomes capturas ni fotos de su información, salvo la fotografía de entrega que pide la app.",
      "Usa esos datos solo para completar la entrega.",
    ],
    body: [],
  },
  {
    id: "seguridad",
    title: "8. Seguridad",
    items: [
      "Si pierdes el teléfono, crees que alguien usó tu cuenta o recibes un mensaje sospechoso que pide tus datos, no respondas y repórtalo en un máximo de veinticuatro (24) horas desde «Perfil» → «Ayuda».",
      "Rapitrip nunca te pedirá tu contraseña por mensaje o teléfono.",
    ],
    body: [],
  },
  {
    id: "incumplimiento",
    title: "9. Incumplimiento y cambios",
    body: [
      "El incumplimiento de estos términos puede llevar a la suspensión o revocación del acceso. Estos términos pueden actualizarse; la versión vigente es la publicada con su fecha. Se rigen por las leyes de la República de Nicaragua.",
    ],
  },
];

export const courierPrivacy: LegalSection[] = [
  {
    id: "responsable",
    title: "1. Responsable",
    body: [
      "Rapitrip es responsable del tratamiento de los datos personales de sus repartidores, de acuerdo con la Ley N.° 787, Ley de Protección de Datos Personales de Nicaragua.",
    ],
  },
  {
    id: "datos",
    title: "2. Qué datos tratamos",
    items: [
      "Tu ficha: nombre, teléfono, tipo y clase de vehículo, departamento y, si lo entregaste, tu documento, que se guarda de forma privada.",
      "Tu cuenta: correo, contraseña cifrada, inicios de sesión (fecha, hora, dirección IP y dispositivo) y tu disponibilidad.",
      "Tus entregas: pedidos aceptados, avances, incidencias, cobros en efectivo, fotografías de evidencia y códigos de recogida y entrega.",
      "Tu ubicación, solo en el momento de registrar una recogida o una entrega y solo si das el permiso: sirve para avisar si estás lejos del punto. No hacemos seguimiento continuo.",
      "Avisos: la suscripción de tu navegador para enviarte las propuestas, si los activas.",
      "Tus preferencias (tema, mapas, sonido, pantalla encendida y animaciones) se guardan solo en tu teléfono.",
    ],
    body: [],
  },
  {
    id: "finalidad",
    title: "3. Para qué los usamos",
    body: [
      "Para asignarte pedidos según tu disponibilidad y tu vehículo, verificar cada recogida y entrega, atender incidencias, conciliar el efectivo, proteger tu cuenta y cumplir obligaciones legales. No se usan para ningún otro fin.",
    ],
  },
  {
    id: "acceso",
    title: "4. Quién los ve",
    items: [
      "Coordinación y la administración, para asignar, dar seguimiento y verificar las entregas.",
      "Caja, para confirmar el efectivo que entregas.",
      "Los proveedores que nos ayudan, solo para prestar el servicio: Supabase (base de datos, autenticación y archivos), Mapbox (mapas y rutas) y el servicio de avisos de tu navegador.",
    ],
    body: [],
  },
  {
    id: "conservacion",
    title: "5. Cuánto tiempo los conservamos",
    items: [
      "Tu ficha y tu cuenta, mientras prestes el servicio. Al inhabilitarla se conserva lo necesario para obligaciones legales y de auditoría.",
      "Las fotografías de evidencia, durante el plazo de conservación que fija la administración (noventa días salvo que se cambie); después se borran.",
      "Los inicios de sesión y la auditoría, treinta (30) días.",
    ],
    body: [],
  },
  {
    id: "derechos",
    title: "6. Tus derechos",
    body: [
      "Puedes pedir acceder a tus datos, rectificarlos, oponerte a su uso o que se eliminen, salvo los que una obligación legal o de auditoría obligue a conservar. Las solicitudes de eliminación se atienden en un máximo de treinta (30) días. Pídelo a coordinación.",
    ],
  },
  {
    id: "seguridad",
    title: "7. Cómo los protegemos",
    body: [
      "Reglas de acceso por rol en la base de datos, documentos y fotos en almacenamiento privado, cuentas separadas por app, bloqueo tras intentos fallidos y registro de accesos. Si un incidente expone tus datos personales, te lo notificamos en un máximo de setenta y dos (72) horas.",
    ],
  },
  {
    id: "cambios",
    title: "8. Cambios",
    body: ["Si cambia esta política, publicaremos la nueva versión con su fecha."],
  },
];
