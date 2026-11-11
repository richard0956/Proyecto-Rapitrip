from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
W,H=5400,8280
im=Image.new('RGB',(W,H),'#ffffff'); g=ImageDraw.Draw(im)
fontpath='C:/Windows/Fonts/arial.ttf'; boldpath='C:/Windows/Fonts/arialbd.ttf'
def f(n,b=False):return ImageFont.truetype(boldpath if b else fontpath,n)
def txt(x,y,s,size=29,color='#213047',b=False):g.text((x,y),s,font=f(size,b),fill=color)
def lines(x,y,ss,size=27,step=36):
 for s in ss:txt(x,y,s,size);y+=step
def wrap(s,maxw,size=27):
 out=[];cur=''
 for word in s.split():
  candidate=(cur+' '+word).strip()
  if g.textlength(candidate,font=f(size))>maxw and cur:out.append(cur);cur=word
  else:cur=candidate
 if cur:out.append(cur)
 return out
txt(100,65,'Rapitrip',62,b=True)
txt(100,145,'Diagrama de clases del dominio',48,b=True)
txt(100,220,'Propuesta revisada frente a los 53 RF, los 15 RNF y el código disponible · 9 de noviembre de 2026',31)
txt(100,278,'Modelo conceptual: las operaciones expresan responsabilidades; no representan necesariamente métodos o tablas existentes.',28)
g.rectangle((100,340,145,378),fill='#eaf2fa',outline='#496a8e',width=2);txt(165,340,'Concepto respaldado por el código; no implica aceptación integral del requisito.',28)
g.rectangle((2850,340,2895,378),fill='#fff1d6',outline='#b97819',width=2);txt(2915,340,'Ampliación requerida o comportamiento por completar.',28)
txt(100,402,'Las asociaciones internas se dibujan con multiplicidades. Las relaciones adicionales se detallan al pie de cada paquete y en la franja inferior.',27)

# name, attributes, operations, proposed
def C(name,a,o='',p=False):return(name,a.split('|'),o.split('|') if o else [],p)
panels=[
('01  Identidad y acceso','RF-IDA-01 a 05 · RF-SUP-01 y 03',[
C('Cuenta','id: UUID = Supabase Auth|aplicacion: tienda / consola / repartidor|estado: EstadoCuenta; verificada: Boolean','verificar(); actualizarPerfil(); anonimizar()'),
C('AsignacionRol','id: UUID; estado: EstadoRol|alta: DateTime; motivo: String|alcanceComercio: UUID [0..1]','suspender(); reactivar(); revocar()'),
C('Rol','nombre: TipoRol|nivel: Integer; exigeMFA: Boolean','puedeGestionar(rol): Boolean'),
C('Invitacion','id: UUID; correoDestino: String|hashToken: String; vence: DateTime|estado: EstadoInvitacion','consumirUnaVez(); cancelar()'),
C('RegistroSesion','id: UUID; fecha: DateTime|dispositivo: String; resultado: String','registrarAcceso()'),
C('EventoAuditoria','id: UUID; fecha: DateTime|accion: String; objetivo: String|actor: UUID [0..1]; motivo: String','registrarSinDatosSensibles()')],
[(0,1,'1','0..*','posee'),(2,3,'1','0..*','rol destino')],
['Cuenta 1 — 0..* RegistroSesion; Cuenta 0..1 — 0..* EventoAuditoria (actor o sistema).',
'Rol 1 — 0..* AsignacionRol; Cuenta 1 — 0..* Invitacion (emisor).',
'Roles: cliente, comercio, coordinador, cajero, admin, superadmin y repartidor.',
'Cada cuenta pertenece a una aplicación; no se duplica el perfil mediante una clase Cliente.']),
('02  Comercios y catálogo','RF-COM-01 a 07 · RF-INV-01',[
C('Comercio','id: UUID; razonSocial: String|estado: EstadoComercio|convenio: ReferenciaDocumento','suspender(); consultarMetricas()'),
C('Tienda','id: UUID; nombre: String|direccion: String; coordenadas: Punto|departamento: String; cierreHasta: DateTime?','configurarHorario(); cerrarTemporalmente()'),
C('Producto','id: UUID; nombre: String|descripcion: String; publicado: Boolean|peso: Decimal; dimensiones: Medidas','publicar(); evaluarElegibilidadEnvio()'),
C('Variante','id: UUID; sku: String|precio: Dinero; atributos: Valores|activa: Boolean','actualizarPrecio()'),
C('SolicitudAfiliacion','id: UUID; datosNegocio: Datos|documentos: ReferenciaDocumento[0..*]|estado: EstadoSolicitud; motivo: String','aprobar(); rechazar()'),
C('CatalogoMaestro','categorias: Categoria[0..*]|marcas: Marca[0..*]; tipos: Tipo[0..*]|definiciones: Atributo[0..*]','mantenerClasificacion()')],
[(0,1,'1','0..*','agrupa'),(2,3,'1','1..*','tiene')],
['Tienda 1 — 0..* Producto; Producto 1 — 0..* Imagen {url, orden}.',
'Cuenta 1 — 0..* SolicitudAfiliacion; SolicitudAfiliacion 0..1 — 0..1 Comercio (origen).',
'Producto * — 1 Categoria y * — 0..1 Marca; Tienda 1 — 0..* Horario / ExcepcionHorario.',
'AsignacionRol * — 0..1 Comercio (alcance). Catálogo maestro agrupa tipos auxiliares.']),
('03  Cliente y compra','RF-CLI-01 a 05 · RF-PED-01 y 02',[
C('Carrito','id: UUID; actualizado: DateTime|cliente: UUID [0..1]','agregar(); modificarCantidad(); vaciar()'),
C('LineaCarrito','cantidad: Integer|variante: UUID','subtotalEstimado(): Dinero'),
C('Compra','id: UUID; referenciaIdempotencia: UUID|creada: DateTime; total: Dinero|estadoPago: EstadoPago','crearPedidosPorTiendaYClase()'),
C('Direccion','id: UUID; alias: String|detalle: String; referencia: String|coordenadas: Punto; departamento: String','actualizar(); eliminar()'),
C('SolicitudSoporte','id: UUID; tipo: ayuda / opinion|texto: String; estado: EstadoAtencion|creada: DateTime; atendida: DateTime?','registrar(); atender(); consultarEstado()',True),
C('ReporteInconsistencia','id: UUID; descripcion: String|estado: EstadoReporte; fecha: DateTime|producto: UUID; pedido: UUID [0..1]','reportar(); revisar(); resolver()',True)],
[(0,1,'1','0..*','contiene')],
['Cuenta {cliente} 1 — 0..* Direccion / Compra / SolicitudSoporte / ReporteInconsistencia.',
'Compra 1 — 1..* Pedido; Variante 1 — 0..* LineaCarrito. El carrito puede estar vacío.',
'El reporte de lo recibido exige pedido; un reporte del catálogo puede no tenerlo.',
'Soporte requiere seguimiento de atención; el código actual de comentarios no lo acredita.']),
('04  Pedido e inventario','RF-PED-04 a 08 · RF-INV-01 a 03 · RF-SUP-08',[
C('Pedido','id: UUID; numero: Integer|estado: EstadoPedido; canal: Canal|clase: express / programado; total: Dinero','confirmar(); preparar(); cancelar()'),
C('LineaPedido','cantidad: Integer; precioUnitario: Dinero|nombreProducto: String|varianteOrigen: UUID','subtotal(): Dinero'),
C('Inventario','variante: UUID; cantidad: Integer|umbralBajo: Integer','descontar(); devolver(); ajustar()'),
C('MovimientoInventario','id: UUID; fecha: DateTime|tipo: TipoMovimiento; cantidad: Integer|motivo: String; actor: UUID?','registrar()'),
C('EventoPedido','id: UUID; fecha: DateTime|estadoAnterior: EstadoPedido|estadoNuevo: EstadoPedido; motivo: String','registrarTransicion()'),
C('DatosEntregaPedido','direccion: String; referencia: String|coordenadas: Punto; telefono: String|departamento: String; notas: String','conservarInstantanea()')],
[(0,1,'1','1..*','contiene'),(2,3,'1','0..*','registra'),(4,5,'','','')],
['Pedido 1 — 1 DatosEntregaPedido; Pedido 1 — 0..* EventoPedido; Variante 1 — 1 Inventario.',
'Tienda 1 — 0..* Pedido; Cuenta 1 — 0..* Pedido (cliente); Cuenta 0..1 — * EventoPedido.',
'Estados: pendiente_pago, por_confirmar, en_validacion, confirmado, preparando, listo,',
'en_camino, entregado, cancelado y rechazado. En validación corresponde a programados.']),
('05  Seguimiento y ejecución logística','RF-SEG-01 · RF-ENT-01 a 09',[
C('Repartidor','id: UUID; cuenta: UUID [0..1]|activo: Boolean; disponible: Boolean|vehiculo: TipoVehiculo; departamento: String','cambiarDisponibilidad()'),
C('OfertaEntrega','id: UUID; enviada: DateTime|vence: DateTime; estado: EstadoOferta|propuestaPor: UUID; motivoRechazo: String','aceptar(); rechazar(); vencer()'),
C('Entrega','pedido: UUID; estado: EstadoEntrega|repartidorActual: UUID [0..1]|rutaReferencia: String','recoger(); avanzar(); confirmar()'),
C('EvidenciaEntrega','id: UUID; tipo: recogida / entrega|archivoPrivado: String; fecha: DateTime|ubicacionCaptura: Punto [0..1]','subirConReintentoIdempotente()'),
C('CodigoEntrega','pedido: UUID; recogida: String[4]|entrega: String[4]; intentos: Integer|verificadoEn: DateTime [0..1]','validar(); bloquearPorIntentos()'),
C('EventoAsignacion','fecha: DateTime; actor: UUID|anterior: UUID?; nuevo: UUID|motivo: String; origen: manual / oferta','registrarCambio()')],
[(0,1,'1','0..*','recibe'),(2,3,'1','0..*','documenta')],
['Pedido 1 — 0..1 Entrega; Entrega 1 — 0..* OfertaEntrega / EventoAsignacion.',
'Repartidor 0..1 — 0..* Entrega (asignado); Pedido 1 — 0..1 CodigoEntrega.',
'Máximo una oferta pendiente por pedido y repartidor; máximo una asignación vigente.',
'Coordinación propone ofertas. Código y foto dependen de reglas; las excepciones se auditan.']),
('06  Cobros y conciliación','RF-COB-01 a 03 y 06 · RNF-15',[
C('Pago','id: UUID; metodo: efectivo / tarjeta|proveedor: Stripe / ninguno|monto: Dinero; estado: EstadoPago','registrar(); confirmarEvento()'),
C('Reembolso','id: UUID; monto: Dinero|motivo: String; estado: EstadoReembolso|solicitadoPor: UUID; registradoPor: UUID','solicitar(); registrar(); procesar()'),
C('AplicacionPago','importe: Dinero|referenciaComprobante: String','asociarImporteAPedido()'),
C('DesglosePedido','total: Dinero; comercio: Dinero|repartidor: Dinero; rapitrip: Dinero|comisionPasarela: Dinero','validarSuma(): Boolean'),
C('LiquidacionComercio','id: UUID; periodo: Periodo|comision: Dinero; reversiones: Dinero|neto: Dinero; fechaLimite: Date','calcular(); registrarPagoExterno()'),
C('Conciliacion','id: UUID; periodo: Periodo|diferencia: Dinero; estado: String|deposito: Referencia; responsable: UUID','cruzarPedidoPagoDeposito()',True)],
[(0,1,'1','0..*','origina'),(2,3,'','','')],
['Pago 1 — 1..* AplicacionPago; Pedido 1 — 0..* AplicacionPago; Pedido 1 — 1 DesglosePedido.',
'Comercio 1 — 0..* LiquidacionComercio; LiquidacionComercio 1 — 1..* DetalleLiquidacion.',
'Cada DetalleLiquidacion refiere a 1 Pedido; se impide liquidar dos veces el mismo importe.',
'Conciliacion vincula pedidos, pagos y depósitos. Stripe es proveedor, no método de pago.']),
('07  Caja y documentos comerciales','RF-COB-01 a 06 · ampliaciones de implementación',[
C('SesionCaja','id: UUID; apertura: DateTime|cierre: DateTime?; fondo: Dinero|contado: Dinero; diferencia: Dinero','abrir(); registrarCobro(); cerrar()'),
C('EntregaEfectivo','id: UUID; estado: EstadoEntregaEfectivo|esperado: Dinero; recibido: Dinero|fecha: DateTime; comprobante: String','iniciar(); confirmar(); resolverDiferencia()'),
C('CuentaRepartidor','periodo: Periodo; ganado: Dinero|efectivoPorRendir: Dinero; saldo: Dinero','calcularSaldo(); registrarPagoExterno()',True),
C('RegistroPagoExterno','id: UUID; fecha: DateTime|monto: Dinero; medio: String|referencia: String; comprobante: String','registrarSinEjecutarTransferencia()',True),
C('Factura','id: UUID; numero: String|importe: Dinero; emitida: DateTime|tipo: venta / nota_credito','emitir(); descargar()'),
C('CierreQuincenal','inicio: Date; fin: Date|ingresos: Dinero; costos: Dinero|participaciones: RepartoSocio[1..*]','calcular(); registrarCierre()',True)],
[(0,1,'1','0..*','recibe'),(2,3,'1','0..*','liquida')],
['Cuenta {cajero} 1 — 0..* SesionCaja; Repartidor 1 — 0..* EntregaEfectivo / CuentaRepartidor.',
'EntregaEfectivo 1 — 1..* DetalleRendicion; cada detalle refiere a 1 cobro de Pedido.',
'Pedido 1 — 0..* Factura; una nota de crédito referencia una factura original.',
'LiquidacionComercio 1 — 0..* RegistroPagoExterno; CierreQuincenal reúne saldos del periodo.']),
('08  Operación y extensiones requeridas','RF-SUP-02 y 05 a 08 · RF-SEG-02 · RF-ENT-02 a 04',[
C('ExcepcionPedido','id: UUID; tipo: TipoExcepcion|estado: String; causa: String|resolucion: String; responsable: UUID?','tomar(); comentar(); resolver()',True),
C('Sustitucion','id: UUID; original: LineaPedido|variantePropuesta: UUID; precio: Dinero|estado: String; respuesta: DateTime?','proponer(); aceptar(); rechazar()',True),
C('TurnoRepartidor','id: UUID; inicio: DateTime|fin: DateTime?; activo: Boolean','activar(); finalizar()',True),
C('MuestraUbicacion','latitud: Decimal; longitud: Decimal|instante: DateTime; precision: Decimal','capturarSoloEnTurno()',True),
C('PoliticaOperativa','clave: String; valor: String|vigencia: DateTime; version: Integer','configurar(); auditarCambio()',True),
C('ServicioAsignacion','modo: manual / sugerido / automatico|limiteRespuesta: Duracion|criterio: carga / cercania','sugerir(); ofertar(); siguienteCandidato()',True)],
[(0,1,'0..1','0..*','gestiona'),(2,3,'1','0..*','registra')],
['Pedido 1 — 0..* ExcepcionPedido / Sustitucion / NotaInterna {texto, fecha, autor}.',
'ExcepcionPedido 1 — 0..* ComentarioExcepcion; cada sustitución modifica 1 LineaPedido.',
'Repartidor 1 — 0..* TurnoRepartidor; ServicioAsignacion depende de Pedido y Repartidor.',
'Añadir IncidenteTI {tipo, severidad, estado, autor}; su gestión no sustituye las excepciones.'])
]

panels.extend([
('09  Tarifas y controles logísticos','RF-PED-01 · RF-ENT-07 y 08 · RNF-14',[
C('ZonaEnvio','id: Integer; hastaKm: Decimal|tarifaCliente: Dinero; pagoRepartidor: Dinero|margen: Dinero; requierePrepago: Boolean','calcularTarifa()'),
C('CotizacionEnvio','id: UUID; distanciaKm: Decimal|metodo: ruta / estimacion; vence: DateTime|total: Dinero; clase: ClaseEnvio','validarDestinoYVigencia()'),
C('BandaProgramada','id: Integer; hastaKm: Decimal|minDias: Integer; maxDias: Integer|pagoRepartidor: Dinero; margen: Dinero','calcularPrecioYPlazo()'),
C('ReglaElegibilidad','pesoMaximo: Decimal; medidas: Medidas|departamentoOrigen: String|departamentoDestino: String','determinarClase(productos, destino)'),
C('ReglaEvidencia','exigeFotoRecogida: Boolean|exigeFotoEntrega: Boolean|exigeCodigos: Boolean; retencionDias: Integer','configurar(); auditarExcepcion()'),
C('ReferenciaRuta','origen: Punto; destino: Punto|distanciaKm: Decimal; proveedor: String|referenciaNavegacion: String','calcularConMapbox(); abrirNavegacion()')],
[(0,1,'0..1','0..*','cotiza')],
['CotizacionEnvio * — 1 Tienda y * — 1 Cuenta; cada cotización fija destino y vencimiento.',
'CotizacionEnvio * — 0..1 BandaProgramada; usa zona express o banda programada, según clase.',
'Pedido 1 — 0..1 CotizacionEnvio; conserva la tarifa aplicada aunque cambie el tabulador.',
'Entrega * — 1 ReglaEvidencia vigente; ReferenciaRuta usa puntos de tienda y destino.']),
('10  Registros de operación y finanzas','RF-SUP-06 a 08 · RF-COB-02 y 03 · RF-ENT-09',[
C('Devolucion','id: UUID; pedido: UUID|motivo: String; estado: EstadoDevolucion|solicitada: DateTime; decision: String','solicitar(); aprobar(); rechazar()'),
C('DetalleLiquidacion','pedido: UUID; subtotal: Dinero|comision: Dinero; neto: Dinero|reversiones: Dinero','calcularImporte()'),
C('NotaInterna','id: UUID; texto: String|fecha: DateTime; autor: UUID','registrar()',True),
C('ComentarioExcepcion','id: UUID; texto: String|fecha: DateTime; autor: UUID','agregar()',True),
C('IncidenciaEntrega','id: UUID; tipo: String|descripcion: String; estado: String|autor: UUID; resolucion: String','reportar(); atender()'),
C('IncidenteTI','id: UUID; tipo: String|severidad: String; estado: String|autor: UUID?; reportadoEn: DateTime','registrar(); atender(); resolver()')],
[],
['Pedido 1 — 0..* Devolucion; Devolucion 0..1 — 0..* Reembolso.',
'LiquidacionComercio 1 — 1..* DetalleLiquidacion; Pedido 1 — 0..1 DetalleLiquidacion.',
'Pedido 1 — 0..* NotaInterna; ExcepcionPedido 1 — 0..* ComentarioExcepcion.',
'Entrega 1 — 0..* IncidenciaEntrega; cada incidencia debe abrir una excepción según RF-ENT-09.'])
])

def panel(index,data):
 title,rf,cs,edges,notes=data
 x=100+(index%2)*2650;y=490+(index//2)*1430;pw=2550;ph=1370
 g.rounded_rectangle((x,y,x+pw,y+ph),radius=16,fill='#f8fafc',outline='#a5b4c3',width=3)
 txt(x+35,y+24,title,36,b=True);txt(x+35,y+77,rf,27,color='#52657b')
 boxes=[]
 for j,(name,attrs,ops,prop) in enumerate(cs):
  bx=x+40+(j%2)*1330;by=y+140+(j//2)*310;bw=1140;bh=265
  color='#b97819' if prop else '#496a8e';bg='#fff1d6' if prop else '#eaf2fa'
  g.rectangle((bx,by,bx+bw,by+bh),fill='white',outline=color,width=3)
  g.rectangle((bx,by,bx+bw,by+58),fill=bg,outline=color,width=2)
  txt(bx+18,by+12,name,31,b=True)
  yy=by+72
  for a in attrs:txt(bx+18,yy,'− '+a,26);yy+=35
  g.line((bx,by+187,bx+bw,by+187),fill=color,width=2)
  for k,o in enumerate(ops):txt(bx+18,by+201+k*30,'+ '+o,25)
  boxes.append((bx,by,bw,bh))
 for a,b,ma,mb,label in edges:
  if not label:continue
  ax,ay,aw,ah=boxes[a];bx,by,bw,bh=boxes[b];cy=ay+135
  g.line((ax+aw,cy,bx,cy),fill='#52657b',width=3)
  txt(ax+aw+10,cy-34,ma,24);txt(bx-60,cy-34,mb,24)
  # Relation label fits inside the intentionally wide channel.
  for k,line in enumerate(wrap(label,175,22)):txt(ax+aw+10,cy+10+k*27,line,22)
 yy=y+1090
 for note in notes:
  for line in wrap(note,pw-80,25):txt(x+40,yy,line,25);yy+=34
 assert yy<y+ph-12,(title,yy-y)
for i,p in enumerate(panels):panel(i,p)
yy=7680
txt(100,yy,'Restricciones y alcance del modelo',35,b=True);yy+=60
notes=[
'1. Pedido: las transiciones válidas, los permisos y la reposición de stock se verifican en el servidor; una sustitución requiere aceptación del cliente.',
'2. Identidad: coordinador y cajero son valores de Rol, no subclases de Cuenta. El alcance comercial limita las acciones a las tiendas autorizadas.',
'3. Entrega: códigos privados; fotos en almacenamiento privado; captura puntual de evidencia no equivale a rastreo GPS continuo.',
'4. Excepciones: faltante, confirmación vencida, preparación excedida, sin repartidor, oferta sin respuesta, entrega retrasada, cancelación solicitada, entrega fallida y manual.',
'5. Los elementos ámbar completan el diseño requerido, pero no certifican su implementación. El GPS continuo, la oferta automática y el cierre entre socios requieren validación.',
'6. El diagrama cubre estructura y responsabilidades. Rendimiento, disponibilidad, recuperación, usabilidad y demás RNF requieren pruebas y evidencia adicional.',
'Base: diagrama Lucid v2 proporcionado; catálogo del 13 de octubre; código local de Rapitrip. Revisión conceptual, no esquema físico de base de datos.'
]
for s in notes:
 for line in wrap(s,W-200,28):txt(100,yy,line,28);yy+=39
assert yy<H-40,yy
out=Path('output/diagramas');out.mkdir(parents=True,exist_ok=True)
im.save(out/'Rapitrip_diagrama_clases_revisado.png',dpi=(300,300))
im.resize((1350,2070)).save('tmp/informe/clases_preview.png')
for i in range(len(panels)):
 x=100+(i%2)*2650;y=490+(i//2)*1430
 im.crop((x,y,x+2550,y+1370)).resize((1530,822)).save(f'tmp/informe/clases_panel_{i}.png')
print(out/'Rapitrip_diagrama_clases_revisado.png')
