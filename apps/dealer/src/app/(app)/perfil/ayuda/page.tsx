import { CircleHelp, ClipboardList, Mail, MessageSquareHeart, Siren, Workflow } from "lucide-react";
import { FeedbackForm } from "@/components/feedback-form";
import { HelpFaq, type FaqItem } from "@/components/help-faq";
import { SettingsHeader, SettingsSection } from "@/components/settings-header";
import { statusLabel, stepFor } from "@/lib/order-steps";

export const metadata = { title: "Ayuda" };

/** Correo de contacto; solo se muestra si está configurado (el mismo dato que usa la tienda). */
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";

/** Un pedido de punta a punta, con los mismos nombres de botones y pasos que ve el repartidor. */
const guide = [
  { title: "Ponte disponible", text: "Toca «Empezar» en el inicio. Solo así coordinación te propone pedidos." },
  { title: "Acepta la propuesta", text: "Mira cuánto te pagan, de dónde sale y si cobras. Tienes una cuenta regresiva para responder." },
  { title: "Recoge en la tienda", text: "Foto del paquete con el número de pedido visible y el código de recogida que te muestra el comercio." },
  { title: "Entrega al cliente", text: "Foto en el lugar de entrega y el código que te da el cliente. Si cobras, anota el monto." },
  { title: "Rinde el efectivo", text: "Lleva lo cobrado a la caja con el código del pedido. En «Historial» queda como «rendido»." },
];

/** Los estados en el orden en que avanza un pedido; el texto sale de la misma lógica que usa el detalle del pedido. */
const states = ["confirmado", "preparando", "listo", "en_camino", "entregado"].map((status) => ({ status, label: statusLabel[status] ?? status, ...stepFor(status) }));

/** Preguntas frecuentes del reparto: solo lo que la app hace hoy. */
const faq: FaqItem[] = [
  { topic: "propuestas", q: "¿Cómo recibo propuestas?", a: "Toca «Empezar» en el inicio para quedar disponible. Coordinación solo propone pedidos a quien está disponible. Cuando termines tu jornada, toca «Terminé»." },
  { topic: "propuestas", q: "¿Qué pasa si no respondo a tiempo?", a: "Cada propuesta tiene una cuenta regresiva. Si llega a cero, vence y coordinación puede ofrecer el pedido a otra persona. Si sigues disponible, te pueden enviar otra." },
  { topic: "propuestas", q: "¿Puedo rechazar una propuesta?", a: "Sí. Toca «Rechazar» y elige el motivo (estás muy lejos, sin vehículo, fuera de turno u otro). Coordinación la ofrecerá a otra persona." },
  { topic: "propuestas", q: "No me llegan los avisos de propuestas", a: "Actívalos en Perfil → Preferencias. En iPhone, primero añade la app a la pantalla de inicio desde Safari y ábrela desde ese icono. Con la app abierta, también puedes activar sonido y vibración." },
  { topic: "pedidos", q: "¿Cómo recojo un pedido en la tienda?", a: "Cuando el pedido esté «Listo para recoger», toma la foto del paquete con el número de pedido visible y escribe el código de recogida que te muestra el comercio." },
  { topic: "pedidos", q: "¿Cómo confirmo la entrega?", a: "Toma la foto del paquete en el lugar (la puerta o el número de casa, sin fotografiar personas) y escribe el código de entrega que te da el cliente." },
  { topic: "pedidos", q: "No encuentro al cliente o no recibe el pedido", a: "En el detalle del pedido toca «No pude entregar», toma una foto del intento y cuenta qué pasó. Coordinación decidirá qué hacer." },
  { topic: "pedidos", q: "El paquete no cabe en mi vehículo", a: "En un pedido express, antes de recogerlo, toca «No cabe en mi vehículo». Coordinación podrá pasarlo a un envío programado con un vehículo más grande." },
  { topic: "pedidos", q: "¿Puedo devolver un pedido que acepté?", a: "Sí, pero solo antes de recogerlo: toca «Devolver este pedido» en su detalle. Vuelve a coordinación para que lo asigne a otra persona." },
  { topic: "pedidos", q: "¿Y si no tengo señal al tomar la foto?", a: "La foto se guarda en el teléfono y se sube sola cuando vuelve la señal. Arriba de la pantalla verás cuántas fotos faltan por subir." },
  { topic: "pedidos", q: "¿Puedo usar Waze para llegar?", a: "Sí. En Perfil → Preferencias → Navegación eliges si «Cómo llegar» abre Google Maps, Waze o Apple Maps." },
  { topic: "efectivo", q: "¿Qué hago con el efectivo que cobro?", a: "Llévalo a la caja junto con el código que aparece en el detalle del pedido entregado. En «Historial» ves cuánto tienes «por rendir» y qué ya está «rendido»." },
  { topic: "efectivo", q: "El cliente me pagó un monto distinto", a: "Al entregar, escribe el monto que de verdad cobraste. Si no coincide con el del pedido, la app te pide explicar la diferencia." },
  { topic: "cuenta", q: "¿Cómo cambio mi contraseña?", a: "En Perfil → Cuenta → Cambiar contraseña. Si te lo pide, confirma con el código de 6 dígitos que llega a tu correo." },
  { topic: "cuenta", q: "Olvidé mi contraseña", a: "Pide a coordinación que te envíe una invitación nueva; con ella vuelves a crear tu acceso." },
  { topic: "cuenta", q: "Mis datos están mal (teléfono, vehículo…)", a: "Tus datos los registra coordinación. Pídeles que los corrijan; los verás actualizados en Perfil → Cuenta." },
  { topic: "cuenta", q: "Perdí mi teléfono", a: "Desde otro teléfono, ingresa y ve a Perfil → Cuenta → «Cerrar en todos». Así nadie más puede usar tu cuenta." },
];

/** Ayuda, como la de la tienda pero para la calle: lo urgente primero, la guía de un pedido, los estados, preguntas y comentarios. */
export default function AyudaPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <SettingsHeader icon={<CircleHelp aria-hidden="true" className="size-3.5" />} title="Ayuda" text="Cómo funciona un pedido, qué significa cada estado y respuestas rápidas." />

      {/* Lo urgente primero: durante un pedido, el aviso a coordinación es más rápido que cualquier pregunta frecuente. */}
      <section aria-labelledby="urgente" className="flex items-start gap-3.5 rounded-[1.75rem] bg-superficie p-4 shadow-[0_18px_40px_-30px_rgb(6_54_42/0.45)] ring-1 ring-selva/[0.06]">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-durazno text-durazno-texto">
          <Siren className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 id="urgente" className="text-[15px] font-bold text-tinta">
            ¿Algo falla en un pedido?
          </h2>
          <p className="mt-0.5 text-[12.5px] text-tinta-suave">Abre el pedido y toca «Avisar un problema a coordinación». Te dirán qué hacer sin que el pedido cambie de estado.</p>
        </div>
      </section>

      <SettingsSection id="guia" icon={<Workflow className="size-5" />} title="Un pedido, paso a paso" text="De la propuesta a la caja.">
        <ol className="flex flex-col">
          {guide.map((step, index) => (
            <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
              {index < guide.length - 1 ? <span aria-hidden="true" className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-0.5 rounded-full bg-menta-borde" /> : null}
              <span aria-hidden="true" className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-hoja text-[13px] font-extrabold text-sobre-acento ring-4 ring-menta">
                {index + 1}
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-[14px] font-bold text-tinta">{step.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-tinta-suave">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </SettingsSection>

      <SettingsSection id="estados" icon={<ClipboardList className="size-5" />} title="Qué significa cada estado" text="La etiqueta que ves en tus pedidos y qué te toca hacer.">
        <dl className="flex flex-col gap-2">
          {states.map((state) => (
            <div key={state.status} className="rounded-2xl bg-crema px-4 py-3 ring-1 ring-selva/[0.05]">
              <dt className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-menta px-2.5 py-0.5 text-[12px] font-extrabold text-hoja">{state.label}</span>
                <span className="text-[13.5px] font-bold text-tinta">{state.title}</span>
              </dt>
              <dd className="mt-1 text-[12.5px] leading-snug text-tinta-suave">{state.hint}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>

      <SettingsSection id="preguntas" icon={<CircleHelp className="size-5" />} title="Preguntas frecuentes" text="Elige un tema y toca una pregunta para ver la respuesta.">
        <HelpFaq items={faq} />
      </SettingsSection>

      <SettingsSection id="comentarios" icon={<MessageSquareHeart className="size-5" />} title="Comentarios" text="Cuéntanos cómo te va; lo lee el equipo de Rapitrip.">
        <FeedbackForm />
      </SettingsSection>

      {contactEmail ? (
        <a href={`mailto:${contactEmail}`} className="flex items-center gap-3 rounded-[1.75rem] bg-panel px-5 py-4 text-[14px] font-semibold text-white hover:opacity-95 focus-visible:outline-2 focus-visible:outline-hoja">
          <Mail aria-hidden="true" className="size-4 shrink-0 text-esmeralda" />
          Escríbenos a {contactEmail}
        </a>
      ) : null}
    </div>
  );
}
