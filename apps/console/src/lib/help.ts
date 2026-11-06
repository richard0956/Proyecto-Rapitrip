import type { ConsoleArea } from "@rapitrip/supabase";

/** Un tema del manual: qué es, los pasos para hacerlo, a dónde ir y un consejo. */
export type HelpTopic = { id: string; title: string; summary: string; steps: string[]; href?: string; tip?: string; superadminOnly?: boolean };
export type HelpGroup = { title: string; topics: HelpTopic[] };
export type HelpGuide = { role: string; intro: string; groups: HelpGroup[]; faq: { q: string; a: string }[] };

/** Lo que vale para todas las cuentas de la consola. */
const common: HelpGroup = {
  title: "Tu cuenta y tu sesión",
  topics: [
    {
      id: "sesion",
      title: "Ingreso, segundo factor y cierre por inactividad",
      summary: "Cada ingreso pide tu contraseña y el código de tu aplicación de autenticación.",
      steps: [
        "Ingresa con tu correo institucional y tu contraseña.",
        "Escribe el código de 6 dígitos de tu aplicación de autenticación.",
        "La sesión se cierra sola tras un rato sin actividad; vuelve a ingresar para seguir.",
        "Después de 5 contraseñas equivocadas te queda un intento; al siguiente, la cuenta se bloquea 15 minutos.",
      ],
      href: "/cuenta/seguridad",
      tip: "Si cambiaste de teléfono, pide a la administración que restablezca tu segundo factor.",
    },
    {
      id: "perfil",
      title: "Tu perfil y tu foto",
      summary: "Tu nombre aparece en la auditoría y en lo que registras.",
      steps: ["Entra a «Mi cuenta».", "Cambia tu foto, tu nombre o tu teléfono y guarda.", "El correo es institucional: si cambia, lo actualiza la administración."],
      href: "/cuenta",
    },
    {
      id: "preferencias",
      title: "Modo oscuro y animaciones",
      summary: "Elige cómo se ve la consola en tu computadora.",
      steps: ["Entra a «Mi cuenta» → «Preferencias».", "En «Tema» elige claro, oscuro o según el sistema.", "Si la computadora va lenta o el movimiento te molesta, activa «Reducir animaciones»."],
      href: "/cuenta/preferencias",
      tip: "Se guarda en este navegador: en otra computadora puedes elegir otra cosa.",
    },
    {
      id: "politicas",
      title: "Políticas de TI de Rapitrip",
      summary: "Las reglas de seguridad, cuentas, datos personales y operación que rigen la consola.",
      steps: ["Entra a «Mi cuenta» → «Políticas de TI».", "Con «Lo que aplica a mi rol» ves solo lo que te toca; con «Todo el manual», el documento completo.", "Usa el buscador para encontrar una regla, una norma o un procedimiento."],
      href: "/cuenta/politicas",
      tip: "Usar la consola implica cumplirlas: por ejemplo, reportar un incidente de seguridad dentro de las 24 horas.",
    },
  ],
};

const reportIncident = (area: string): HelpTopic => ({
  id: "incidente",
  title: "Reportar un incidente de TI",
  summary: "Si algo del sistema falla o ves algo sospechoso, avísale a la administración.",
  steps: [
    "Abre «Reportar incidente» en el menú, en Soporte.",
    "Elige si el sistema falla o si es de seguridad, y cuánto te afecta.",
    "Indica en qué pantalla pasó y cuéntalo con detalle (si hubo un mensaje de error, cópialo).",
    "Sigue su estado en «Mis reportes»: recibido, en atención o resuelto.",
  ],
  href: `/${area}/incidentes`,
  tip: "Un reporte «Grave» avisa por correo a la administración al instante.",
});

export const helpByArea: Record<ConsoleArea, HelpGuide> = {
  admin: {
    role: "Administración",
    intro: "Ves toda la operación de Rapitrip: personas, comercios, pedidos, dinero y seguridad.",
    groups: [
      {
        title: "Personas y comercios",
        topics: [
          {
            id: "usuarios",
            title: "Invitar y gestionar al equipo",
            summary: "Las cuentas del equipo entran solo por invitación.",
            steps: [
              "En «Usuarios y roles», pulsa «Invitar persona», escribe su correo institucional y elige el rol.",
              "La persona recibe un enlace de un solo uso que vence a los 4 días; las pendientes están en la pestaña «Invitaciones».",
              "Abre la ficha de una persona para suspender, reactivar o revocar cada rol; todo pide un motivo.",
              "Desde la ficha también se restablece el segundo factor si perdió su teléfono.",
            ],
            href: "/admin/usuarios",
            tip: "Cada cuenta es de una sola app: el correo no puede ser de una cuenta de la tienda ni del repartidor. Los dominios permitidos están en «Configuración».",
          },
          {
            id: "solicitudes",
            title: "Aprobar solicitudes de afiliación",
            summary: "Comercios con RUC y vendedores propios piden vender en Rapitrip.",
            steps: [
              "Filtra en «Solicitudes» por estado y tipo.",
              "Revisa los datos y el correo para la consola (puedes corregirlo); confirma que el convenio está firmado.",
              "Aprueba (se crea el comercio y se invita a ese correo) o rechaza con motivo.",
            ],
            href: "/admin/solicitudes",
            tip: "La cuenta de la tienda de quien lo pidió no entra a la consola. Si la invitación vence, reenvíala desde la ficha del comercio.",
          },
          {
            id: "comercios",
            title: "Comercios y vendedores",
            summary: "Un comercio puede tener varias tiendas; un vendedor propio vende desde un solo punto.",
            steps: ["Abre la ficha desde «Comercios» o «Vendedores».", "Revisa sus tiendas, ventas de 30 días y pedidos express reclasificados.", "Suspender bloquea su acceso y cierra sus tiendas; se puede revertir."],
            href: "/admin/comercios",
          },
          {
            id: "repartidores-admin",
            title: "Repartidores",
            summary: "Alta de repartidores y su desempeño.",
            steps: ["En «Repartidores» ves entregas, kilómetros y rapidez del periodo.", "Crea uno nuevo con «Nuevo repartidor».", "Abre su ficha para ver su actividad diaria y sus pedidos."],
            href: "/admin/repartidores",
          },
          {
            id: "catalogo",
            title: "Catálogo maestro",
            summary: "Categorías, marcas y tipos que comparten todos los comercios.",
            steps: ["En «Catálogo maestro» revisa los más vendidos y el punto de reorden.", "Corrige nombres o la clasificación de un producto, u ocúltalo con motivo."],
            href: "/admin/catalogo",
          },
          {
            id: "control-catalogo",
            title: "Control de catálogos y reincidencias",
            summary: "Reportes de clientes, revisión semanal y la medida ante comercios que reinciden.",
            steps: [
              "En «Control de catálogos», revisa los reportes en 24 horas: confirma o descarta con lo que encontraste.",
              "Cada semana registra la revisión de catálogos sin actualizar: se avisa a cada comercio.",
              "En «Reincidencias», decide la medida en 5 días hábiles; queda registrada y se le comunica al comercio.",
            ],
            href: "/admin/control-catalogo",
            tip: "Un comercio reincide con dos inconsistencias confirmadas en 90 días (Control 8.2.1).",
          },
        ],
      },
      {
        title: "Operación y dinero",
        topics: [
          {
            id: "liquidaciones",
            title: "Liquidaciones y conciliación mensual",
            summary: "Lo que se le paga a cada comercio, las reversiones por devoluciones y el cierre de cada mes.",
            steps: [
              "En «Liquidaciones» fija el convenio de cada comercio: comisión, cada cuántos días (máximo 15) y quién asume las devoluciones.",
              "Cuando toque, registra la liquidación con la referencia del pago: entran los pedidos entregados y cobrados, menos la comisión y las reversiones pendientes.",
              "Una devolución aprobada de un pedido ya liquidado genera su reversión, que se descuenta sola en la siguiente liquidación.",
              "Cada mes, en «Conciliación mensual», revisa las cifras y lo que no cuadra, y registra las diferencias y correcciones.",
            ],
            href: "/admin/liquidaciones",
            tip: "Las liquidaciones y conciliaciones registradas no se modifican: son la evidencia de la Política 9.",
          },
          {
            id: "facturas",
            title: "Libro de facturas",
            summary: "Las facturas y notas de crédito que Rapitrip emite por cada pedido, para su registro contable.",
            steps: [
              "Cada pedido web genera una factura de venta (los productos) y, si cobra envío, una de servicio. Se emiten cuando el pedido pasa a «por confirmar».",
              "Al cancelar o rechazar un pedido, o aprobar su devolución, se emite una nota de crédito por cada factura. La original nunca se modifica.",
              "En «Libro de facturas» filtra por fechas, comercio, método de pago y tipo, revisa lo facturado, lo acreditado y el neto, y descarga el CSV (las notas van en negativo).",
              "Cada documento tiene su PDF; también aparece en la ficha del pedido.",
            ],
            href: "/admin/facturas",
            tip: "Son comprobantes internos, sin validez fiscal. El comercio solo ve la factura de venta de sus pedidos.",
          },
          {
            id: "pedidos-admin",
            title: "Pedidos y excepciones",
            summary: "Todos los pedidos web y las ventas de mostrador.",
            steps: ["Filtra en «Pedidos» por estado o canal y abre la ficha del pedido.", "En la ficha ves productos, entrega, repartidor, pago e historial.", "Cancela solo como excepción y con motivo: se devuelve el stock y, si se pagó con tarjeta, el reembolso."],
            href: "/admin/pedidos",
            tip: "«Excepciones» reúne lo que necesita atención: confirmaciones vencidas, listos sin repartidor y reembolsos.",
          },
          {
            id: "caja-admin",
            title: "Caja, devoluciones y turnos",
            summary: "Turnos de caja con diferencia y devoluciones por aprobar.",
            steps: ["En «Caja y venta» revisa los turnos y sus diferencias.", "En «Devoluciones» aprueba o rechaza lo que piden los clientes."],
            href: "/admin/caja",
          },
        ],
      },
      {
        title: "Control y seguridad",
        topics: [
          {
            id: "auditoria",
            title: "Auditoría y accesos",
            summary: "Quién hizo qué y quién entró, de los últimos 30 días.",
            steps: ["Filtra por persona, acción o fecha.", "Cada consulta de accesos también queda registrada.", "Lo de más de 30 días se borra solo cada madrugada."],
            href: "/admin/auditoria",
          },
          {
            id: "incidentes-admin",
            title: "Incidentes de TI",
            summary: "Los reportes del equipo, de los repartidores y los detectados por el sistema.",
            steps: ["Revisa el origen: quién reportó y desde qué pantalla.", "Pulsa «Atender» al empezar y «Resolver» con la explicación al terminar: quien reportó la ve."],
            href: "/admin/incidentes",
          },
          {
            id: "datos",
            title: "Datos personales",
            summary: "Solicitudes de eliminación de cuenta y anonimización.",
            steps: ["Atiende las solicitudes pendientes con una nota.", "Aprobar anonimiza la cuenta: no se puede deshacer."],
            href: "/admin/datos-personales",
            superadminOnly: true,
          },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué no puedo suspender a otro administrador?", a: "Nadie gestiona un rol de igual o mayor rango que el suyo. Eso lo hace la dirección." },
      { q: "¿Cuánto tiempo se guarda la auditoría?", a: "30 días. Lo más antiguo se borra solo cada madrugada." },
    ],
  },
  caja: {
    role: "Caja",
    intro: "Registras las ventas de mostrador y cuadras el efectivo de tu turno.",
    groups: [
      {
        title: "Tu turno",
        topics: [
          {
            id: "abrir",
            title: "Abrir la caja",
            summary: "Sin turno abierto no se puede vender. Cada cajero abre su turno en su propia caja física.",
            steps: ["Entra a «Caja y venta».", "Elige tu caja: si ya tuvo cierres, empiezas con lo contado en el último; si es nueva, cuenta el efectivo y escríbelo.", "Pulsa «Abrir caja»."],
            href: "/caja",
          },
          {
            id: "vender",
            title: "Registrar una venta",
            summary: "La venta se arma por tienda.",
            steps: [
              "Pulsa «Nueva venta» en la barra del turno.",
              "Elige la tienda en el selector (escribe para buscarla) y agrega los productos.",
              "Elige efectivo o tarjeta. Con tarjeta escribe el voucher del terminal; con efectivo puedes calcular el vuelto.",
              "Pulsa «Cobrar».",
            ],
            href: "/caja",
            tip: "Una venta mal registrada se anula desde «Ventas del turno», con motivo: se devuelve el stock.",
          },
          {
            id: "repartidores-caja",
            title: "Recibir el efectivo de los repartidores",
            summary: "El repartidor toca «Efectivo entregado» y su entrega aparece en tu caja con un tiempo límite.",
            steps: [
              "En «Efectivo de repartidores» verás quién entrega y de qué pedidos (sin el monto: cuentas a ciegas).",
              "Cuenta el dinero delante del repartidor, pulsa «Contar y confirmar» y escribe el total. Si no coincide, la diferencia queda a su cargo.",
              "Si no te dio el efectivo, pulsa «No lo recibí» y explica por qué.",
            ],
            href: "/caja",
            tip: "Si no confirmas ni rechazas a tiempo, la entrega vence y queda registrada a tu nombre y al del repartidor.",
          },
          {
            id: "devoluciones-caja",
            title: "Devolver efectivo a un cliente",
            summary: "Solo devoluciones que la administración ya aprobó.",
            steps: ["Busca el pedido en «Devoluciones en efectivo».", "Entrega el dinero al cliente.", "Pulsa «Devolver efectivo» para registrarlo."],
            href: "/caja",
          },
          {
            id: "cerrar",
            title: "Cerrar la caja",
            summary: "Al terminar, cuentas la gaveta sin ver lo esperado; el resultado aparece después de cerrar.",
            steps: ["Confirma o rechaza antes las entregas de repartidores que esperan.", "Pulsa «Cerrar caja», cuenta el efectivo y escríbelo.", "Si hay incidencias, la nota es obligatoria. Una diferencia queda a tu nombre y la revisa administración."],
            href: "/caja",
          },
        ],
      },
      { title: "Seguimiento", topics: [{ id: "resumen-caja", title: "Resumen de caja", summary: "Cobros por medio de pago, turnos y lo pendiente de recibir.", steps: ["Abre «Resumen».", "Cambia el periodo entre hoy, quincena o mes.", "Filtra los turnos con diferencia."], href: "/caja/resumen" }, reportIncident("caja")] },
    ],
    faq: [
      { q: "¿Por qué el botón «Cobrar» está apagado?", a: "Falta un producto, el efectivo recibido no alcanza o, con tarjeta, falta el voucher de 4 a 20 caracteres." },
      { q: "¿Puedo cambiar mi contraseña?", a: "No desde aquí: la restablece la administración." },
    ],
  },
  coordinacion: {
    role: "Coordinación",
    intro: "Haces que cada pedido llegue: propones repartidores, sigues la entrega y atiendes sus avisos.",
    groups: [
      {
        title: "Despacho",
        topics: [
          {
            id: "catalogos",
            title: "Control de catálogos",
            summary: "Reportes de clientes sobre productos que no coinciden y la revisión semanal.",
            steps: [
              "Abre «Control de catálogos» → «Reportes»; revisa cada uno en 24 horas.",
              "Compara con el comercio y confirma (se le avisa y tiene 24 horas para corregir) o descarta.",
              "Una vez por semana, en «Revisión semanal», registra la revisión: se avisa a los comercios sin actualizar en más de 2 días.",
            ],
            href: "/coordinacion/catalogos",
          },
          {
            id: "lista",
            title: "La lista de pedidos",
            summary: "Por etapa: para despachar, en camino, en preparación, por confirmar y terminados.",
            steps: ["Abre «Pedidos»; la lista se actualiza sola.", "Las marcas te avisan lo urgente: propuesta rechazada, sin respuesta o aviso del repartidor.", "Abre la ficha del pedido para trabajarlo."],
            href: "/coordinacion",
          },
          {
            id: "proponer",
            title: "Proponer o asignar un repartidor",
            summary: "Lo normal es proponer; asignar directo es la excepción.",
            steps: [
              "En la ficha, en «Repartidor y aplicación», elige un repartidor disponible y envía la propuesta.",
              "Si la rechaza o no responde, propónsela a otro.",
              "Solo si es necesario, asígnalo directamente en la barra lateral.",
            ],
            href: "/coordinacion",
            tip: "Solo aparecen los repartidores que pueden llevar ese pedido (por vehículo y departamento).",
          },
          {
            id: "despachar",
            title: "Despachar y entregar",
            summary: "El repartidor registra recogida y entrega con foto y código desde su app.",
            steps: ["Si usa la app, deja que él registre cada paso.", "Si no puede, pulsa «Despachar» o «Marcar como entregado» y escribe el motivo.", "Si no recibe el código, libéralo con motivo."],
            href: "/coordinacion",
          },
          {
            id: "reclasificar",
            title: "Reclasificar a programado",
            summary: "Cuando un pedido express no cabe en una moto.",
            steps: ["Pulsa «Reclasificar a programado» en la ficha.", "Escribe el motivo: se le quita el repartidor y pasa a vehículo.", "El cliente conserva lo que pagó y ve el nuevo plazo."],
            href: "/coordinacion",
          },
        ],
      },
      {
        title: "Seguimiento",
        topics: [
          { id: "efectivo-coord", title: "Efectivo de repartidores", summary: "Quién tiene efectivo, cada entrega a caja y las faltas registradas.", steps: ["Abre «Efectivo de repartidores».", "Quien pasa el monto o las horas máximas no recibe pedidos en efectivo: recuérdale entregar en caja.", "Para un repartidor sin cuenta, registra su cobro y pulsa «Enviar a caja»."], href: "/coordinacion/efectivo" },
          { id: "resumen-coord", title: "Resumen del día e informe", summary: "Pedidos por etapa, ventas por medio de pago y excepciones.", steps: ["Abre «Resumen».", "Filtra por tienda o repartidor.", "Descarga el informe del día en CSV."], href: "/coordinacion/resumen" },
          reportIncident("coordinacion"),
        ],
      },
    ],
    faq: [
      { q: "¿Por qué no puedo despachar?", a: "El pedido necesita un repartidor asignado antes de pasar a «En camino»." },
      { q: "¿Puedo cambiar mi contraseña?", a: "No desde aquí: la restablece la administración." },
    ],
  },
  comercio: {
    role: "Comercio",
    intro: "Atiendes los pedidos de tus tiendas y mantienes tu catálogo y tu inventario al día.",
    groups: [
      {
        title: "Pedidos",
        topics: [
          {
            id: "pedidos-comercio",
            title: "Atender un pedido",
            summary: "Cada pedido pasa por tus manos antes de salir.",
            steps: [
              "Abre «Pedidos» y revisa los que están por confirmar.",
              "Confírmalo o recházalo con motivo. Los programados pueden pasar antes por validación.",
              "Pulsa «Empezar a preparar» y, al terminar, «Marcar como listo»: coordinación busca repartidor.",
            ],
            href: "/comercio/pedidos",
            tip: "Responde rápido: un pedido sin respuesta aparece como excepción a la administración.",
          },
        ],
      },
      {
        title: "Tiendas y catálogo",
        topics: [
          { id: "tiendas", title: "Mis tiendas", summary: "Horario, cierres temporales y costo de envío.", steps: ["Abre «Mis tiendas» y entra a una.", "Ajusta el horario de cada día y el costo de envío.", "Usa un cierre temporal si no vas a abrir."], href: "/comercio/tiendas" },
          {
            id: "productos",
            title: "Crear y publicar un producto",
            summary: "Un producto necesita al menos una variante activa para publicarse.",
            steps: [
              "En «Catálogo», crea el producto y abre su ficha.",
              "Agrega variantes con su precio y SKU; un precio más bajo que el anterior activa un descuento.",
              "Sube imágenes (la primera es la portada) y define el tipo de entrega con peso y medidas.",
              "Pulsa «Publicar».",
            ],
            href: "/comercio/catalogo",
            tip: "Un producto archivado ya no se edita ni vuelve a publicarse.",
          },
          {
            id: "mis-liquidaciones",
            title: "Tus liquidaciones",
            summary: "Lo que Rapitrip te paga por tus pedidos entregados y cobrados.",
            steps: ["Abre «Liquidaciones».", "Arriba ves lo que tienes por cobrar y tu convenio; abajo, cada liquidación recibida con su referencia.", "Si devuelven un pedido ya liquidado, se descuenta en la siguiente liquidación (según tu convenio)."],
            href: "/comercio/liquidaciones",
          },
          {
            id: "avisos-catalogo",
            title: "Avisos de Rapitrip sobre tu catálogo",
            summary: "Inconsistencias que te reportan y catálogos sin actualizar.",
            steps: ["Los avisos salen arriba en tu inicio y en «Catálogo».", "Si te confirman una inconsistencia, corrígela en 24 horas y pulsa «Ya lo corregí» con lo que cambiaste.", "Actualiza precios y disponibilidad por lo menos una vez al día."],
            href: "/comercio/catalogo",
            tip: "Dos inconsistencias confirmadas en 90 días llevan a una medida de la administración.",
          },
          { id: "inventario", title: "Inventario", summary: "Existencias por variante y alertas de reposición.", steps: ["Abre «Inventario».", "Registra el conteo de cada variante cuando cambien tus existencias.", "Revisa las variantes en punto de reorden o agotadas."], href: "/comercio/inventario" },
        ],
      },
      { title: "Soporte", topics: [reportIncident("comercio")] },
    ],
    faq: [
      { q: "¿Por qué no puedo publicar un producto?", a: "Necesita al menos una variante activa. Agrégala en «Variantes y precios» de su ficha." },
      { q: "¿Puedo cambiar mi contraseña?", a: "No desde aquí: la restablece la administración." },
    ],
  },
};

/** El manual de un área, con lo común al final y sin lo que el rol no ve (por ejemplo, lo reservado a la dirección). */
export function helpFor(area: ConsoleArea, isSuperadmin: boolean): HelpGuide {
  const guide = helpByArea[area];
  const groups = [...guide.groups, common].map((group) => ({ ...group, topics: group.topics.filter((topic) => !topic.superadminOnly || isSuperadmin) })).filter((group) => group.topics.length > 0);
  return { ...guide, role: area === "admin" && isSuperadmin ? "Dirección" : guide.role, groups };
}
