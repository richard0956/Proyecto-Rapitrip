// Generado por scripts/dev/build-it-policies.mjs desde docs/politicas/Manual_Politicas_TI_Rapitrip.md. No editar a mano.
import type { ItPolicyManual } from "./it-policies";

export const itPolicyManual: ItPolicyManual = {
  "title": "Manual de Políticas, Normas, Controles y Procedimientos de Tecnologías de la Información de Rapitrip",
  "date": "Septiembre de 2026",
  "policies": [
    {
      "number": 1,
      "title": "Seguridad de la Información",
      "objective": "Proteger la confidencialidad, integridad y disponibilidad de la información que clientes, comercios afiliados, repartidores y personal de Rapitrip generan y consultan a través de la aplicación.",
      "scope": "Aplica a toda la información gestionada dentro de la plataforma Rapitrip (datos de clientes, comercios, pedidos, pagos y repartidores) y a cualquier persona que la consulte o manipule desde la aplicación.",
      "guidelines": [
        "La información de la plataforma deberá usarse únicamente para los fines propios de la operación de Rapitrip.",
        "Ningún usuario deberá copiar, exportar o compartir información fuera de los canales autorizados por Rapitrip.",
        "Los datos de un cliente, comercio o pedido solo deberán ser visibles para quien los necesite para cumplir su función.",
        "Toda sesión abierta en la plataforma deberá cerrarse al dejar de usarla, sobre todo en dispositivos compartidos.",
        "No deberán tomarse capturas, impresiones ni copias de pantallas con información de clientes, comercios o pagos, salvo que la función del usuario lo requiera.",
        "Cualquier mensaje sospechoso, intento de suplantación o solicitud inusual de información deberá reportarse antes de responder o actuar sobre él.",
        "Todo incidente que comprometa la confidencialidad o integridad de la información, como la pérdida de un dispositivo, un acceso indebido o una filtración, deberá comunicarse sin demora al Administrador."
      ],
      "responsible": [
        "Administrador: supervisión general y atención de incidentes de seguridad de la información.",
        "Cada colaborador o usuario de la plataforma: uso adecuado de la información a la que tiene acceso por su rol."
      ],
      "normas": [
        {
          "code": "1.1",
          "title": "Uso y Gestión de la Información",
          "objective": "Establecer las reglas específicas para el uso, consulta y manejo de la información gestionada en la plataforma Rapitrip, de modo que cada usuario acceda y utilice únicamente la información necesaria para cumplir su función.",
          "scope": "Aplica a la información de clientes, comercios afiliados, pedidos, pagos y repartidores que se consulta, procesa o almacena a través de la aplicación Rapitrip.",
          "rules": [
            "Cada usuario deberá consultar y utilizar la información de la plataforma únicamente para ejecutar las tareas propias de su función; usarla para cualquier otro fin queda prohibido.",
            "El comercio afiliado no podrá copiar, exportar ni guardar fuera de la plataforma los datos de un cliente que no correspondan a un pedido activo con ese comercio.",
            "El repartidor no podrá conservar, copiar ni compartir la dirección o el número de contacto de un cliente una vez cerrada la entrega correspondiente.",
            "El encargado de ventas podrá consultar el historial de pedidos y los datos de contacto de los clientes para dar seguimiento a pedidos y reclamos, pero no podrá utilizar esa información para ningún otro fin.",
            "Ningún usuario podrá tomar capturas de pantalla, fotografías ni impresiones de la información de clientes, comercios o pagos, salvo que su función lo requiera de forma expresa.",
            "El Administrador deberá revisar cada tres (3) meses los accesos otorgados a cada rol, para verificar que correspondan a las funciones vigentes de cada usuario."
          ],
          "responsible": "Administrador: revisión periódica de accesos. Cada usuario: uso de la información dentro de los límites de su rol.",
          "controls": [
            {
              "code": "1.1.1",
              "title": "Autorización y Resguardo en la Salida de Información",
              "purpose": "Evitar que la información de clientes, comercios afiliados o pagos salga de la plataforma sin control, incluso cuando esa salida responda a una gestión legítima, como un respaldo, un reporte solicitado por el comercio dueño de los datos o una entrega de información a una autoridad competente.",
              "application": "Toda salida de información de clientes, comercios o pagos fuera de la plataforma deberá contar con la autorización previa del Administrador, quien indicará el motivo y el destinatario antes de remitirla. El archivo o reporte deberá enviarse por un canal que impida su lectura por terceros, y el Administrador deberá verificar la identidad del destinatario antes del envío.",
              "evidence": "Autorización de la salida con fecha y motivo, identidad del destinatario verificada, y registro del canal y la fecha en que se realizó la transferencia."
            }
          ]
        },
        {
          "code": "1.2",
          "title": "Cierre de Sesión y Protección de Dispositivos Compartidos",
          "objective": "Establecer los requisitos para el cierre de sesión y la protección del acceso a la plataforma Rapitrip cuando se usa desde un dispositivo compartido.",
          "scope": "Aplica a toda sesión abierta en la aplicación Rapitrip desde un dispositivo compartido, incluyendo equipos administrativos, tablets de comercios afiliados y teléfonos de repartidores utilizados por más de una persona.",
          "rules": [
            "Cada usuario deberá cerrar su sesión al terminar de usar la plataforma en un dispositivo compartido, antes de entregarlo a otra persona.",
            "La aplicación deberá cerrar automáticamente la sesión tras quince (15) minutos de inactividad cuando detecte su uso desde un dispositivo compartido.",
            "Ningún usuario podrá entregar un dispositivo a otra persona sin haber cerrado antes su sesión, aunque se trate de un compañero de trabajo.",
            "El usuario deberá volver a ingresar sus credenciales cada vez que la aplicación cierre su sesión de forma automática."
          ],
          "responsible": "Administrador: configuración del cierre automático. Cada usuario: cierre manual de su sesión.",
          "controls": []
        },
        {
          "code": "1.3",
          "title": "Reporte y Atención de Incidentes de Seguridad de la Información",
          "objective": "Definir el plazo y el mecanismo mediante el cual debe reportarse un incidente que comprometa la confidencialidad, integridad o disponibilidad de la información gestionada en la plataforma.",
          "scope": "Aplica a todo incidente relacionado con pérdida de dispositivos, accesos indebidos, filtración de información, suplantación o cualquier situación que comprometa la información de clientes, comercios, pedidos, pagos o repartidores.",
          "rules": [
            "El usuario que detecte un incidente de seguridad de la información deberá reportarlo al Administrador en un plazo máximo de veinticuatro (24) horas.",
            "El usuario que reporte un incidente deberá indicar, como mínimo, la fecha, el tipo de información involucrada y las personas afectadas.",
            "Ante un mensaje sospechoso de suplantación o phishing, el usuario deberá abstenerse de responder o entregar información, y reportarlo antes de tomar cualquier otra acción.",
            "El Administrador deberá registrar cada incidente reportado y las acciones tomadas para atenderlo."
          ],
          "responsible": "Administrador: registro y atención de incidentes. Cada usuario: reporte oportuno.",
          "controls": []
        }
      ]
    },
    {
      "number": 2,
      "title": "Gestión de Cuentas y Control de Accesos",
      "objective": "Definir cómo se crean, autentican y autorizan las cuentas de los cinco roles que operan en Rapitrip (cliente, comercio afiliado, repartidor, encargado de ventas y administrador), de modo que cada uno acceda únicamente a las funciones que su rol requiere.",
      "scope": "Aplica a toda cuenta creada en la aplicación Rapitrip y al mecanismo de autenticación de la plataforma que valida la identidad de cada usuario y determina sus permisos.",
      "guidelines": [
        "Toda persona que use la plataforma, sea cliente, comercio afiliado, repartidor, encargado de ventas o administrador, deberá contar con una cuenta propia. No se permitirán cuentas compartidas entre distintos usuarios.",
        "El cliente podrá registrarse por sí mismo desde la aplicación. La cuenta de comercio afiliado, repartidor y encargado de ventas solo se habilitará después de que el Administrador confirme la relación de esa persona o negocio con Rapitrip.",
        "El rol asignado a una cuenta determinará qué partes de la aplicación puede ver y qué acciones puede realizar en ella.",
        "Un comercio afiliado solo podrá consultar y modificar los productos de su propio negocio, sin acceso al catálogo o inventario de otros comercios.",
        "Un repartidor solo podrá ver y actualizar las entregas que le hayan sido asignadas, sin acceso a los pedidos o pagos de otros repartidores.",
        "El encargado de ventas podrá consultar y gestionar los pedidos entrantes y el historial de ventas de todos los clientes, pero no podrá crear ni modificar cuentas ni acceder a la configuración general de la plataforma.",
        "Ninguna función de compra, venta o entrega deberá ejecutarse sin que la persona haya iniciado sesión con su propia cuenta.",
        "Cuando un comercio se retire, un repartidor deje de prestar el servicio o un colaborador deje su cargo, el Administrador deberá inhabilitar su cuenta sin demora."
      ],
      "responsible": [
        "Administrador: habilitación, asignación de rol e inhabilitación de las cuentas de comercio afiliado, repartidor y encargado de ventas.",
        "Cada titular de cuenta: uso exclusivo de su cuenta dentro de las funciones correspondientes a su rol."
      ],
      "normas": [
        {
          "code": "2.1",
          "title": "Creación y Habilitación de Cuentas según el Rol",
          "objective": "Establecer los requisitos que debe cumplir la creación y habilitación de una cuenta en la plataforma Rapitrip, de acuerdo con el rol que le corresponde.",
          "scope": "Aplica a la creación de cuentas de cliente, comercio afiliado, repartidor, encargado de ventas y administrador dentro de la aplicación Rapitrip.",
          "rules": [
            "La plataforma no permitirá crear una cuenta con un correo electrónico o número de teléfono ya registrado en otra cuenta activa.",
            "La plataforma habilitará la cuenta del cliente de forma inmediata una vez que este verifique el correo o el teléfono proporcionado en el registro.",
            "El Administrador deberá confirmar la relación del comercio afiliado, el repartidor o el encargado de ventas con Rapitrip antes de habilitar su cuenta; mientras la cuenta esté en estado \"pendiente\", su titular no podrá iniciar sesión.",
            "El Administrador deberá definir el rol de una cuenta en el momento de habilitarla; ningún usuario podrá cambiar el rol de su propia cuenta.",
            "El usuario deberá establecer una contraseña de al menos ocho (8) caracteres al crear su cuenta."
          ],
          "responsible": "Administrador: confirmación, habilitación y asignación de rol. Cada solicitante: veracidad de sus datos y elección de contraseña.",
          "controls": []
        },
        {
          "code": "2.2",
          "title": "Restricción de Funciones según el Rol",
          "objective": "Delimitar qué pantallas y acciones puede utilizar cada rol dentro de la plataforma Rapitrip, de modo que ningún usuario opere fuera de las funciones propias de su rol.",
          "scope": "Aplica a las acciones que un cliente, comercio afiliado, repartidor, encargado de ventas o administrador puede ejecutar dentro de la aplicación Rapitrip, una vez que su cuenta está habilitada.",
          "rules": [
            "El comercio afiliado solo podrá consultar y modificar el catálogo y el inventario de su propio negocio; la plataforma le negará el acceso al catálogo de cualquier otro comercio.",
            "El repartidor solo podrá ver y actualizar las entregas que tenga asignadas; la plataforma no le mostrará pedidos ni pagos de otros repartidores.",
            "El encargado de ventas podrá consultar y gestionar los pedidos entrantes y el historial de ventas de todos los clientes, pero no podrá crear ni modificar cuentas ni cambiar la configuración general de la plataforma.",
            "Ningún usuario podrá ejecutar una compra, una venta o una entrega sin haber iniciado sesión con su propia cuenta."
          ],
          "responsible": "Administrador: definición de los permisos de cada rol. Cada usuario: uso de la plataforma dentro de las funciones de su rol.",
          "controls": [
            {
              "code": "2.2.1",
              "title": "Registro de Inicios de Sesión",
              "purpose": "Dejar constancia de cada inicio de sesión en la plataforma, de modo que pueda verificarse después quién ejecutó una acción y en qué momento, tal como lo exige esta norma para toda compra, venta o entrega.",
              "application": "La plataforma deberá registrar cada inicio de sesión de un usuario, indicando la cuenta, la fecha, la hora y el dispositivo utilizado cuando esté disponible, sin importar el rol de quien ingresa.",
              "evidence": "Registro de inicios de sesión con cuenta, fecha, hora y dispositivo, disponible para consulta del Administrador."
            }
          ]
        },
        {
          "code": "2.3",
          "title": "Inhabilitación de Cuentas",
          "objective": "Establecer el plazo y las condiciones bajo las cuales debe inhabilitarse una cuenta cuando la persona o el negocio deja de tener relación con Rapitrip.",
          "scope": "Aplica a las cuentas de comercio afiliado, repartidor, encargado de ventas y administrador dentro de la plataforma.",
          "rules": [
            "El Administrador deberá inhabilitar la cuenta en un plazo máximo de veinticuatro (24) horas desde que se confirme el retiro del comercio, la salida del repartidor o la baja del colaborador.",
            "La plataforma no permitirá iniciar sesión ni ejecutar ninguna acción desde una cuenta inhabilitada.",
            "El Administrador deberá resolver o reasignar los pedidos, las entregas o las liquidaciones pendientes del titular antes de completar la inhabilitación, o dejarlos documentados si no pueden resolverse de inmediato.",
            "El Administrador deberá autorizar de nuevo cualquier reactivación de una cuenta inhabilitada."
          ],
          "responsible": "Administrador: inhabilitación, resolución de pendientes y reactivación de cuentas.",
          "controls": []
        }
      ]
    },
    {
      "number": 3,
      "title": "Protección de Datos Personales y Seguridad de la Base de Datos",
      "objective": "Proteger los datos personales de clientes, comercios afiliados y repartidores controlando su acceso, respaldo y conservación dentro de la base de datos de Rapitrip.",
      "scope": "Aplica a los datos personales que Rapitrip recopila y almacena en su base de datos en Supabase, y a los mecanismos que controlan su acceso, respaldo y recuperación.",
      "guidelines": [
        "Rapitrip solo recopilará y almacenará en su base de datos los datos personales necesarios para registrar un cliente, verificar un comercio, asignar un repartidor o completar un pedido.",
        "Dentro de la base de datos, cada rol solo podrá leer o modificar los datos personales que necesite para cumplir su función. Esta restricción se aplicará mediante las reglas de acceso a nivel de fila que ofrece Supabase.",
        "Un comercio afiliado solo podrá acceder al nombre, la dirección de entrega y el contenido del pedido del cliente que le corresponde. Los datos de pago y el historial de otras compras permanecerán fuera de su alcance.",
        "Un repartidor solo podrá acceder a la dirección y el teléfono de contacto necesarios para completar la entrega que se le asignó.",
        "La información almacenada deberá respaldarse periódicamente y deberá poder recuperarse ante una pérdida o falla, sin depender de una sola copia.",
        "Ningún dato personal deberá conservarse en la base de datos más tiempo del necesario para la operación del servicio o el cumplimiento de una obligación legal.",
        "Todo incidente que exponga, altere o comprometa datos personales almacenados en la base de datos deberá comunicarse de inmediato al Administrador y, cuando corresponda, notificarse al titular de los datos.",
        "El tratamiento de los datos personales deberá respetar los derechos que la Ley N.° 787, Ley de Protección de Datos Personales, reconoce a sus titulares."
      ],
      "responsible": [
        "Administrador: configuración de las reglas de acceso en la base de datos, gestión de respaldos y atención de incidentes de datos personales.",
        "Cada colaborador, comercio afiliado y repartidor: uso de los datos personales únicamente dentro de los límites de su función."
      ],
      "normas": [
        {
          "code": "3.1",
          "title": "Control de Acceso a Datos Personales por Rol",
          "objective": "Establecer los requisitos técnicos mínimos para restringir el acceso a los datos personales almacenados en la base de datos de Rapitrip, de acuerdo con el rol de cada usuario.",
          "scope": "Aplica a los datos personales de clientes, comercios afiliados y repartidores almacenados en la base de datos de Rapitrip en Supabase.",
          "rules": [
            "El Administrador deberá restringir el acceso a los datos personales mediante reglas de seguridad a nivel de fila (Row Level Security) configuradas en Supabase para cada rol.",
            "La plataforma solo permitirá al comercio afiliado consultar el nombre, la dirección de entrega y el contenido del pedido del cliente que le corresponde; no le mostrará los datos de pago ni el historial de otras compras de ese cliente.",
            "La plataforma solo permitirá al repartidor consultar la dirección y el número de contacto necesarios para la entrega que tiene asignada, y le retirará ese acceso al cerrarse la entrega.",
            "La plataforma no permitirá a ningún rol distinto del Administrador exportar o descargar de forma masiva los datos personales almacenados en la base de datos.",
            "El Administrador deberá actualizar las reglas de acceso a nivel de fila cada vez que se cree, modifique o elimine un rol en la plataforma."
          ],
          "responsible": "Administrador: configuración y revisión de las reglas de acceso a nivel de fila.",
          "controls": [
            {
              "code": "3.1.1",
              "title": "Exportación Controlada de Datos Personales",
              "purpose": "Evitar que una exportación o descarga masiva de datos personales de la base de datos quede sin control sobre qué información sale, cuándo y hacia dónde.",
              "application": "Toda exportación o descarga masiva de datos personales deberá quedar restringida al Administrador, quien será el único autorizado para evaluarla y deberá indicar previamente el motivo y el destino de la información. El archivo exportado deberá cifrarse antes de enviarse o almacenarse fuera de la base de datos.",
              "evidence": "Motivo y destino autorizados antes de la exportación, archivo exportado cifrado, y registro de la operación con fecha, usuario y volumen de datos exportado."
            }
          ]
        },
        {
          "code": "3.2",
          "title": "Respaldo y Recuperación de la Base de Datos",
          "objective": "Garantizar que la información almacenada en la base de datos de Rapitrip pueda recuperarse ante una pérdida, falla o error, mediante la ejecución periódica de respaldos.",
          "scope": "Aplica a la base de datos de Rapitrip alojada en Supabase, incluyendo los datos de clientes, comercios, pedidos, pagos y repartidores.",
          "rules": [
            "El Administrador deberá configurar el respaldo automático de la base de datos con una frecuencia mínima diaria.",
            "El Administrador deberá conservar cada respaldo por un mínimo de siete (7) días antes de eliminarlo.",
            "El Administrador deberá probar la restauración de un respaldo al menos una (1) vez cada tres (3) meses, para verificar su integridad.",
            "La plataforma deberá restringir el acceso a los respaldos únicamente al Administrador.",
            "El Administrador deberá restaurar el respaldo disponible más reciente en un plazo máximo de veinticuatro (24) horas ante una pérdida o corrupción de información."
          ],
          "responsible": "Administrador.",
          "controls": []
        },
        {
          "code": "3.3",
          "title": "Conservación y Eliminación de Datos Personales",
          "objective": "Establecer el plazo máximo de conservación de los datos personales que ya no son necesarios para la operación del servicio, en cumplimiento de la Ley N.° 787.",
          "scope": "Aplica a los datos personales de clientes, comercios afiliados y repartidores que dejan de tener actividad en la plataforma.",
          "rules": [
            "El Administrador deberá revisar los datos personales de una cuenta inactiva por más de doce (12) meses, para determinar si corresponde eliminarlos o anonimizarlos.",
            "El Administrador no deberá conservar datos personales más allá del plazo necesario para cumplir una obligación legal, contable o de atención de reclamos.",
            "El Administrador deberá atender la solicitud de eliminación de datos personales que presente un titular en un plazo máximo de treinta (30) días, salvo que exista una obligación legal que impida eliminarlos.",
            "El Administrador deberá notificar al titular afectado, en un plazo máximo de setenta y dos (72) horas, todo incidente que exponga o comprometa sus datos personales."
          ],
          "responsible": "Administrador.",
          "controls": [
            {
              "code": "3.3.1",
              "title": "Eliminación Segura de Datos Personales",
              "purpose": "Garantizar que la eliminación o anonimización de datos personales, ya sea por inactividad de la cuenta o por solicitud del titular, se ejecute de forma completa e irreversible sobre la base de datos en uso, y no quede como un simple ocultamiento del registro.",
              "application": "Al eliminar o anonimizar los datos personales de una cuenta, el Administrador deberá verificar que el borrado se aplique sobre el registro completo en la disposición actual de la base de datos, y no únicamente sobre su visualización en la plataforma. Los respaldos ya generados que todavía contengan esa información conservarán el registro como histórico hasta cumplir el plazo de retención establecido en la Norma 3.2, sin que esto se considere un incumplimiento de la eliminación; los respaldos posteriores a la eliminación no deberán contener el dato eliminado.",
              "evidence": "Registro de la fecha de eliminación o anonimización, la cuenta afectada y la confirmación de que el registro fue eliminado de la disposición actual de la base de datos."
            }
          ]
        }
      ]
    },
    {
      "number": 4,
      "title": "Uso y Seguridad de la Red Wi-Fi",
      "objective": "Proteger la red Wi-Fi de Rapitrip para que el acceso a Internet se mantenga disponible y seguro para quienes administran la plataforma.",
      "scope": "Aplica a la red Wi-Fi que Rapitrip utiliza para conectar sus equipos de trabajo y acceder a la plataforma, y a las personas autorizadas para usarla.",
      "guidelines": [
        "La red Wi-Fi de Rapitrip deberá protegerse con una contraseña que solo conozcan las personas autorizadas a usarla.",
        "Ningún equipo o dispositivo ajeno a la operación de Rapitrip deberá conectarse a esta red sin autorización del Administrador.",
        "La contraseña de la red deberá cambiarse cuando exista sospecha de que fue compartida o conocida por alguien no autorizado.",
        "Los equipos que administran o dan soporte a la plataforma deberán priorizarse sobre otros usos de la red cuando la conexión sea limitada.",
        "Toda interrupción prolongada del servicio de Internet deberá reportarse al proveedor y comunicarse a quienes dependen de la conexión para atender pedidos o consultar la plataforma.",
        "Cuando la conexión a Internet falle, Rapitrip deberá recurrir a un medio alterno, como datos móviles, para no detener por completo la atención de pedidos."
      ],
      "responsible": [
        "Administrador: configuración y seguridad de la red, y gestión de la relación con el proveedor de Internet.",
        "Encargado de ventas y demás usuarios de la red interna: uso adecuado de la red y reporte de fallas."
      ],
      "normas": [
        {
          "code": "4.1",
          "title": "Contraseña y Acceso a la Red Wi-Fi",
          "objective": "Establecer los requisitos de la contraseña de la red Wi-Fi de Rapitrip y las condiciones para autorizar su uso.",
          "scope": "Aplica a la red Wi-Fi utilizada por Rapitrip para conectar sus equipos de trabajo y acceder a la plataforma.",
          "rules": [
            "El Administrador deberá establecer una contraseña de la red Wi-Fi de un mínimo de doce (12) caracteres, combinando letras y números.",
            "El Administrador deberá cambiar la contraseña de la red Wi-Fi al menos cada seis (6) meses, o de inmediato cuando sospeche que fue compartida con una persona no autorizada.",
            "El Administrador será el único autorizado para permitir la conexión de un nuevo equipo o dispositivo a la red.",
            "El Administrador deberá mantener la red utilizada para la operación de Rapitrip separada de cualquier red de invitados, cuando la infraestructura disponible lo permita."
          ],
          "responsible": "Administrador.",
          "controls": [
            {
              "code": "4.1.1",
              "title": "Revisión Periódica de Equipos Conectados",
              "purpose": "Detectar cualquier equipo conectado a la red Wi-Fi de Rapitrip que ya no cuente con autorización vigente, antes de que represente un acceso no controlado a la operación.",
              "application": "El Administrador deberá revisar la lista de equipos conectados a la red Wi-Fi con una frecuencia mínima mensual y desconectar de inmediato cualquier equipo que no reconozca como autorizado.",
              "evidence": "Registro de la revisión mensual con fecha, equipos encontrados y equipos desconectados por falta de autorización."
            }
          ]
        },
        {
          "code": "4.2",
          "title": "Continuidad ante Fallas de Conexión",
          "objective": "Establecer el plazo y el mecanismo alterno que debe activarse cuando falla la conexión a Internet, para no detener la atención de pedidos.",
          "scope": "Aplica a toda interrupción del servicio de Internet que afecte la operación de la plataforma Rapitrip.",
          "rules": [
            "El Administrador deberá reportar al proveedor toda interrupción del servicio de Internet en un plazo máximo de una (1) hora desde su detección.",
            "El Administrador deberá activar un medio alterno de conexión, como datos móviles, cuando la interrupción supere los treinta (30) minutos, para continuar la atención de pedidos.",
            "El Administrador deberá comunicar al encargado de ventas y a los comercios afiliados que puedan verse afectados toda interrupción prolongada del servicio de Internet."
          ],
          "responsible": "Administrador.",
          "controls": [
            {
              "code": "4.2.1",
              "title": "Verificación de Pedidos tras Restablecer la Conexión",
              "purpose": "Confirmar que ningún pedido gestionado durante una interrupción de Internet quedó sin registrar, duplicado o incompleto una vez restablecida la conexión.",
              "application": "Al restablecerse la conexión después de una interrupción, el Administrador deberá revisar los pedidos gestionados durante ese periodo mediante el medio alterno, para confirmar que quedaron registrados correctamente en la plataforma y corregir cualquier pedido duplicado, perdido o incompleto.",
              "evidence": "Registro de la revisión posterior a la interrupción, con fecha, pedidos revisados y correcciones aplicadas, si las hubo."
            }
          ]
        }
      ]
    },
    {
      "number": 5,
      "title": "Desarrollo, Cambios y Mantenimiento del Sistema",
      "objective": "Ordenar los cambios, actualizaciones y correcciones que se realicen al sistema de Rapitrip para que este se mantenga disponible, seguro y confiable.",
      "scope": "Aplica a toda modificación, actualización o corrección que se realice sobre la aplicación de Rapitrip, y a las personas autorizadas para desarrollarla o mantenerla.",
      "guidelines": [
        "Todo cambio al sistema deberá contar con la autorización del Administrador antes de implementarse.",
        "Ningún cambio deberá aplicarse directamente sobre la versión que los usuarios están utilizando sin haberse probado antes.",
        "El sistema deberá contar con una copia de la versión anterior a cada cambio, de modo que pueda restablecerse si el cambio genera un problema.",
        "Los cambios relevantes deberán quedar documentados, indicando qué se modificó y por qué se realizó.",
        "Todo error o falla detectado en el sistema deberá reportarse al Administrador y corregirse según su gravedad, dando prioridad a lo que afecte pedidos, pagos o entregas en curso.",
        "El acceso para desarrollar o modificar el sistema deberá limitarse a las personas autorizadas por el Administrador."
      ],
      "responsible": [
        "Administrador: autorización de cambios, control de versiones y atención de errores del sistema.",
        "Personal encargado del desarrollo y mantenimiento: pruebas, documentación y corrección de los cambios que realice."
      ],
      "normas": [
        {
          "code": "5.1",
          "title": "Autorización, Pruebas y Control de Versiones de los Cambios",
          "objective": "Establecer los requisitos que debe cumplir todo cambio realizado al sistema de Rapitrip antes de aplicarse sobre la versión en uso.",
          "scope": "Aplica a toda modificación, actualización o corrección realizada sobre la aplicación de Rapitrip.",
          "rules": [
            "El personal encargado del desarrollo deberá obtener la autorización del Administrador antes de implementar cualquier cambio en el sistema.",
            "El personal encargado del desarrollo deberá probar todo cambio en un entorno distinto al que utilizan los usuarios, antes de aplicarlo en la versión en uso.",
            "El personal encargado del desarrollo deberá conservar una copia de la versión anterior a cada cambio, para poder restablecerla si el cambio genera un problema.",
            "El personal encargado del desarrollo deberá documentar todo cambio relevante, indicando la fecha, el motivo y una descripción de lo modificado."
          ],
          "responsible": "Administrador: autorización y control de versiones. Personal encargado del desarrollo: pruebas, conservación de versiones y documentación.",
          "controls": [
            {
              "code": "5.1.1",
              "title": "Verificación Previa a la Autorización del Cambio",
              "purpose": "Confirmar que un cambio cuenta con la prueba en un entorno separado, la copia de la versión anterior y la documentación exigidas, antes de que el Administrador lo autorice para la versión en uso.",
              "application": "Antes de autorizar cualquier cambio, el Administrador deberá verificar que el personal de desarrollo completó la prueba en un entorno distinto al de los usuarios, conservó la copia de la versión anterior y documentó el cambio con fecha, motivo y descripción; si falta alguno de estos elementos, no autorizará el cambio.",
              "evidence": "Verificación de los tres elementos (prueba, copia de la versión anterior y documentación) firmada por el Administrador antes de cada autorización."
            }
          ]
        },
        {
          "code": "5.2",
          "title": "Atención de Errores según su Gravedad",
          "objective": "Establecer los plazos de atención de un error o falla detectado en el sistema, según su nivel de gravedad.",
          "scope": "Aplica a todo error o falla reportado sobre la aplicación de Rapitrip.",
          "rules": [
            "El usuario que detecte un error que impida procesar pedidos, pagos o entregas en curso deberá reportarlo de inmediato al Administrador; el personal encargado del desarrollo deberá corregirlo en un plazo máximo de cuatro (4) horas desde el reporte.",
            "El usuario que detecte un error que afecte una función secundaria, sin detener pedidos, pagos o entregas, deberá reportarlo al Administrador; el personal encargado del desarrollo deberá corregirlo en un plazo máximo de tres (3) días hábiles desde el reporte.",
            "El personal encargado del desarrollo deberá registrar todo error reportado, indicando la fecha, la descripción y la solución aplicada."
          ],
          "responsible": "Administrador: priorización. Personal encargado del desarrollo: corrección y registro.",
          "controls": [
            {
              "code": "5.2.1",
              "title": "Comprobación de la Corrección Aplicada",
              "purpose": "Comprobar que la corrección aplicada a un error que detuvo pedidos, pagos o entregas resolvió realmente el problema en la versión en uso, antes de cerrar el reporte como atendido.",
              "application": "Una vez aplicada la corrección de un error que haya detenido pedidos, pagos o entregas, el personal de desarrollo deberá comprobar su funcionamiento en la versión en uso, y el Administrador deberá confirmar esa comprobación antes de cerrar el reporte.",
              "evidence": "Registro de la comprobación posterior a la corrección, con fecha, resultado de la prueba y confirmación del Administrador."
            }
          ]
        }
      ]
    },
    {
      "number": 6,
      "title": "Procesamiento de Pedidos",
      "objective": "Regular el proceso del pedido desde que el cliente lo arma en el carrito hasta que queda listo para su entrega, integrando al sistema la forma en que Rapitrip lo maneja actualmente de forma física.",
      "scope": "Aplica al pedido desde que el cliente selecciona los productos y lo confirma, hasta que el comercio lo prepara y queda disponible para el repartidor. No incluye el cobro ni el pago, que se regulan en una política distinta.",
      "guidelines": [
        "El pedido inicia cuando el cliente selecciona los productos de un comercio afiliado desde el catálogo y los agrega a su carrito.",
        "El cliente deberá confirmar el pedido antes de que se envíe al comercio, revisando los productos, las cantidades y la dirección de entrega.",
        "Todo pedido confirmado deberá quedar registrado en el sistema con un identificador único que permita darle seguimiento durante su procesamiento.",
        "El comercio afiliado deberá confirmar la disponibilidad de los productos del pedido antes de iniciar su preparación, tal como lo hace actualmente de forma física.",
        "Si el comercio no puede completar el pedido según lo solicitado, deberá comunicarlo al cliente o al encargado de ventas antes de continuar, para decidir cómo proceder.",
        "El encargado de ventas podrá consultar el estado de los pedidos entrantes para darles seguimiento y resolver cualquier inconveniente durante su procesamiento.",
        "Una vez preparado, el pedido quedará disponible para que se le asigne un repartidor y continúe hacia la entrega."
      ],
      "responsible": [
        "Cliente: selección de productos, confirmación del pedido y de la dirección de entrega.",
        "Comercio afiliado: confirmación de disponibilidad y preparación del pedido.",
        "Encargado de ventas: seguimiento de los pedidos entrantes y resolución de inconvenientes durante su procesamiento."
      ],
      "normas": [
        {
          "code": "6.1",
          "title": "Registro e Identificación del Pedido",
          "objective": "Establecer los requisitos para el registro de un pedido confirmado, de manera que pueda identificarse y darle seguimiento durante su procesamiento.",
          "scope": "Aplica a todo pedido confirmado por un cliente desde el catálogo de un comercio afiliado.",
          "rules": [
            "La plataforma deberá registrar todo pedido confirmado por el cliente con un identificador único, que no podrá repetirse ni reutilizarse.",
            "La plataforma deberá incluir en el registro del pedido, como mínimo, los productos seleccionados, las cantidades, la dirección de entrega y el comercio afiliado correspondiente.",
            "El comercio afiliado deberá actualizar el estado del pedido en la plataforma en cada etapa de su preparación, desde que confirma su disponibilidad hasta que el pedido queda listo para el repartidor."
          ],
          "responsible": "Comercio afiliado: actualización del estado del pedido durante su preparación. Encargado de ventas: seguimiento del registro y atención de incidencias.",
          "controls": [
            {
              "code": "6.1.1",
              "title": "Revisión de Pedidos sin Avance de Estado",
              "purpose": "Detectar un pedido que permanece en la misma etapa de preparación más tiempo del razonable, antes de que el cliente quede sin información sobre su pedido.",
              "application": "El encargado de ventas deberá revisar todo pedido que no registre un cambio de estado durante más de treinta (30) minutos desde la última actualización del comercio afiliado, y deberá contactar al comercio para conocer la causa.",
              "evidence": "Registro de los pedidos revisados por inactividad de estado, con fecha, tiempo transcurrido y resultado del contacto con el comercio."
            }
          ]
        },
        {
          "code": "6.2",
          "title": "Confirmación de Disponibilidad y Comunicación de Incumplimiento",
          "objective": "Establecer el plazo en que el comercio afiliado debe confirmar la disponibilidad de un pedido y comunicar cualquier incumplimiento antes de iniciar la preparación.",
          "scope": "Aplica a todo pedido recibido por un comercio afiliado a través de la plataforma Rapitrip.",
          "rules": [
            "El comercio afiliado deberá confirmar la disponibilidad de los productos de un pedido en un plazo máximo de quince (15) minutos desde que lo recibe.",
            "El comercio afiliado deberá comunicar al cliente o al encargado de ventas, indicando el motivo, cuando no pueda completar un pedido según lo solicitado, antes de iniciar su preparación.",
            "El encargado de ventas deberá revisar todo pedido que no reciba confirmación de disponibilidad dentro del plazo establecido, para decidir cómo proceder."
          ],
          "responsible": "Comercio afiliado: confirmación de disponibilidad y comunicación de incumplimientos. Encargado de ventas: revisión de pedidos sin confirmar.",
          "controls": [
            {
              "code": "6.2.1",
              "title": "Resolución del Pedido tras un Incumplimiento",
              "purpose": "Resolver un pedido cuyo comercio afiliado reportó no poder completarlo, antes de que quede pendiente sin una decisión clara para el cliente.",
              "application": "Cuando el comercio afiliado comunique que no puede completar un pedido, el encargado de ventas deberá registrar en el sistema si el pedido se cancela, se modifica o se sustituye, en un plazo máximo de treinta (30) minutos desde la comunicación, y notificar la decisión al cliente.",
              "evidence": "Registro de la decisión tomada sobre el pedido, con fecha, motivo reportado por el comercio y confirmación de la notificación al cliente."
            }
          ]
        }
      ]
    },
    {
      "number": 7,
      "title": "Asignación y Entrega del Pedido",
      "objective": "Regular la asignación, custodia, seguimiento y confirmación de las entregas que realiza el repartidor, para que el pedido llegue al cliente de forma responsable y verificable.",
      "scope": "Aplica a la asignación de pedidos a los repartidores y al proceso de entrega desde la recogida en el comercio afiliado hasta la entrega al cliente o una devolución autorizada. No incluye el cobro del pedido, que se regula en una política distinta.",
      "guidelines": [
        "La asignación de pedidos a los repartidores deberá procurar una distribución ordenada del trabajo, considerando la disponibilidad de cada repartidor.",
        "El repartidor deberá aceptar únicamente los pedidos que le sean asignados en el sistema, verificando que la información coincida antes de iniciar el traslado.",
        "Al recoger el pedido en el comercio afiliado, el repartidor deberá verificar que los productos correspondan a lo indicado, y este quedará bajo su custodia hasta completar la entrega o una devolución autorizada.",
        "El avance del pedido, desde la recogida hasta la entrega, deberá quedar registrado en el sistema para que pueda darle seguimiento el encargado de ventas.",
        "Toda entrega completada deberá respaldarse con evidencia fotográfica que permita comprobarla y relacionarla con el pedido correspondiente.",
        "El repartidor no deberá marcar un pedido como entregado mientras no se haya confirmado su recepción por parte del cliente o de la persona autorizada.",
        "Cualquier inconveniente durante el traslado, como una dirección incorrecta, la ausencia del cliente o un daño al pedido, deberá reportarse de inmediato mediante los mecanismos establecidos para registrar la incidencia.",
        "Las decisiones que excedan la responsabilidad del repartidor, como cancelaciones, devoluciones extraordinarias o modificaciones relevantes del pedido, deberán resolverse con el encargado de ventas o el Administrador."
      ],
      "responsible": [
        "Repartidor: recogida, custodia, traslado, registro del avance y entrega del pedido asignado.",
        "Encargado de ventas: asignación de pedidos, seguimiento de las entregas y atención de las incidencias reportadas.",
        "Administrador: supervisión general del proceso de entrega y resolución de decisiones extraordinarias."
      ],
      "normas": [
        {
          "code": "7.1",
          "title": "Evidencia y Confirmación de la Entrega",
          "objective": "Establecer los requisitos que debe cumplir la evidencia de una entrega y la confirmación de su recepción por parte del cliente.",
          "scope": "Aplica a toda entrega realizada por un repartidor de la plataforma Rapitrip.",
          "rules": [
            "El repartidor deberá respaldar toda entrega completada con al menos una (1) fotografía del pedido entregado, tomada desde la aplicación al momento de la entrega.",
            "La plataforma deberá asociar la fotografía al identificador único del pedido correspondiente, con fecha y hora de la entrega.",
            "El repartidor no podrá marcar un pedido como entregado sin haber registrado la evidencia fotográfica y sin contar con la confirmación de recepción del cliente o de la persona autorizada.",
            "El repartidor deberá reportar la incidencia antes de proceder con una devolución, cuando el cliente no esté disponible para recibir el pedido."
          ],
          "responsible": "Repartidor: registro de la evidencia. Encargado de ventas: verificación ante incidencias.",
          "controls": [
            {
              "code": "7.1.1",
              "title": "Reintento de Registro de Evidencia Fotográfica",
              "purpose": "Confirmar que la fotografía de una entrega quedó guardada y asociada correctamente al pedido, antes de considerar la entrega registrada como completa.",
              "application": "Si la plataforma no logra guardar o asociar la fotografía de la entrega al pedido correspondiente, el repartidor deberá reportarlo de inmediato y volver a intentar el registro antes de continuar con el siguiente pedido; si el problema persiste, deberá informarlo al encargado de ventas.",
              "evidence": "Registro del intento fallido de carga de evidencia, con fecha, pedido afectado y resolución aplicada."
            }
          ]
        },
        {
          "code": "7.2",
          "title": "Registro de Incidencias durante el Traslado",
          "objective": "Establecer el plazo y la información mínima que debe reportarse ante un inconveniente ocurrido durante el traslado del pedido.",
          "scope": "Aplica a toda incidencia ocurrida entre la recogida del pedido en el comercio afiliado y su entrega al cliente.",
          "rules": [
            "El repartidor deberá reportar en el sistema toda incidencia en el momento en que ocurra, y en ningún caso después de finalizado su turno.",
            "El repartidor deberá indicar en el reporte el identificador del pedido, el tipo de incidencia y una breve descripción de lo ocurrido.",
            "El repartidor deberá remitir al encargado de ventas o al Administrador toda incidencia que implique una cancelación, devolución extraordinaria o modificación relevante del pedido, y no podrá continuar sin su resolución."
          ],
          "responsible": "Repartidor: reporte. Encargado de ventas: resolución de incidencias. Administrador: decisiones extraordinarias.",
          "controls": [
            {
              "code": "7.2.1",
              "title": "Plazo de Resolución de una Incidencia Escalada",
              "purpose": "Resolver una incidencia remitida al encargado de ventas o al Administrador en un plazo que no deje al repartidor ni al pedido detenidos de forma indefinida.",
              "application": "El encargado de ventas o el Administrador deberá resolver toda incidencia remitida por el repartidor en un plazo máximo de treinta (30) minutos desde su recepción, e indicar al repartidor cómo proceder con el pedido.",
              "evidence": "Registro de la resolución de la incidencia, con fecha, tiempo transcurrido desde el reporte y la instrucción dada al repartidor."
            }
          ]
        }
      ]
    },
    {
      "number": 8,
      "title": "Catálogo e Inventario de los Comercios Afiliados",
      "objective": "Regular la administración del catálogo y el inventario que cada comercio afiliado mantiene dentro de la plataforma, para que la información de sus productos sea correcta y esté disponible para los clientes.",
      "scope": "Aplica al catálogo de productos y al inventario que cada comercio afiliado administra dentro de la aplicación de Rapitrip.",
      "guidelines": [
        "Cada comercio afiliado será responsable de mantener actualizado su catálogo, incluyendo el nombre, la descripción, el precio y la disponibilidad de sus productos.",
        "El inventario deberá reflejar la disponibilidad real de los productos, de manera que un cliente no pueda seleccionar un producto agotado.",
        "Un comercio afiliado solo podrá administrar el catálogo y el inventario de su propio negocio, conforme a lo establecido en la política de cuentas y accesos.",
        "Los precios y las descripciones publicadas deberán corresponder a los productos que efectivamente ofrece el comercio.",
        "El comercio afiliado deberá retirar del catálogo, o marcar como no disponibles, los productos que ya no ofrezca.",
        "El encargado de ventas o el Administrador podrán revisar el catálogo de un comercio cuando exista una inconsistencia reportada por un cliente u otro usuario."
      ],
      "responsible": [
        "Comercio afiliado: actualización del catálogo y del inventario de su negocio.",
        "Encargado de ventas: revisión del catálogo ante inconsistencias reportadas.",
        "Administrador: supervisión general y atención de incumplimientos."
      ],
      "normas": [
        {
          "code": "8.1",
          "title": "Actualización del Catálogo e Inventario",
          "objective": "Establecer los requisitos mínimos para mantener actualizado el catálogo y el inventario de cada comercio afiliado dentro de la plataforma.",
          "scope": "Aplica al catálogo de productos y al inventario que administra cada comercio afiliado en la aplicación Rapitrip.",
          "rules": [
            "El comercio afiliado deberá publicar cada producto en el catálogo con nombre, descripción, precio y disponibilidad.",
            "El comercio afiliado deberá marcar como no disponible todo producto agotado, antes de que un cliente pueda seleccionarlo.",
            "El comercio afiliado deberá actualizar la disponibilidad de sus productos con una frecuencia mínima diaria, y de inmediato cuando alguno se agote.",
            "El comercio afiliado deberá cobrar al cliente el mismo precio publicado en el catálogo al momento del pedido.",
            "El comercio afiliado deberá retirar del catálogo, o marcar como no disponible, todo producto que deje de ofrecer, en un plazo máximo de veinticuatro (24) horas desde que deja de ofrecerlo."
          ],
          "responsible": "Comercio afiliado.",
          "controls": [
            {
              "code": "8.1.1",
              "title": "Revisión Periódica de Catálogos sin Actualizar",
              "purpose": "Detectar un catálogo que un comercio afiliado no ha actualizado dentro del plazo exigido, antes de que un cliente reciba información desactualizada sobre productos o precios.",
              "application": "El encargado de ventas deberá revisar semanalmente qué comercios afiliados no registran una actualización de su catálogo o inventario en más de dos (2) días, y deberá notificarlos para que corrijan la situación.",
              "evidence": "Registro de la revisión semanal con los comercios encontrados sin actualización reciente y la notificación enviada."
            }
          ]
        },
        {
          "code": "8.2",
          "title": "Revisión del Catálogo ante Inconsistencias",
          "objective": "Establecer el plazo y el procedimiento para revisar el catálogo de un comercio afiliado cuando se reporte una inconsistencia.",
          "scope": "Aplica a toda inconsistencia reportada por un cliente u otro usuario sobre el catálogo o inventario de un comercio afiliado.",
          "rules": [
            "El encargado de ventas deberá revisar toda inconsistencia reportada en un plazo máximo de veinticuatro (24) horas.",
            "Cuando la inconsistencia se confirme, el encargado de ventas deberá notificar al comercio afiliado para que corrija la información en un plazo máximo de veinticuatro (24) horas adicionales.",
            "El encargado de ventas deberá reportar al Administrador la reincidencia de un comercio afiliado en inconsistencias del catálogo, para que este evalúe las medidas correspondientes."
          ],
          "responsible": "Encargado de ventas: revisión, notificación y reporte de reincidencias. Administrador: evaluación de medidas ante reincidencia.",
          "controls": [
            {
              "code": "8.2.1",
              "title": "Evaluación y Registro de la Medida ante Reincidencia",
              "purpose": "Asegurar que la reincidencia de un comercio afiliado en inconsistencias del catálogo, reportada por el encargado de ventas, sea evaluada y resuelta por el Administrador dentro de un plazo definido, sin quedar como un reporte sin respuesta.",
              "application": "Recibido el reporte de reincidencia, el Administrador deberá revisar el historial de inconsistencias del comercio afiliado y determinar la medida correspondiente en un plazo máximo de cinco (5) días hábiles, comunicando su decisión al encargado de ventas y, cuando corresponda, al comercio afiliado.",
              "evidence": "Registro de la fecha del reporte de reincidencia, el historial revisado, la medida determinada por el Administrador y la fecha en que se comunicó la decisión."
            }
          ]
        }
      ]
    },
    {
      "number": 9,
      "title": "Pagos, Cobros y Liquidación con los Comercios Afiliados",
      "objective": "Regular el cobro al cliente, la liquidación al comercio afiliado y la reversión de esa liquidación cuando se acepte una devolución, para que el manejo del dinero del pedido sea correcto y verificable.",
      "scope": "Aplica al cobro que se realiza al cliente, a la liquidación que Rapitrip efectúa al comercio afiliado por cada pedido y a las devoluciones que impliquen la reversión de dicha liquidación.",
      "guidelines": [
        "El cobro al cliente deberá corresponder al monto del pedido confirmado, incluyendo los productos y cualquier cargo adicional que corresponda.",
        "Rapitrip podrá liquidar al comercio afiliado el valor de un pedido de forma anticipada, antes de que el cliente confirme su recepción, siempre que esa liquidación quede registrada en el sistema.",
        "Toda devolución aceptada deberá quedar registrada en el sistema, relacionada con el pedido y con la liquidación que ya se le haya realizado al comercio.",
        "Cuando se acepte una devolución sobre un pedido cuya liquidación ya fue adelantada al comercio, deberá generarse una reversión por el monto correspondiente.",
        "La reversión de una liquidación podrá aplicarse como descuento en la siguiente liquidación pendiente del comercio, en lugar de exigirle la devolución inmediata del dinero.",
        "El acuerdo con cada comercio afiliado deberá establecer quién asume el costo de la devolución según su causa y cómo se revierte la liquidación adelantada.",
        "Todo cobro, liquidación y reversión deberá quedar registrado de manera que pueda verificarse el monto neto correspondiente a cada pedido."
      ],
      "responsible": [
        "Administrador: liquidación con los comercios afiliados, aprobación de devoluciones y control de las reversiones.",
        "Encargado de ventas: gestión del cobro al cliente y registro de las solicitudes de devolución.",
        "Comercio afiliado: cumplimiento del acuerdo de devolución establecido con Rapitrip."
      ],
      "normas": [
        {
          "code": "9.1",
          "title": "Registro del Cobro y la Liquidación",
          "objective": "Establecer los requisitos mínimos para el registro del cobro al cliente y la liquidación correspondiente al comercio afiliado.",
          "scope": "Aplica al cobro de todo pedido confirmado y a la liquidación que Rapitrip realiza al comercio afiliado por ese pedido.",
          "rules": [
            "El encargado de ventas deberá registrar el cobro por el monto exacto del pedido confirmado, incluyendo los cargos adicionales que apliquen.",
            "El Administrador deberá registrar en el sistema toda liquidación a un comercio afiliado, indicando el pedido, el monto y la fecha correspondiente.",
            "El Administrador deberá liquidar a cada comercio afiliado conforme a la periodicidad establecida en su acuerdo con Rapitrip, que en ningún caso podrá exceder los quince (15) días.",
            "La plataforma deberá permitir verificar el monto neto correspondiente a cada pedido a partir del registro del cobro, la liquidación y, cuando corresponda, su reversión."
          ],
          "responsible": "Administrador: liquidación. Encargado de ventas: registro del cobro.",
          "controls": [
            {
              "code": "9.1.1",
              "title": "Conciliación Periódica de Cobros y Liquidaciones",
              "purpose": "Detectar cualquier diferencia entre el cobro registrado al cliente, la liquidación realizada al comercio y su reversión, antes de que se acumule sin corregirse.",
              "application": "El Administrador deberá conciliar mensualmente los cobros, las liquidaciones y las reversiones registradas en el sistema, y corregir cualquier diferencia que encuentre antes del cierre de ese mes.",
              "evidence": "Registro de la conciliación mensual con fecha, diferencias encontradas y correcciones aplicadas."
            }
          ]
        },
        {
          "code": "9.2",
          "title": "Reversión de Liquidación por Devolución",
          "objective": "Establecer el plazo y el mecanismo para revertir una liquidación ya realizada a un comercio afiliado cuando se acepta una devolución sobre el pedido correspondiente.",
          "scope": "Aplica a toda devolución aceptada sobre un pedido cuya liquidación ya fue adelantada al comercio afiliado.",
          "rules": [
            "El encargado de ventas deberá registrar toda solicitud de devolución que presente un cliente sobre un pedido ya entregado y liquidado al comercio, indicando el pedido y el motivo.",
            "El Administrador deberá aprobar o rechazar la solicitud de devolución en un plazo máximo de tres (3) días hábiles, antes de generar cualquier reversión de liquidación.",
            "La plataforma deberá relacionar toda devolución aprobada con el pedido y con la liquidación previamente realizada.",
            "El Administrador deberá aplicar la reversión del monto correspondiente como descuento en la siguiente liquidación pendiente del comercio afiliado, en un plazo máximo de un (1) ciclo de liquidación.",
            "El Administrador deberá definir en el acuerdo con cada comercio afiliado quién asume el costo de la devolución según su causa, antes de generar la reversión."
          ],
          "responsible": "Administrador: aprobación de la solicitud y aplicación de la reversión. Encargado de ventas: registro de la solicitud de devolución.",
          "controls": []
        }
      ]
    }
  ],
  "procedures": {
    "objective": "Establecer la secuencia de pasos que debe seguirse para ejecutar, de forma ordenada y verificable, los procesos de mayor peso relacionados con el giro de negocio y los módulos del sistema de Rapitrip, en desarrollo del marco de políticas y normas ya establecido.",
    "scope": "Aplica a los procesos que, por su relación con una o varias normas y políticas, requieren una secuencia operativa propia. No todas las políticas ni todas las normas tienen necesariamente un procedimiento asociado; se desarrollan únicamente los procesos clave identificados a partir del diagnóstico de Rapitrip y de la lógica de sus normas.",
    "intro": [
      "Los procedimientos se numeran de forma continua (1, 2, 3…) según el orden en que aparecen en este apartado, y se presentan siguiendo el orden numeral de las políticas con las que están más fuertemente relacionados."
    ],
    "items": [
      {
        "number": 1,
        "title": "Bloqueo y Cierre de Sesión en Equipos Compartidos",
        "objective": "Proteger los equipos compartidos frente a accesos no autorizados mediante el bloqueo y cierre de sesión oportuno.",
        "scope": "Aplica a las estaciones de trabajo compartidas de la oficina principal, utilizadas por los colaboradores internos. No aplica a los dispositivos personales de repartidores ni a las cuentas de comercios afiliados o clientes, que acceden desde sus propios dispositivos.",
        "responsible": "Cada colaborador que usa un equipo compartido (bloquea y cierra su sesión), Administrador (configura y verifica el bloqueo automático).",
        "relation": "Norma 1.2 (Cierre de Sesión y Protección de Dispositivos Compartidos, Política 1).",
        "steps": [
          "El Administrador configura en cada equipo compartido un bloqueo automático de pantalla que se activa tras un periodo breve de inactividad, exigiendo la contraseña del usuario para reanudar el uso.",
          "Cada colaborador inicia sesión con sus propias credenciales al comenzar a usar un equipo compartido, nunca sobre la sesión abierta de otro colaborador.",
          "Si el colaborador debe alejarse del equipo, aunque sea brevemente, bloquea manualmente la pantalla antes de retirarse, sin esperar a que actúe el bloqueo automático.",
          "Al finalizar su turno o el uso del equipo, el colaborador cierra por completo su sesión en todas las aplicaciones y servicios abiertos (correo, Drive, Notion, sistema de Rapitrip), no solo bloquea la pantalla.",
          "Si un colaborador encuentra el equipo con una sesión abierta que no le pertenece, la cierra antes de iniciar la suya y lo reporta al Administrador conforme al Procedimiento 2 (Reporte y Atención de Incidentes de Seguridad de la Información).",
          "El Administrador verifica periódicamente que el bloqueo automático permanezca activo en los equipos y no haya sido desactivado."
        ],
        "evidence": "Configuración de bloqueo automático activa en cada equipo, reportes de sesiones encontradas abiertas cuando ocurran.",
        "result": "Equipos compartidos protegidos en todo momento, sin sesiones abiertas sin vigilancia, sin depender únicamente de la disciplina individual."
      },
      {
        "number": 2,
        "title": "Reporte y Atención de Incidentes de Seguridad de la Información",
        "objective": "Reportar, atender y registrar de forma oportuna todo incidente de seguridad de la información.",
        "scope": "Aplica a cualquier incidente de seguridad de la información (acceso no autorizado, pérdida o exposición de información, dispositivo comprometido, sesión abierta indebidamente, entre otros) detectado por un colaborador interno, un comercio afiliado, un repartidor o un cliente. No aplica a errores funcionales del sistema sin implicación de seguridad, que se rigen por la Norma 5.2 (Política 5).",
        "responsible": "Quien detecta el incidente (cualquier colaborador, comercio, repartidor o cliente), Administrador (recibe, evalúa, decide las acciones y registra el cierre).",
        "relation": "Norma 1.3 (Reporte y Atención de Incidentes de Seguridad de la Información, Política 1).",
        "steps": [
          "Quien detecta un posible incidente lo reporta de inmediato al Administrador, describiendo qué ocurrió, cuándo y qué información podría estar involucrada.",
          "El Administrador registra el incidente (fecha, quien reporta, descripción, información involucrada).",
          "El Administrador evalúa el alcance del incidente: si no compromete información sensible ni el acceso a cuentas o sistemas, corrige la situación de inmediato (cierra la sesión, revierte el acceso) y continúa en el paso 6; si compromete o podría comprometer información sensible, cuentas o sistemas, continúa en el paso 4.",
          "El Administrador contiene el incidente: revoca o cambia las credenciales afectadas, cierra las sesiones activas de la cuenta comprometida y, si corresponde, notifica a los afectados (cliente, comercio o colaborador cuya información pudiera estar involucrada).",
          "El Administrador determina la causa del incidente y aplica las acciones correctivas necesarias para evitar que se repita (reforzar el bloqueo de equipos, corregir permisos, capacitar al colaborador involucrado, según el caso).",
          "El Administrador registra el cierre del incidente, indicando la acción tomada y la fecha de resolución, en el registro de incidentes de seguridad de la información."
        ],
        "evidence": "Registro de incidentes de seguridad de la información (fecha, reportante, descripción, gravedad, acción tomada, fecha de cierre).",
        "result": "Todo incidente reportado, evaluado, contenido y corregido cuando corresponde, y registrado de forma que permita identificar recurrencias y fortalecer la prevención."
      },
      {
        "number": 3,
        "title": "Creación y Habilitación de Cuentas de Usuario (Roles, Permisos y Credenciales)",
        "objective": "Crear y habilitar cuentas de usuario de forma autorizada y verificada, con el rol y los permisos correspondientes a su función.",
        "scope": "Aplica a la creación de cuentas de comercio afiliado, cliente, repartidor y personal interno. No aplica a la restricción de funciones ya creada la cuenta (Norma 2.2) ni a su baja (Procedimiento 5).",
        "responsible": "Comercio afiliado / candidato a repartidor (presentan solicitud), Cliente (se autoregistra), Administrador (evalúa, aprueba, formaliza convenio, crea la cuenta, asigna rol y permisos, entrega credenciales), Plataforma (valida datos, genera la cuenta de cliente automáticamente y genera credenciales temporales).",
        "relation": "Norma 2.1 (Creación y Habilitación de Cuentas según el Rol) y Norma 2.2 (Restricción de Funciones según el Rol, Política 2).",
        "steps": [
          "Se origina la necesidad de una nueva cuenta, según uno de los siguientes casos: 1.1 solicitud de afiliación de un comercio, 1.2 solicitud de un candidato a repartidor, 1.3 autoregistro de un cliente, 1.4 necesidad de una cuenta de personal interno determinada por el Administrador.",
          "Según el caso: si es 1.1, continúa en el paso 3; si es 1.2, continúa en el paso 8; si es 1.3, continúa en el paso 12; si es 1.4, continúa en el paso 14.",
          "El comercio interesado presenta al Administrador su solicitud de afiliación junto con la información y documentación del negocio (datos generales, ubicación, categoría de productos).",
          "El Administrador revisa la solicitud y verifica que el comercio cumple los requisitos mínimos de afiliación.",
          "El Administrador evalúa el resultado: si el comercio no cumple los requisitos, rechaza la solicitud, comunica el motivo y el procedimiento finaliza aquí; si cumple los requisitos, continúa en el paso 6.",
          "El Administrador negocia y formaliza el convenio o contrato de afiliación, dejando constancia por escrito de las condiciones (comisión, responsabilidades, alcance del catálogo).",
          "Firmado el convenio, el Administrador crea la cuenta con el rol \"Comercio Afiliado\" y los permisos de la Norma 2.2; la plataforma genera una contraseña temporal de un solo uso, que el Administrador entrega por un canal seguro; el comercio la cambia en su primer inicio de sesión; el Administrador registra fecha de alta, convenio y rol asignado. El procedimiento finaliza aquí.",
          "El candidato a repartidor presenta al Administrador su solicitud junto con los requisitos definidos por Rapitrip (identidad, referencias, disponibilidad de vehículo).",
          "El Administrador verifica el cumplimiento de los requisitos.",
          "El Administrador evalúa el resultado: si no cumple los requisitos, rechaza la solicitud, comunica el motivo y el procedimiento finaliza aquí; si cumple, continúa en el paso 11.",
          "El Administrador crea la cuenta con el rol \"Repartidor\" y los permisos correspondientes; la plataforma genera las credenciales; el repartidor las recibe y cambia su contraseña en el primer acceso; el Administrador registra fecha de alta y rol asignado. El procedimiento finaliza aquí.",
          "El cliente se autoregistra ingresando sus datos personales y de contacto.",
          "La plataforma valida el formato de los datos: si son inválidos o incompletos, rechaza el registro y solicita corregir la información, repitiendo el paso 12; si son válidos, crea automáticamente la cuenta con el rol \"Cliente\", sin intervención del Administrador, y envía confirmación de registro. El procedimiento finaliza aquí.",
          "El Administrador determina la necesidad de una nueva cuenta interna según la estructura de personal.",
          "El Administrador crea la cuenta, asigna el rol correspondiente y los permisos de la Norma 2.2, y entrega las credenciales de forma directa y segura; registra fecha de alta y rol asignado. El procedimiento finaliza aquí."
        ],
        "evidence": "Solicitud y documentación anexa, convenio firmado (comercios), registro de cuentas (fecha, rol, responsable), confirmación de entrega de credenciales o de registro.",
        "result": "Cuenta creada, verificada, con rol y permisos correctos, credenciales entregadas de forma segura cuando aplica, y trazabilidad de quién autorizó y creó la cuenta."
      },
      {
        "number": 4,
        "title": "Actualización de Cuentas de Usuario (Traslados, Cambio de Funciones)",
        "objective": "Actualizar de forma autorizada y documentada los cambios de rol o función de las cuentas existentes.",
        "scope": "Aplica a cambios de rol o traslado de funciones en cuentas activas de comercios, repartidores y personal interno. No cubre la creación inicial (Procedimiento 3) ni la baja (Procedimiento 5).",
        "responsible": "Usuario titular (solicita o reporta el cambio), Administrador (evalúa, autoriza, ejecuta la actualización).",
        "relation": "Norma 2.2 (Restricción de Funciones según el Rol, Política 2).",
        "steps": [
          "El usuario titular, o su superior directo, solicita al Administrador un cambio de función, rol o traslado, indicando el motivo.",
          "El Administrador evalúa la solicitud y verifica que el nuevo rol o función sea coherente con la operación real de Rapitrip y con la Norma 2.2.",
          "El Administrador evalúa el resultado: si la solicitud no procede, la rechaza y comunica el motivo al solicitante, y el procedimiento finaliza aquí; si procede, continúa en el paso 4.",
          "El Administrador actualiza en el sistema el rol y/o los permisos de la cuenta conforme a la Norma 2.2.",
          "La plataforma aplica de inmediato los nuevos permisos y revoca automáticamente los accesos del rol anterior que ya no correspondan.",
          "El Administrador registra la fecha, el motivo y el detalle del cambio (rol anterior → rol nuevo).",
          "El Administrador notifica al usuario titular que el cambio fue aplicado."
        ],
        "evidence": "Solicitud de cambio, registro de cuentas actualizado (rol anterior, rol nuevo, fecha, responsable), notificación al usuario.",
        "result": "Cuenta actualizada al rol y permisos correctos, sin accesos residuales del rol anterior, con trazabilidad completa del cambio."
      },
      {
        "number": 5,
        "title": "Baja / Eliminación de Cuentas de Usuario",
        "objective": "Inhabilitar o eliminar cuentas de forma oportuna y autorizada, evitando accesos indebidos tras la desvinculación.",
        "scope": "Aplica a la baja de comercios (fin de convenio), repartidores (fin de colaboración), personal interno (fin de relación laboral) y clientes (solicitud propia o incumplimiento grave).",
        "responsible": "Administrador (recibe o detecta el motivo, autoriza y ejecuta), Usuario titular (puede solicitar su propia baja o comunicar el fin de la relación).",
        "relation": "Norma 2.3 (Inhabilitación de Cuentas, Política 2) y Norma 3.3 (Conservación y Eliminación de Datos Personales, Política 3) — este procedimiento ejecuta la baja de la cuenta; la Norma 3.3 regula qué pasa con los datos personales asociados.",
        "steps": [
          "Se identifica el motivo de baja: fin de convenio con un comercio, fin de colaboración con un repartidor, desvinculación de personal interno, o solicitud del cliente / incumplimiento grave.",
          "El Administrador verifica si existen procesos pendientes asociados a la cuenta (liquidaciones pendientes con un comercio conforme a la Política 9, o pedidos en tránsito asignados a un repartidor conforme a la Política 7).",
          "El Administrador evalúa el resultado: si existen procesos pendientes, los resuelve o los deja formalmente cerrados y luego continúa en el paso 4; si no existen, continúa directamente en el paso 4.",
          "El Administrador inhabilita el acceso de la cuenta en el sistema, conforme a la Norma 2.3.",
          "La plataforma revoca de inmediato todos los permisos y sesiones activas asociadas a la cuenta.",
          "El Administrador determina el tipo de baja que corresponde, conforme a la Norma 3.3: si corresponde solo inhabilitación, la cuenta queda inactiva y sus datos se conservan según el plazo definido en esa norma; si corresponde eliminación definitiva, el Administrador ejecuta la eliminación de los datos conforme a la misma norma.",
          "El Administrador registra la fecha, el motivo y el tipo de baja aplicado en el registro de cuentas."
        ],
        "evidence": "Registro del motivo de baja, constancia de cierre de procesos pendientes, registro de cuentas actualizado con la fecha y el tipo de baja.",
        "result": "Cuenta inhabilitada o eliminada de forma oportuna, sin accesos posteriores indebidos, sin procesos truncados, con trazabilidad completa del cierre."
      },
      {
        "number": 6,
        "title": "Respaldo y Verificación de Restauración de la Base de Datos",
        "objective": "Respaldar de forma automática y periódica la base de datos de Rapitrip y verificar su capacidad de recuperación mediante pruebas reales de restauración.",
        "scope": "Aplica a la base de datos de Rapitrip alojada en Supabase (datos de clientes, comercios afiliados, pedidos, pagos y repartidores). No aplica a los respaldos de documentación administrativa que Rapitrip conserva actualmente en Google Drive al margen de la base de datos.",
        "responsible": "Administrador (configura el respaldo automático, verifica su ejecución, realiza las pruebas de restauración y registra los resultados).",
        "relation": "Norma 3.2 (Respaldo y Recuperación de la Base de Datos, Política 3).",
        "steps": [
          "El Administrador configura en Supabase el respaldo automático de la base de datos con una frecuencia mínima diaria, conforme a la Norma 3.2.",
          "La plataforma ejecuta el respaldo diario de forma automática, sin intervención manual del Administrador.",
          "El Administrador verifica semanalmente que los respaldos automáticos se hayan generado correctamente, revisando el registro de respaldos disponible en Supabase.",
          "El Administrador evalúa el resultado de la verificación: si detecta un respaldo faltante o fallido, revisa la configuración, corrige la causa (por ejemplo, restablecer la programación o liberar espacio de almacenamiento) y genera de inmediato un respaldo manual para cubrir el periodo afectado, y continúa en el paso 5; si los respaldos se generaron correctamente, continúa directamente en el paso 5.",
          "El Administrador conserva cada respaldo por un mínimo de siete (7) días y elimina los respaldos que superen ese plazo, conforme a la Norma 3.2.",
          "Cada tres (3) meses, el Administrador ejecuta una prueba de restauración utilizando un respaldo disponible, restaurándolo en un entorno distinto al que utilizan los usuarios y nunca sobre la base de datos en producción.",
          "El Administrador evalúa el resultado de la prueba de restauración: si la restauración falla o los datos restaurados están incompletos o corruptos, documenta la falla, corrige la causa (configuración, espacio o integridad del respaldo) y repite la prueba con el respaldo más reciente disponible; si la restauración es exitosa, continúa en el paso 8.",
          "El Administrador registra el resultado de la prueba de restauración (fecha, respaldo utilizado, resultado obtenido) en el registro de respaldos y pruebas de recuperación.",
          "Ante una pérdida o corrupción real de información en la base de datos en producción, el Administrador restaura el respaldo disponible más reciente en un plazo máximo de veinticuatro (24) horas, conforme a la Norma 3.2, y registra la fecha, la causa de la pérdida y el resultado de la restauración."
        ],
        "evidence": "Registro de respaldos automáticos generados y de su verificación semanal, registro de las pruebas de restauración trimestrales (fecha, respaldo utilizado, resultado), registro de las restauraciones aplicadas ante una pérdida real de información.",
        "result": "Base de datos respaldada de forma automática y verificable, con capacidad de recuperación comprobada periódicamente mediante pruebas reales, y una respuesta oportuna y documentada ante cualquier pérdida o corrupción de información."
      },
      {
        "number": 7,
        "title": "Autorización y Revisión de Equipos Conectados a la Red Wi-Fi",
        "objective": "Mantener conectados a la red Wi-Fi de Rapitrip únicamente los equipos autorizados, mediante revisión periódica que detecte y retire cualquier conexión no autorizada.",
        "scope": "Aplica a la red Wi-Fi utilizada por Rapitrip para conectar sus equipos de trabajo y acceder a la plataforma. No aplica a la red de datos móviles utilizada por los repartidores durante el reparto.",
        "responsible": "Administrador (autoriza, revisa mensualmente, desconecta equipos no reconocidos y gestiona el cambio de contraseña).",
        "relation": "Norma 4.1 (Contraseña y Acceso a la Red Wi-Fi) y Control 4.1.1 (Revisión Periódica de Equipos Conectados, Política 4).",
        "steps": [
          "Antes de conectar un nuevo equipo o dispositivo a la red Wi-Fi de Rapitrip, su responsable solicita autorización al Administrador, indicando el equipo y el motivo de la conexión.",
          "El Administrador evalúa la solicitud: si el equipo no corresponde a la operación de Rapitrip, rechaza la conexión y el procedimiento finaliza aquí; si corresponde, continúa en el paso 3.",
          "El Administrador conecta el equipo a la red, proporcionando la contraseña vigente por un canal directo, y deja constancia del equipo autorizado (dispositivo, responsable, fecha).",
          "Con una frecuencia mínima mensual, el Administrador revisa la lista de equipos conectados a la red Wi-Fi, comparándola con el registro de equipos autorizados.",
          "El Administrador evalúa el resultado de la revisión: si encuentra un equipo conectado que no reconoce como autorizado, lo desconecta de inmediato y, si el hallazgo sugiere un acceso indebido a la red, lo reporta conforme al Procedimiento 2 (Reporte y Atención de Incidentes de Seguridad de la Información); si todos los equipos conectados corresponden al registro de autorizados, continúa directamente en el paso 6.",
          "El Administrador registra la revisión mensual, indicando la fecha, los equipos encontrados y los equipos desconectados por falta de autorización, si los hubo.",
          "El Administrador cambia la contraseña de la red Wi-Fi al menos cada seis (6) meses, o de inmediato si sospecha que fue conocida por una persona no autorizada, y actualiza a los equipos autorizados con la nueva contraseña."
        ],
        "evidence": "Registro de equipos autorizados (dispositivo, responsable, fecha), registro de la revisión mensual (fecha, equipos encontrados, equipos desconectados), registro de cambios de contraseña de la red.",
        "result": "Red Wi-Fi de Rapitrip utilizada únicamente por equipos autorizados, con revisión mensual efectiva que detecta y retira cualquier conexión no reconocida, y contraseña actualizada conforme a la periodicidad establecida."
      },
      {
        "number": 8,
        "title": "Activación de Conexión Alterna y Verificación de Pedidos ante Falla de Internet",
        "objective": "Activar oportunamente un medio alterno de conexión ante una falla de Internet y verificar los pedidos gestionados durante la interrupción.",
        "scope": "Aplica a toda interrupción del servicio de Internet que afecte la operación de la plataforma Rapitrip en la oficina principal, desde su detección hasta la verificación de los pedidos gestionados durante la interrupción.",
        "responsible": "Quien detecta la falla (cualquier colaborador), Administrador (reporta al proveedor, decide y activa el medio alterno, verifica los pedidos al restablecerse la conexión), Encargado de ventas (gestiona pedidos mediante el medio alterno y comunica a comercios afectados).",
        "relation": "Norma 4.2 (Continuidad ante Fallas de Conexión) y Control 4.2.1 (Verificación de Pedidos tras Restablecer la Conexión, Política 4).",
        "steps": [
          "Un colaborador detecta la interrupción del servicio de Internet en la oficina principal y lo comunica de inmediato al Administrador.",
          "El Administrador reporta la interrupción al proveedor de Internet, en un plazo máximo de una (1) hora desde su detección.",
          "El Administrador evalúa la duración de la interrupción: si se resuelve en treinta (30) minutos o menos, la operación continúa normalmente y el procedimiento finaliza aquí; si supera los treinta (30) minutos, continúa en el paso 4.",
          "El Administrador activa el medio alterno de conexión (datos móviles) para las estaciones de trabajo o dispositivos que lo requieran, priorizando al encargado de ventas y pedidos.",
          "El Administrador comunica al encargado de ventas y a los comercios afiliados que puedan verse afectados la interrupción prolongada del servicio y el uso del medio alterno.",
          "El encargado de ventas continúa gestionando los pedidos entrantes mediante el medio alterno, registrándolos en la plataforma en cuanto la conexión utilizada lo permita.",
          "Al restablecerse la conexión principal, el Administrador revisa los pedidos gestionados durante la interrupción mediante el medio alterno, para confirmar que quedaron registrados correctamente en la plataforma.",
          "El Administrador evalúa el resultado de la revisión: si encuentra un pedido duplicado, perdido o incompleto, lo corrige directamente en la plataforma y, si la corrección requiere contactar al cliente o al comercio, lo hace antes de cerrar la revisión; si no encuentra pedidos con problemas, continúa directamente en el paso 9.",
          "El Administrador registra la revisión posterior a la interrupción, indicando la fecha, los pedidos revisados y las correcciones aplicadas, si las hubo."
        ],
        "evidence": "Reporte de la interrupción al proveedor (fecha y hora del reporte), registro de la activación del medio alterno y de la comunicación a los afectados, registro de la revisión posterior a la interrupción con las correcciones aplicadas.",
        "result": "Conexión alterna activada de forma oportuna y conforme a un criterio definido ante fallas prolongadas de Internet, atención continua de los pedidos durante la interrupción, y verificación completa de la información registrada al restablecerse la conexión principal."
      },
      {
        "number": 9,
        "title": "Gestión de Cambios, Pruebas y Despliegue de Correcciones o Nuevas Funciones del Sistema",
        "objective": "Autorizar, probar en un entorno separado, documentar y conservar la versión anterior de toda corrección o nueva función antes de aplicarla sobre la versión en uso.",
        "scope": "Aplica a toda modificación, corrección o nueva función que se desarrolle sobre la aplicación de Rapitrip. No aplica a la clasificación de un error o brecha según su gravedad ni a los plazos de atención correspondientes, que se rigen directamente por la Norma 5.2.",
        "responsible": "Administrador (autoriza el cambio y verifica su cumplimiento antes del despliegue), Personal encargado del desarrollo (prueba, documenta, conserva la versión anterior y despliega el cambio).",
        "relation": "Norma 5.1 (Autorización, Pruebas y Control de Versiones de los Cambios) y Control 5.1.1 (Verificación Previa a la Autorización del Cambio, Política 5).",
        "steps": [
          "Se origina la necesidad de un cambio, ya sea por el cierre de una brecha funcional identificada en el sistema, una nueva función solicitada por Administración, o una mejora derivada del uso cotidiano de la plataforma.",
          "El personal encargado del desarrollo describe el cambio propuesto (qué se modificará, por qué y qué módulo afecta) y lo presenta al Administrador.",
          "El Administrador evalúa la propuesta considerando su relación con el giro de negocio y su prioridad: si no la autoriza, comunica el motivo y el procedimiento finaliza aquí; si la autoriza, continúa en el paso 4.",
          "El personal encargado del desarrollo conserva una copia de la versión del sistema anterior al cambio, antes de iniciar cualquier modificación.",
          "El personal encargado del desarrollo implementa el cambio en un entorno distinto al que utilizan los usuarios.",
          "El personal encargado del desarrollo prueba el cambio en ese entorno, verificando que cumpla el resultado esperado y que no afecte otras funciones del sistema.",
          "El personal encargado del desarrollo evalúa el resultado de la prueba: si el cambio no funciona conforme a lo esperado o afecta otra función, corrige el cambio y repite la prueba en el paso 6; si el cambio funciona conforme a lo esperado, continúa en el paso 8.",
          "El personal encargado del desarrollo documenta el cambio, indicando la fecha, el motivo y una descripción de lo modificado.",
          "El Administrador verifica que el cambio cuente con la prueba realizada, la copia de la versión anterior y la documentación completa, conforme al Control 5.1.1, antes de autorizar su despliegue.",
          "El Administrador evalúa la verificación: si falta alguno de los tres elementos, no autoriza el despliegue y el cambio regresa al paso correspondiente para completarlo; si los tres elementos están completos, continúa en el paso 11.",
          "El personal encargado del desarrollo aplica el cambio sobre la versión en uso por los usuarios.",
          "El Administrador confirma que el cambio se refleja correctamente en la versión en uso y actualiza el estado de la brecha funcional o solicitud correspondiente como resuelta, cuando aplique."
        ],
        "evidence": "Descripción del cambio propuesto y su autorización, copia de la versión anterior, registro de pruebas realizadas en el entorno separado, documentación del cambio (fecha, motivo, descripción), verificación de los tres elementos firmada por el Administrador, registro de brechas funcionales con su estado actualizado.",
        "result": "Cambios y nuevas funciones incorporados al sistema de forma autorizada, probada, documentada y reversible, con las brechas funcionales identificadas cerradas de forma ordenada y verificable."
      },
      {
        "number": 10,
        "title": "Confirmación, Preparación y Seguimiento del Estado del Pedido",
        "objective": "Verificar la disponibilidad del pedido por parte del comercio afiliado, registrar y actualizar su preparación, y dar seguimiento oportuno ante pedidos sin avance o incumplimientos.",
        "scope": "Aplica a todo pedido desde que el cliente lo confirma y queda registrado en el sistema, hasta que el comercio afiliado lo deja listo para asignarse a un repartidor. No incluye la asignación ni la entrega del pedido, que se regulan en la Política 7.",
        "responsible": "Comercio afiliado (confirma disponibilidad, prepara el pedido y comunica su estado), Encargado de ventas (registra y actualiza el estado en el sistema cuando el comercio no puede hacerlo directamente, revisa pedidos sin avance y resuelve incumplimientos), Cliente (recibe la notificación cuando corresponda).",
        "relation": "Norma 6.1 (Registro e Identificación del Pedido) y Control 6.1.1 (Revisión de Pedidos sin Avance de Estado); Norma 6.2 (Confirmación de Disponibilidad y Comunicación de Incumplimiento) y Control 6.2.1 (Resolución del Pedido tras un Incumplimiento, Política 6).",
        "steps": [
          "El cliente confirma el pedido y el sistema lo registra con un identificador único, los productos, las cantidades, la dirección de entrega y el comercio afiliado correspondiente.",
          "El comercio afiliado recibe la notificación del pedido y dispone de un plazo máximo de quince (15) minutos para confirmar la disponibilidad de los productos.",
          "El comercio afiliado evalúa la disponibilidad: si puede completar el pedido según lo solicitado, confirma su disponibilidad y continúa en el paso 6; si no puede completarlo, continúa en el paso 4.",
          "El comercio afiliado comunica al cliente o al encargado de ventas el motivo por el que no puede completar el pedido, antes de iniciar cualquier preparación.",
          "El encargado de ventas registra en el sistema la decisión sobre el pedido (cancelación, modificación o sustitución) en un plazo máximo de treinta (30) minutos desde la comunicación del comercio, notifica la decisión al cliente, y el procedimiento finaliza aquí.",
          "El comercio afiliado inicia la preparación del pedido y actualiza su estado en la plataforma en cada etapa (confirmado, en preparación, listo); mientras la plataforma no permita registrar directamente ese avance, comunica el estado al encargado de ventas por el canal habilitado, y este lo registra en el sistema en su representación.",
          "El encargado de ventas revisa todo pedido que no registre un cambio de estado durante más de treinta (30) minutos desde la última actualización, y contacta al comercio para conocer la causa.",
          "El encargado de ventas evalúa la respuesta del comercio: si el comercio confirma que continúa la preparación, deja constancia del motivo del retraso y mantiene el seguimiento del pedido, regresando al paso 7; si el comercio reporta que no podrá completarlo, continúa en el paso 4.",
          "Una vez que el comercio finaliza la preparación, actualiza o comunica el estado \"listo\", y el pedido queda disponible para su asignación a un repartidor conforme a la Política 7."
        ],
        "evidence": "Registro del pedido con su identificador y datos mínimos, registro de la confirmación o del incumplimiento del comercio (fecha, motivo), registro de los pedidos revisados por inactividad de estado (fecha, tiempo transcurrido, resultado del contacto), registro de la decisión tomada ante un incumplimiento y su notificación al cliente.",
        "result": "Pedido confirmado o resuelto dentro de los plazos establecidos, con su estado de preparación actualizado y trazable en todo momento aunque el sistema todavía no ofrezca una interfaz directa para ello, sin pedidos detenidos sin seguimiento ni comunicación al cliente."
      },
      {
        "number": 11,
        "title": "Recogida, Traslado, Entrega y Registro de Incidencias del Pedido",
        "objective": "Garantizar la recogida, custodia, traslado y entrega del pedido con evidencia fotográfica, y el registro y resolución oportuna de cualquier incidencia durante el trayecto.",
        "scope": "Aplica desde que el repartidor recoge el pedido en el comercio afiliado hasta su entrega al cliente o una devolución autorizada, incluyendo cualquier incidencia ocurrida durante el traslado. No incluye la asignación inicial del repartidor ni la preparación del pedido en el comercio, que se regulan en la Política 6.",
        "responsible": "Repartidor (recoge, custodia, traslada, entrega y reporta incidencias), Encargado de ventas (registra en el sistema los eventos y evidencias que el repartidor todavía no puede registrar directamente, y resuelve incidencias dentro de su responsabilidad), Administrador (resuelve decisiones extraordinarias).",
        "relation": "Norma 7.1 (Evidencia y Confirmación de la Entrega) y Control 7.1.1 (Reintento de Registro de Evidencia Fotográfica); Norma 7.2 (Registro de Incidencias durante el Traslado) y Control 7.2.1 (Plazo de Resolución de una Incidencia Escalada, Política 7).",
        "steps": [
          "El repartidor recoge el pedido en el comercio afiliado y verifica que los productos correspondan a lo indicado antes de aceptarlo bajo su custodia.",
          "El repartidor traslada el pedido hacia la dirección de entrega registrada.",
          "Durante el traslado, el repartidor evalúa si ocurre algún inconveniente (dirección incorrecta, ausencia del cliente, daño al pedido u otro): si no ocurre ninguno, continúa en el paso 8; si ocurre, continúa en el paso 4.",
          "El repartidor reporta la incidencia en el momento en que ocurre, y en ningún caso después de finalizado su turno, indicando el identificador del pedido, el tipo de incidencia y una breve descripción; mientras la plataforma no ofrezca un registro directo para el repartidor, la reporta al encargado de ventas por el canal habilitado, quien la registra en el sistema en su representación.",
          "El encargado de ventas evalúa la incidencia: si puede resolverla dentro de su responsabilidad (por ejemplo, recontactar al cliente o ajustar la ruta), la resuelve directamente en un plazo máximo de treinta (30) minutos desde el reporte e indica al repartidor cómo proceder, y continúa en el paso 7; si la incidencia implica una cancelación, una devolución extraordinaria o una modificación relevante del pedido, la remite al Administrador y continúa en el paso 6.",
          "El Administrador resuelve la incidencia remitida en un plazo máximo de treinta (30) minutos desde su recepción e indica al repartidor cómo proceder.",
          "Quien haya resuelto la incidencia registra la resolución, indicando la fecha, el tiempo transcurrido desde el reporte y la instrucción dada al repartidor.",
          "Al llegar al destino, el repartidor confirma la recepción del pedido con el cliente o la persona autorizada antes de proceder a marcarlo como entregado.",
          "El repartidor evalúa si el cliente está disponible para recibir el pedido: si no está disponible, reporta la incidencia conforme al paso 4 antes de proceder con una devolución; si está disponible y confirma la recepción, continúa en el paso 10.",
          "El repartidor toma al menos una fotografía del pedido entregado desde la aplicación; mientras la plataforma no ofrezca esa función directamente, la envía al encargado de ventas por el canal habilitado, quien la asocia al identificador del pedido con la fecha y hora de la entrega.",
          "Si la plataforma o el canal utilizado no logra guardar o asociar la fotografía al pedido correspondiente, quien la registra lo reporta de inmediato y vuelve a intentarlo antes de continuar con el siguiente pedido; si el problema persiste, se informa al encargado de ventas para su resolución.",
          "Una vez registrada la evidencia fotográfica y confirmada la recepción, el pedido se marca como entregado en el sistema."
        ],
        "evidence": "Registro de incidencias durante el traslado (fecha, pedido, tipo, descripción), registro de la resolución de incidencias escaladas (fecha, tiempo transcurrido, instrucción dada), fotografía de la entrega asociada al pedido con fecha y hora, registro de intentos fallidos de carga de evidencia y su resolución.",
        "result": "Pedido recogido, trasladado y entregado bajo custodia verificable, con evidencia fotográfica asociada, toda incidencia registrada y resuelta dentro de los plazos establecidos, y trazabilidad completa del proceso aunque el sistema todavía no ofrezca un portal directo para el repartidor."
      },
      {
        "number": 12,
        "title": "Actualización, Revisión y Corrección del Catálogo e Inventario de los Comercios Afiliados",
        "objective": "Mantener actualizado el catálogo e inventario de cada comercio afiliado y detectar y corregir oportunamente cualquier inconsistencia.",
        "scope": "Aplica a la actualización del catálogo y el inventario de cada comercio afiliado y a la revisión de cualquier inconsistencia reportada sobre esa información. No incluye la creación inicial del comercio ni de su convenio de afiliación, que se regula en el Procedimiento 3.",
        "responsible": "Comercio afiliado (comunica la información y la disponibilidad de sus productos), Encargado de ventas (registra y actualiza el catálogo e inventario en el sistema, revisa periódicamente y ante inconsistencias, y notifica al comercio), Administrador (evalúa y determina la medida ante reincidencia).",
        "relation": "Norma 8.1 (Actualización del Catálogo e Inventario) y Control 8.1.1 (Revisión Periódica de Catálogos sin Actualizar); Norma 8.2 (Revisión del Catálogo ante Inconsistencias) y Control 8.2.1 (Evaluación y Registro de la Medida ante Reincidencia, Política 8).",
        "steps": [
          "El comercio afiliado comunica al encargado de ventas o al Administrador la información de un producto (nombre, descripción, precio, disponibilidad) o un cambio en su disponibilidad, por el canal habilitado; mientras la plataforma no ofrezca al comercio una cuenta propia para publicarlo directamente, quien recibe la comunicación registra o actualiza el catálogo y el inventario en el sistema en representación del comercio.",
          "Quien registra la actualización marca como no disponible todo producto agotado antes de que un cliente pueda seleccionarlo, y verifica que el precio registrado corresponda al que el comercio cobrará al cliente.",
          "El comercio afiliado comunica la disponibilidad de sus productos con una frecuencia mínima diaria, y de inmediato cuando alguno se agote; si un producto deja de ofrecerse, lo comunica para su retiro o marcado como no disponible en un plazo máximo de veinticuatro (24) horas desde que deja de ofrecerlo.",
          "Con una frecuencia mínima semanal, el encargado de ventas revisa qué comercios afiliados no registran una actualización de su catálogo o inventario en más de dos (2) días.",
          "El encargado de ventas evalúa el resultado de la revisión: si encuentra un comercio sin actualización reciente, lo notifica para que comunique la información pendiente y esta se registre conforme al paso 1; si todos los comercios están actualizados, continúa directamente en el paso 6.",
          "El encargado de ventas registra la revisión semanal, indicando la fecha, los comercios encontrados sin actualización y la notificación enviada.",
          "Cuando un cliente u otro usuario reporta una inconsistencia sobre el catálogo o inventario de un comercio, el encargado de ventas la revisa en un plazo máximo de veinticuatro (24) horas.",
          "El encargado de ventas evalúa la revisión: si la inconsistencia no se confirma, deja constancia del resultado y el procedimiento finaliza aquí; si se confirma, continúa en el paso 9.",
          "El encargado de ventas notifica al comercio afiliado para que corrija la información, y este dispone de un plazo máximo de veinticuatro (24) horas adicionales para comunicar la corrección, que se registra conforme al paso 1.",
          "El encargado de ventas evalúa si el comercio afiliado incurre en una reincidencia de inconsistencias: si no es una reincidencia, registra el caso como cerrado; si es una reincidencia, la reporta al Administrador y continúa en el paso 11.",
          "El Administrador revisa el historial de inconsistencias del comercio afiliado y determina la medida correspondiente en un plazo máximo de cinco (5) días hábiles, comunicando su decisión al encargado de ventas y, cuando corresponda, al comercio afiliado.",
          "El encargado de ventas o el Administrador, según corresponda, registra la fecha del reporte de reincidencia, el historial revisado, la medida determinada y la fecha en que se comunicó la decisión."
        ],
        "evidence": "Registro de comunicaciones de actualización del comercio (fecha, producto, cambio), registro de la revisión semanal de catálogos sin actualizar, registro de inconsistencias reportadas y su revisión (fecha, resultado, notificación), registro de reincidencias y la medida determinada por el Administrador.",
        "result": "Catálogo e inventario de cada comercio afiliado actualizado dentro de los plazos establecidos, inconsistencias detectadas y corregidas oportunamente, y reincidencias evaluadas y resueltas por el Administrador de forma documentada."
      },
      {
        "number": 13,
        "title": "Registro, Verificación y Conciliación del Cobro y la Liquidación de Pedidos",
        "objective": "Registrar y verificar el cobro exacto de cada pedido, ejecutar la liquidación a los comercios afiliados y conciliar periódicamente ambos registros.",
        "scope": "Aplica al cobro de todo pedido confirmado, a la liquidación correspondiente a cada comercio afiliado y a la conciliación mensual de ambos. No incluye la reversión de una liquidación por una devolución aceptada, que se rige directamente por la Norma 9.2, al no existir todavía evidencia de una brecha operativa real sobre ese punto.",
        "responsible": "Encargado de ventas (registra y verifica el cobro), Administrador (registra y ejecuta la liquidación a los comercios afiliados y concilia mensualmente).",
        "relation": "Norma 9.1 (Registro del Cobro y la Liquidación) y Control 9.1.1 (Conciliación Periódica de Cobros y Liquidaciones, Política 9).",
        "steps": [
          "Al confirmarse un pedido, el sistema crea un pago pendiente por cada orden generada, incluso cuando el carrito se dividió en varias órdenes por corresponder a distintos comercios.",
          "El encargado de ventas verifica, para cada orden creada a partir de un mismo carrito, que el total registrado incluya el cargo de envío correspondiente a esa orden, dado que la pantalla del cliente puede mostrar una sola tarifa estimada para todo el carrito; si encuentra una diferencia entre lo mostrado al cliente y lo registrado por orden, la corrige antes de considerar el cobro conciliado y deja constancia del ajuste.",
          "El encargado de ventas evalúa la forma de pago elegida por el cliente: si es en efectivo, continúa en el paso 4; si es en línea, continúa en el paso 5.",
          "Para un pago en efectivo, el encargado de ventas o el repartidor confirma la recepción del monto exacto al momento de la entrega, y el encargado de ventas registra el cobro por ese monto en el sistema.",
          "Para un pago en línea, dado que la plataforma todavía no cuenta con una pasarela que cobre o autorice el pago de forma automática, el encargado de ventas verifica por un medio alterno (transferencia, comprobante u otro acordado con el cliente) que el cobro se haya recibido efectivamente por el monto exacto del pedido, y registra el cobro en el sistema una vez confirmado; mientras no se confirme, el pago permanece pendiente y el pedido no se considera cobrado.",
          "El Administrador registra en el sistema la liquidación correspondiente a cada comercio afiliado, indicando el pedido, el monto y la fecha, conforme a la periodicidad establecida en su acuerdo, sin exceder los quince (15) días.",
          "Con una frecuencia mensual, el Administrador concilia los cobros, las liquidaciones y las reversiones registradas en el sistema durante ese mes.",
          "El Administrador evalúa el resultado de la conciliación: si encuentra una diferencia, la corrige antes del cierre del mes correspondiente y deja constancia del ajuste realizado; si no encuentra diferencias, continúa directamente en el paso 9.",
          "El Administrador registra la conciliación mensual, indicando la fecha, las diferencias encontradas y las correcciones aplicadas, si las hubo."
        ],
        "evidence": "Registro de la verificación de la tarifa por orden en pedidos multitienda, registro del cobro confirmado por cada pedido (monto, forma de pago, fecha), registro de la liquidación a cada comercio afiliado, registro de la conciliación mensual con las diferencias encontradas y las correcciones aplicadas.",
        "result": "Cobro registrado por el monto exacto de cada pedido, incluida la tarifa de envío en pedidos divididos entre varios comercios, liquidaciones a comercios afiliados registradas dentro del plazo de su acuerdo, y conciliación mensual que detecta y corrige cualquier diferencia antes del cierre del mes."
      }
    ]
  }
};
