import {slides as prior} from '../rapitrip-presentacion/deck.mjs';
export const ROOT='C:/Users/alexa/Proyecto RT';
export const P={paper:'#FAFCFA',forest:'#0A3D2B',ink:'#10261B',green:'#0B7A45',bright:'#16A34A',mint:'#E3F3E9',lime:'#C6F26B',muted:'#66786E',line:'#D9E6DE',white:'#FFFFFF',soft:'#F1FAF4'};
export const slides=[];
const S=(title,section,ref=4,notes='',pages='')=>{let s={title,section,ref,panels:[],text:[],nodes:[],edges:[],images:[],links:[],notes,pages};slides.push(s);return s};
const panel=(s,x,y,w,h,fill=P.white,slot)=>{s.panels.push({x,y,w,h,fill,slot});return s};
const t=(s,text,x,y,w,h,size=24,color=P.ink,heading=false,opt={})=>{s.text.push({text,x,y,w,h,size,color,heading,...opt});return s};
const pill=(s,text,x,y,w,fill=P.mint,color=P.forest)=>t(s,text,x,y,w,33,17,color,true,{fill,radius:17,align:'center',font:'Lato'});
const bar=(s,text,label='Idea clave')=>{panel(s,85,562,1110,52,P.forest,'Shape 50');pill(s,label,111,575,146,P.lime);t(s,text,274,571,891,39,21,P.white)};
const node=(s,text,x,y,w,h,fill=P.white)=>{s.nodes.push({text,x,y,w,h,fill});return s.nodes.length-1};
const edges=(s,...a)=>s.edges.push(...a);
const image=(s,path,x,y,w,h,alt)=>s.images.push({path,x,y,w,h,alt});
const three=(title,section,cards,foot,notes,pages)=>{const s=S(title,section,12,notes,pages);cards.forEach((a,k)=>{let x=85+k*376,dark=k===2;panel(s,x,200,357,346,dark?P.forest:P.white,['Shape 4','Shape 12','Shape 21'][k]);pill(s,a[0],x+24,222,144,dark?P.lime:P.mint);t(s,a[1],x+24,280,309,74,30,dark?P.white:P.ink,true);t(s,a[2],x+24,375,309,145,23,dark?P.mint:P.muted)});if(foot){panel(s,85,563,1110,51,P.forest,'Shape 30');t(s,foot,112,571,1058,37,21,P.white)}return s};
let s=S('Diseño y desarrollo\ndel sistema Rapitrip','DISEÑO DE SISTEMAS DE INTERNET',1,prior[0].notes,'1, 4–6');
s.cover=true;s.keepArt=true;panel(s,85,467,426,160,P.white,'Shape 10');panel(s,528,467,253,160,P.forest,'Shape 13');panel(s,842,207,371,144,P.white,'logo-plate');
t(s,'Comercio electrónico y gestión logística',85,346,690,72,26,P.muted);
pill(s,'Integrantes',112,485,132);t(s,'Richard Alexander Malespín Tinoco\nMarlyng Elizabeth Miranda Navarrete\nMoisés Abraham Zelaya Maldonado',112,528,380,83,18);
pill(s,'Tutor',551,485,94,P.lime);t(s,'Cristopher Alexander\nChávez Larios',551,530,214,64,20,P.white);
image(s,ROOT+'/apps/store/public/brand/logo-completo.webp',855,226,326,108,'Logotipo oficial de Rapitrip');
t(s,'Compra, gestión y entrega\nen un mismo sistema',875,365,303,84,23,P.white,false,{align:'center'});

s=S('Rapitrip: comercio y entrega en una sola operación','01 · LA PLATAFORMA',4,prior[2].notes,'4–5, 45');
let a=node(s,'Cliente\nCompra y consulta',85,195,242,100),b=node(s,'Rapitrip\nCoordina el pedido',374,195,242,100,P.forest),c=node(s,'Comercio\nConfirma y prepara',663,195,242,100),d=node(s,'Repartidor\nRealiza la entrega',952,195,242,100);edges(s,[a,b],[b,c],[c,d]);
panel(s,85,330,535,205,P.white,'Shape 4');panel(s,644,330,551,205,P.white,'Shape 10');pill(s,'Qué ofrece',110,351,143);t(s,'Intermediación entre comercios y clientes, con venta en línea y entrega de última milla.',110,410,479,101,27);
pill(s,'Qué integra',669,351,151);t(s,'Catálogo e inventario, pedidos, cobros y seguimiento dentro de un mismo sistema.',669,410,499,101,27);bar(s,'Cada actor trabaja sobre información y reglas comunes.','Sistema');

s=S('Objetivo y recorrido de la presentación','INTRODUCCIÓN',3,prior[1].notes+' El enfoque corresponde al curso de Diseño de Sistemas de Internet.','4–6');
panel(s,85,200,413,414,P.forest,'Shape 4');pill(s,'Objetivo',117,230,136,P.lime);t(s,'Explicar cómo las necesidades de Rapitrip se convierten en modelos, aplicaciones y reglas de backend.',117,300,346,249,32,P.white);
[['Plataforma y actores','Entender el funcionamiento de Rapitrip.'],['Requerimientos y diagramas','Relacionar las funciones con su modelado.'],['Arquitectura de software','Organizar las aplicaciones y los servicios.'],['Desarrollo del backend','Proteger los datos y ejecutar la operación.']].forEach((v,k)=>{let y=207+k*101;panel(s,523,y,672,87,P.white,['Shape 8','Shape 12','Shape 16','Shape 20'][k]);pill(s,String(k+1).padStart(2,'0'),545,y+24,52,k===3?P.lime:P.mint);t(s,v[0],620,y+8,547,36,27,P.ink,true,{jump:[2,5,13,15][k]});t(s,v[1],620,y+47,540,28,18,P.muted)});

s=S('Tres aplicaciones para un mismo proceso','01 · LA PLATAFORMA',4,prior[3].notes+' La captura muestra una ejecución local de la tienda web y no acredita operación en producción.','45');
panel(s,85,200,716,414,P.white,'Shape 4');image(s,ROOT+'/tmp/rapitrip-redesign/reference/tienda.png',101,216,684,363,'Tienda web de Rapitrip en ejecución local');t(s,'Tienda web · ejecución local',109,581,650,24,16,P.muted);
[['Tienda','Cliente','Catálogo, carrito y seguimiento.'],['Consola','Personal y comercios','Gestión comercial y coordinación.'],['Repartidor','Entrega','Ofertas, evidencia y efectivo.']].forEach((v,k)=>{let y=200+k*141;panel(s,825,y,370,131,k===2?P.forest:P.white,['Shape 10','Shape 17','Shape 50'][k]);pill(s,v[0],845,y+15,129,k===2?P.lime:P.mint);t(s,v[1],991,y+19,186,k===1?48:30,20,k===2?P.white:P.ink,true);t(s,v[2],845,y+67,327,53,22,k===2?P.mint:P.muted)});

s=S('Requerimientos organizados por procesos','02 · REQUERIMIENTOS Y DIAGRAMAS',18,prior[5].notes,'8–25');
const modules=[['Identidad y supervisión','IDA y SUP','Cuentas, roles, parámetros y auditoría.'],['Oferta comercial','COM e INV','Comercios, catálogo y existencias.'],['Compra y clientes','PED y CLI','Carrito, pedidos y direcciones.'],['Seguimiento y entrega','SEG y ENT','Estados, asignación y ejecución.']];
modules.forEach((v,k)=>{let x=85+(k%2)*568,y=200+Math.floor(k/2)*163;panel(s,x,y,542,143,k===3?P.forest:P.white,['Shape 4','Shape 8','Shape 11','Shape 17'][k]);pill(s,v[1],x+21,y+18,135,k===3?P.lime:P.mint);t(s,v[0],x+177,y+17,344,40,25,k===3?P.white:P.ink,true);t(s,v[2],x+22,y+78,498,48,22,k===3?P.mint:P.muted)});bar(s,'COB completa el alcance con cobros, devoluciones y liquidaciones.','Cobros');

s=S('Un requerimiento debe poder comprobarse','02 · REQUERIMIENTOS Y DIAGRAMAS',18,prior[4].notes+' Ejemplo basado en RF-PED-02.','8, 16, 58');
panel(s,85,200,1110,112,P.forest,'Shape 4');pill(s,'RF-PED-02',111,220,151,P.lime);t(s,'Generar un pedido por cada comercio del carrito.',285,223,874,60,30,P.white);
[['Actor','Cliente que confirma la compra.'],['Regla','Validar existencias y datos requeridos.'],['Resultado','Conservar artículos, precios y dirección.'],['Verificación','Comprobar la creación y los casos de error.']].forEach((v,k)=>{let x=85+k*284;panel(s,x,339,259,191,P.white,['Shape 17','Shape 22','Shape 27','Shape 32'][k]);pill(s,v[0],x+18,358,140);t(s,v[1],x+20,414,216,93,24)});bar(s,'La trazabilidad relaciona el requerimiento con los modelos y las pruebas.','Trazabilidad');

s=S('Criterios de calidad del sistema','02 · REQUERIMIENTOS Y DIAGRAMAS',18,prior[6].notes,'26–29');
[['< 3 s','Tiempo de respuesta','95 % de las consultas principales, con la carga de referencia.'],['99 %','Disponibilidad','Meta mensual del sistema desplegado.'],['100 %','Permisos','Matriz de acceso con roles válidos, inválidos y anónimos.'],['Una transacción','Consistencia interna','Cambios relacionados con confirmación o reversión.']].forEach((v,k)=>{let x=85+(k%2)*568,y=200+Math.floor(k/2)*172;let dark=k===3;panel(s,x,y,542,151,dark?P.forest:P.white,['Shape 4','Shape 8','Shape 11','Shape 17'][k]);t(s,v[0],x+24,y+17,493,58,k===3?35:47,dark?P.lime:P.green);t(s,v[1],x+24,y+77,493,34,23,dark?P.white:P.ink,true);t(s,v[2],x+24,y+113,492,34,17,dark?P.mint:P.muted)});bar(s,'Son criterios de aceptación que requieren evidencia de prueba.','Validación');

s=S('Casos de uso y responsabilidades','02 · REQUERIMIENTOS Y DIAGRAMAS',4,prior[7].notes,'26, 32–33');
panel(s,85,200,768,414,P.white,'Shape 4');panel(s,877,200,318,414,P.forest,'Shape 10');
[['Cliente','Comprar y consultar su pedido'],['Comercio','Publicar productos y preparar'],['Coordinación y caja','Gestionar operación y cobros'],['Repartidor','Aceptar y ejecutar la entrega']].forEach((v,k)=>{let y=226+k*91;let a=node(s,v[0],109,y,232,65,P.mint),b=node(s,v[1],389,y,440,65);edges(s,[a,b])});pill(s,'Regla transversal',900,224,268,P.lime);t(s,'Cada acción requiere un rol y un alcance válidos.',903,298,265,123,30,P.white);t(s,'Coordinar pedidos y registrar cobros son permisos diferentes.',903,459,265,124,24,P.mint);

s=S('Estados y excepciones de un pedido','02 · REQUERIMIENTOS Y DIAGRAMAS',4,prior[8].notes,'17–18, 39');
panel(s,85,200,1110,338,P.white,'Shape 4');
[['En confirmación',116,229],['Confirmado',483,229],['En preparación',850,229],['Listo',850,399],['En entrega',483,399],['Entregado',116,399]].forEach((v,k)=>node(s,v[0],v[1],v[2],315,89,k===5?P.forest:P.mint));edges(s,[0,1],[1,2],[2,3],[3,4],[4,5]);bar(s,'Cada cambio conserva actor, fecha y motivo. La cancelación sigue reglas propias.','Trazabilidad');

s=S('Modelo de clases: estructura del dominio','02 · REQUERIMIENTOS Y DIAGRAMAS',4,prior[9].notes,'34–36');
panel(s,85,200,1110,414,P.white,'Shape 4');
[['Cliente','Cuenta y direcciones',111,228],['Pedido','Detalle, importes y estado',487,228],['Comercio','Catálogo y preparación',863,228],['Dirección','Destino de la compra',111,446],['Entrega','Asignación y evidencia',487,446],['Repartidor','Ejecución de la entrega',863,446]].forEach(v=>node(s,v[0]+'\n'+v[1],v[2],v[3],307,103,v[0]==='Pedido'?P.forest:P.mint));edges(s,[0,1],[2,1],[0,3],[1,4],[4,5]);t(s,'Síntesis del modelo UML. Los diagramas completos permanecen en los anexos.',112,574,1056,27,18,P.muted);

s=S('Modelo relacional y datos de la compra','02 · REQUERIMIENTOS Y DIAGRAMAS',4,prior[10].notes,'41–42');
panel(s,85,200,1110,339,P.white,'Shape 4');
[['Comercio',115,227],['Tienda',401,227],['Producto y variante',687,227],['Inventario',973,227],['Cliente',115,424],['Pedido',401,424],['Artículos',687,424],['Pago y entrega',973,424]].forEach(v=>node(s,v[0],v[1],v[2],225,75,v[0]==='Pedido'?P.forest:P.mint));edges(s,[0,1],[1,2],[2,3],[4,5],[5,6],[2,6],{custom:true,points:[[513.5,499],[513.5,522],[1085.5,522],[1085.5,499]]});bar(s,'El documento organiza 69 tablas y 98 claves foráneas por áreas funcionales.','Modelo fuente');

s=three('Navegación según las tareas de cada perfil','02 · REQUERIMIENTOS Y DIAGRAMAS',[
 ['Cliente','Explorar y comprar','Catálogo, detalle del producto, carrito y seguimiento.'],['Consola','Gestionar la operación','Áreas de administración y comercio según los permisos.'],['Repartidor','Completar la entrega','Ofertas, asignaciones y registro de evidencia.']], 'El prototipo de Figma relaciona los recorridos con la presentación visual.',prior[11].notes,'37–38');
s.links=prior[11].links.map((v,k)=>({label:'Abrir prototipo',url:v[1],x:109+k*376,y:499,w:305,h:28}));

s=S('Arquitectura general del sistema','03 · ARQUITECTURA DE SOFTWARE',4,prior[12].notes,'44–48');
panel(s,85,195,1110,421,P.white,'Shape 4');
[['Tienda web\nNext.js',111],['Consola web\nNext.js',487],['Repartidor web\nNext.js',863]].forEach(v=>node(s,v[0],v[1],216,307,81,P.mint));node(s,'Servicios de Supabase\nAuth, API pública, Storage y Edge Functions',298,371,684,103,P.forest);node(s,'PostgreSQL\nDatos, permisos y reglas críticas',298,528,684,66,P.mint);edges(s,[0,3],[1,3],[2,3],[3,4]);

s=three('Tecnologías y responsabilidades por capa','03 · ARQUITECTURA DE SOFTWARE',[
 ['Aplicaciones','Next.js y TypeScript','Interfaces web y código de servidor para cada perfil.'],['Datos','PostgreSQL y RPC','Transacciones, permisos y reglas de negocio en SQL y PL/pgSQL.'],['Servicios','Supabase y Deno','Identidad, archivos e integraciones con secretos de servidor.']], 'El monorepo comparte componentes, validaciones y tipos entre aplicaciones.',prior[3].notes+' '+prior[13].notes,'45–46, 50–53');

s=S('Un backend modular sobre una base compartida','04 · DESARROLLO DEL BACKEND',18,prior[13].notes,'45–46, 52–53');
[['identity','Perfiles, roles e invitaciones.'],['commerce','Tiendas, catálogo e inventario.'],['sales','Pedidos, pagos y entregas.'],['audit','Eventos e incidentes.'],['private','Seguridad y tareas internas.'],['public','Vistas y RPC autorizadas.']].forEach((v,k)=>{let x=85+(k%3)*376,y=200+Math.floor(k/3)*169,dark=k===5;panel(s,x,y,357,148,dark?P.forest:P.white,['Shape 4','Shape 8','Shape 11','Shape 17','Shape 22','Shape 27'][k]);pill(s,v[0],x+22,y+21,205,dark?P.lime:P.mint);t(s,v[1],x+22,y+80,311,60,25,dark?P.white:P.ink)});bar(s,'Los esquemas separan responsabilidades dentro de PostgreSQL.','Modularidad');

s=S('Lecturas por vistas y escrituras por funciones','04 · DESARROLLO DEL BACKEND',4,prior[14].notes,'45, 51–53');
panel(s,85,200,1110,338,P.white,'Shape 4');node(s,'Aplicaciones\nSDK de Supabase',111,315,265,105,P.mint);node(s,'Lecturas\nVistas con security_invoker',472,222,339,105);node(s,'Escrituras\nFunciones RPC autorizadas',472,407,339,105,P.forest);node(s,'PostgreSQL\nRLS y permisos',907,315,262,105,P.mint);edges(s,[0,1],[0,2],[1,3],[2,3]);bar(s,'La validación de la interfaz orienta al usuario y la base autoriza la operación.','Contrato');

s=S('Consistencia y control de reintentos','04 · DESARROLLO DEL BACKEND',3,prior[15].notes,'46, 52; migración 20261101000030');
panel(s,85,200,413,414,P.forest,'Shape 4');pill(s,'Una transacción',111,222,235,P.lime);t(s,'Los cambios internos se confirman juntos o se revierten cuando falla la operación.',111,286,358,183,32,P.white);pill(s,'client_ref',111,523,180,P.mint);t(s,'Identifica un intento de compra.',111,568,358,28,18,P.mint);
[['Validar','Sesión, datos requeridos y existencias.'],['Calcular','Precios e importes en el backend.'],['Registrar','Pedido, artículos y cambios vinculados.'],['Resolver el reintento','Devolver el pedido ya creado sin duplicarlo.']].forEach((v,k)=>{let y=207+k*101;panel(s,523,y,672,87,P.white,['Shape 8','Shape 12','Shape 16','Shape 20'][k]);pill(s,String(k+1),545,y+23,50,k===3?P.lime:P.mint);t(s,v[0],620,y+7,543,35,25,P.ink,true);t(s,v[1],620,y+45,543,30,20,P.muted)});s.walkthrough=true;

s=three('Identidad, autorización y protección de datos','04 · DESARROLLO DEL BACKEND',[
 ['Auth','Quién inicia sesión','Cuenta verificada, contexto de sesión y segundo factor cuando corresponde.'],['RBAC y RLS','Qué puede hacer y ver','Permisos por rol y acceso restringido al comercio o al recurso autorizado.'],['Auditoría','Cómo se revisa la acción','Registro de operaciones relevantes y archivos sensibles con acceso privado.']], 'Un comercio solo puede gestionar los datos que corresponden a su alcance.',prior[16].notes,'47, 53, 55');s.permissions=true;

s=S('Pago en línea y confirmación del resultado','04 · DESARROLLO DEL BACKEND',4,prior[17].notes,'46, 51; stripe-webhook/index.ts');
panel(s,85,200,1110,338,P.white,'Shape 4');
[['Tienda','Solicita la compra',111],['Edge Function','Prepara el pago',397],['Stripe','Procesa el cobro',683],['Webhook','Valida la firma',969]].forEach(v=>node(s,v[0]+'\n'+v[1],v[2],227,225,95,v[0]==='Webhook'?P.forest:P.mint));node(s,'RPC de la base\nAplica el evento y actualiza su resultado',683,417,511,93);edges(s,[0,1],[1,2],[2,3],[3,4]);bar(s,'La pantalla de retorno no acredita el pago. El backend aplica el evento validado.','Confirmación');

s=S('Tareas externas con una bandeja de salida','04 · DESARROLLO DEL BACKEND',4,prior[18].notes,'46, 51, 53');
panel(s,85,200,1110,338,P.white,'Shape 4');node(s,'Acción de negocio\nTransacción SQL',111,229,307,103,P.mint);node(s,'Outbox\nEvento pendiente',487,229,307,103,P.forest);node(s,'Edge Function\nProcesamiento y reintentos',863,229,307,103,P.mint);node(s,'Proveedor externo\nEntrega del mensaje',863,415,307,94);edges(s,[0,1],[1,2],[2,3]);bar(s,'La operación encola el evento y el envío ocurre después.','Asíncrono');

s=S('Pruebas de las reglas y de los recorridos','04 · DESARROLLO DEL BACKEND',3,prior[19].notes,'54–56, 58; repositorio');
panel(s,85,200,413,414,P.forest,'Shape 4');pill(s,'Qué debe probarse',111,225,273,P.lime);t(s,'Accesos permitidos y rechazados, datos consistentes y flujos completos.',111,294,356,178,32,P.white);t(s,'La evidencia identifica versión, entorno, fecha y resultado.',111,529,356,70,23,P.mint);
[['pgTAP','Permisos, restricciones y transiciones.'],['Deno test','Funciones del servidor e integraciones.'],['Vitest','Validaciones y paquetes compartidos.'],['Playwright','Recorridos de las aplicaciones web.']].forEach((v,k)=>{let y=207+k*101;panel(s,523,y,672,87,P.white,['Shape 8','Shape 12','Shape 16','Shape 20'][k]);pill(s,v[0],545,y+25,151,k===3?P.lime:P.mint);t(s,v[1],719,y+19,447,59,23)});

s=S('Desarrollo, integración y despliegue','04 · DESARROLLO DEL BACKEND',18,prior[20].notes,'54–56; docs/despliegue.md');
panel(s,85,200,1110,118,P.forest,'Shape 4');pill(s,'Contrato compartido',111,224,269,P.lime);t(s,'Migraciones SQL, tipos generados y funciones de nombre estable.',405,222,755,68,27,P.white);
[['Código','Revisión y versionado'],['CI','Tipos, lint y pruebas'],['Backend','Migraciones y funciones'],['Aplicaciones','Docker y Railway']].forEach((v,k)=>{let x=85+k*284;panel(s,x,349,259,181,P.white,['Shape 17','Shape 22','Shape 27','Shape 32'][k]);pill(s,v[0],x+18,369,211,k===3?P.lime:P.mint);t(s,v[1],x+21,427,216,76,25);if(k<3)s.edges.push({custom:true,x1:x+259,y1:440,x2:x+284,y2:440})});bar(s,'El repositorio prepara el despliegue. Su operación debe verificarse en cada entorno.','Publicación');

s=three('Decisiones del diseño y validación pendiente','CIERRE TÉCNICO',[
 ['Aporte','Reglas comunes','Las tres aplicaciones consumen un núcleo de datos y permisos consistente.'],['Dependencia','Backend compartido','Los cambios del modelo o las RPC pueden afectar a varios clientes.'],['Validación','Recorrido completo','Conservar evidencia de compra, pago, asignación y entrega antes de acreditar producción.']], 'Los diagramas y contratos deben evolucionar junto con las migraciones.',prior[21].notes,'47–48, 57–58');

s=S('Rapitrip: un diseño conectado de principio a fin','CIERRE DE LA PRESENTACIÓN',33,prior[21].notes,'57–58');
[['Requerimientos','Definen lo que necesita cada actor.'],['Modelos','Relacionan procesos y datos.'],['Backend','Ejecuta reglas y protege la operación.']].forEach((v,k)=>{let x=85+k*376;panel(s,x,200,357,267,k===2?P.forest:P.white,['Shape 4','Shape 10','Shape 15'][k]);pill(s,v[0],x+24,225,269,k===2?P.lime:P.mint);t(s,v[1],x+24,304,308,124,32,k===2?P.white:P.ink)});
panel(s,85,491,1110,122,P.forest,'Shape 23');t(s,'Preguntas y demostración del sistema',115,512,1050,47,35,P.white,true);t(s,'Los anexos permiten revisar los diagramas originales.',115,567,1050,29,22,P.mint);

const original=(title,imgs,pages)=>{let s=S(title,'ANEXOS · MODELOS ORIGINALES',4,'Diagramas originales del entregable. Complementan las síntesis explicativas y conservan sus detalles. Las figuras reflejan el modelado del documento, mientras que el capítulo de backend describe las decisiones técnicas integradas.',pages);panel(s,85,193,1110,422,P.white,'Shape 4');s.original=imgs;return s};
original('Casos de uso del negocio y del sistema',['negocio.png','sistema.png'],'32–33');
original('Diagrama de clases por áreas',['clases-1.png','clases-2.png','clases-3.png'],'34–36');
original('Procesos de compra y registro de producto',['proceso-pedido.png','proceso-producto.png'],'39–40');
original('Modelo entidad–relación por áreas',['entidad-relacion.png'],'41–42');

export const sourcePdf='C:/Users/alexa/Downloads/Entregable final de Diseño de Internet(Rapitrip).pdf';
export const reference='C:/Users/alexa/Downloads/PETI Rapitrip presentación de defensa.pptx';

