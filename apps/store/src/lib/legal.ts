/** Versión vigente de los textos legales. Se guarda en el perfil al crear la cuenta para saber qué aceptó cada persona. */
export const LEGAL_VERSION = "2026-10";
export const LEGAL_UPDATED = "17 de octubre de 2026";

export type LegalSection = { id: string; title: string; body: string[]; items?: string[] };

export const termsSections: LegalSection[] = [
  {
    id: "quienes-somos",
    title: "1. Qué es Rapitrip",
    body: [
      "Rapitrip es una plataforma que conecta a clientes con comercios afiliados para pedir productos y recibirlos por reparto. Estos términos regulan el uso de la tienda y de las cuentas creadas en ella.",
      "Al crear una cuenta o usar la tienda declaras que leíste y aceptas estos términos y la Política de privacidad.",
    ],
  },
  {
    id: "cuenta",
    title: "2. Tu cuenta",
    body: ["Para comprar o solicitar la afiliación de un comercio necesitas una cuenta con un correo verificado."],
    items: [
      "Debes dar datos verdaderos y mantenerlos al día.",
      "Eres responsable de la confidencialidad de tu contraseña y de lo que ocurra con tu cuenta.",
      "Por seguridad, la sesión de la tienda vence a las 24 horas y debes ingresar de nuevo.",
      "Puedes ingresar con tu correo y contraseña o con tu cuenta de Google.",
      "Puedes pedir que eliminemos tu cuenta en cualquier momento (ver Política de privacidad).",
    ],
  },
  {
    id: "uso",
    title: "3. Uso permitido",
    body: ["Te comprometes a usar Rapitrip de buena fe. No está permitido:"],
    items: [
      "Suplantar a otra persona o comercio, o dar información falsa.",
      "Intentar acceder a cuentas, datos o áreas que no te corresponden, o vulnerar las medidas de seguridad.",
      "Usar la plataforma para actividades ilícitas o para vender productos prohibidos por la ley.",
      "Automatizar el uso de forma que afecte el servicio de otras personas.",
    ],
  },
  {
    id: "comercios",
    title: "4. Comercios afiliados",
    body: [
      "Cualquier cliente puede solicitar que su negocio se afilie. La solicitud la revisa el equipo de Rapitrip, que puede aprobarla o rechazarla indicando el motivo, y la aprobación exige un convenio firmado.",
      "Los comercios son responsables de la calidad, el precio, la disponibilidad y la legalidad de lo que ofrecen. Rapitrip puede suspender o retirar a un comercio que incumpla estos términos o el convenio.",
    ],
  },
  {
    id: "pedidos",
    title: "5. Pedidos, precios y pagos",
    body: [
      "Los precios y las condiciones de cada pedido se muestran antes de confirmarlo. Las funciones de compra, pago y reparto se habilitan por etapas; las condiciones específicas de cada una se publicarán aquí cuando estén disponibles.",
    ],
  },
  {
    id: "responsabilidad",
    title: "6. Responsabilidad",
    body: [
      "Hacemos lo razonable para mantener el servicio disponible y seguro, pero no garantizamos que funcione sin interrupciones. Rapitrip no responde por daños indirectos ni por hechos fuera de su control, salvo lo que la ley no permita excluir.",
    ],
  },
  {
    id: "suspension",
    title: "7. Suspensión y cierre de cuentas",
    body: [
      "Podemos suspender o cerrar una cuenta que incumpla estos términos o ponga en riesgo a otras personas o a la plataforma. Las cuentas sin actividad durante 12 meses pueden anonimizarse conforme a la Política de privacidad.",
    ],
  },
  {
    id: "cambios",
    title: "8. Cambios y ley aplicable",
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
      "Rapitrip es responsable del tratamiento de los datos personales que recibe a través de la tienda y de la consola de administración, de acuerdo con la Ley 787, Ley de Protección de Datos Personales de Nicaragua.",
    ],
  },
  {
    id: "datos",
    title: "2. Qué datos tratamos",
    body: ["Solo pedimos lo necesario para prestar el servicio:"],
    items: [
      "Cuenta: nombre completo, correo, teléfono (opcional) y la contraseña, que guardamos cifrada y nunca podemos ver.",
      "Ingreso con Google: tu nombre y correo, que Google comparte con nosotros cuando lo autorizas.",
      "Solicitud de comercio: nombre del negocio, representante, teléfono, dirección y categoría.",
      "Seguridad: registro de accesos (fecha, resultado y dirección IP) y de acciones administrativas.",
      "Aceptación de estos textos: la versión que aceptaste y la fecha.",
    ],
  },
  {
    id: "finalidad",
    title: "3. Para qué los usamos",
    body: ["Tus datos se usan para crear y proteger tu cuenta, evaluar solicitudes de afiliación, enviarte correos del servicio (confirmación, recuperación de contraseña, estado de solicitudes), prevenir fraudes y cumplir obligaciones legales. No vendemos tus datos ni los usamos para publicidad de terceros."],
  },
  {
    id: "encargados",
    title: "4. Con quién los compartimos",
    body: ["Usamos proveedores que tratan datos por encargo nuestro y solo para prestar el servicio:"],
    items: [
      "Supabase: alojamiento de la base de datos y de la autenticación.",
      "Cloudflare Turnstile: verificación contra bots en formularios de acceso.",
      "Google: solo si eliges ingresar con tu cuenta de Google.",
      "Autoridades, cuando una ley o una orden válida nos obligue.",
    ],
  },
  {
    id: "cookies",
    title: "5. Cookies",
    body: [
      "Usamos únicamente cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de seguimiento, por eso no mostramos un aviso de consentimiento de cookies.",
    ],
  },
  {
    id: "conservacion",
    title: "6. Cuánto tiempo los conservamos",
    body: [
      "Conservamos tus datos mientras tu cuenta esté activa. Las cuentas sin actividad durante 12 meses se anonimizan, previa confirmación de un administrador. Algunos registros de auditoría se conservan sin datos personales para fines de seguridad.",
    ],
  },
  {
    id: "derechos",
    title: "7. Tus derechos",
    body: [
      "Puedes pedirnos acceder a tus datos, rectificarlos, actualizarlos, oponerte a su uso o que los eliminemos o anonimicemos, y pedir una copia de lo que tenemos sobre ti. Puedes corregir tu nombre y teléfono directamente en tu perfil. Para lo demás, escríbenos al contacto indicado abajo; responderemos en un plazo razonable.",
    ],
  },
  {
    id: "seguridad",
    title: "8. Cómo los protegemos",
    body: [
      "Aplicamos controles de acceso por rol a nivel de base de datos, cifrado en tránsito, verificación en dos pasos obligatoria para el personal, vencimiento de sesiones y registro de accesos. Ningún sistema es infalible; si ocurre un incidente que afecte tus datos, te lo informaremos.",
    ],
  },
  {
    id: "cambios",
    title: "9. Cambios a esta política",
    body: ["Si cambiamos esta política publicaremos la nueva versión con su fecha. Si el cambio es importante, te lo avisaremos."],
  },
];
