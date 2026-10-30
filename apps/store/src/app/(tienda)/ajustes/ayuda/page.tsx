import { getSessionInfo } from "@rapitrip/supabase";
import { ChevronDown, CircleHelp, FileText, Info, LogIn, Mail, MessageSquareHeart, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { createElement } from "react";
import { RETURN_WINDOW_DAYS } from "@/lib/returns";
import { serverSupabase } from "@/lib/supabase";
import { SectionCard } from "../section-card";
import { sendFeedback } from "./actions";
import { FeedbackForm } from "./feedback-form";

export const metadata = { title: "Ayuda" };

/** Correo de contacto; solo se muestra si está configurado. */
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";

/** Preguntas frecuentes: solo lo que la tienda hace hoy, sin plazos ni promesas que el sistema no cumple. */
const faq = [
  {
    q: "¿Puedo comprar en varias tiendas a la vez?",
    a: "Sí. Agregas productos de distintas tiendas al mismo carrito y, al pagar, tu compra se divide en un pedido por tienda. Cada pedido tiene su propio envío y su propio repartidor.",
  },
  {
    q: "¿Cómo puedo pagar?",
    a: "En efectivo al recibir o con tarjeta. Eliges la forma de pago al confirmar la compra en el checkout.",
  },
  {
    q: "¿Cuánto cuesta el envío?",
    a: "Depende de la distancia entre la tienda y tu dirección. Lo ves calculado en el checkout antes de confirmar.",
  },
  {
    q: "¿Cómo sigo mi pedido?",
    a: "En «Mis pedidos» ves el estado de cada uno: confirmado, en preparación, en camino y entregado.",
  },
  {
    q: "¿Para qué es el código de entrega?",
    a: "Cuando tu pedido va en camino, en su detalle aparece un código de 4 dígitos. Dáselo al repartidor al recibir: así confirmamos que el pedido llegó a la persona correcta.",
  },
  {
    q: "¿Puedo devolver un producto?",
    a: `Sí, dentro de los ${RETURN_WINDOW_DAYS} días siguientes a la entrega. Desde el detalle del pedido pides la devolución y adjuntas de 1 a 5 fotos del producto.`,
  },
  {
    q: "¿Cómo cambio mi dirección de entrega?",
    a: "En «Direcciones» guardas hasta 10 lugares y marcas uno como predeterminado. También puedes elegirla desde «Entregar en», arriba en la tienda.",
  },
];

const links = [
  { href: "/sobre-nosotros", label: "Sobre nosotros", icon: Info },
  { href: "/terminos", label: "Términos y condiciones", icon: FileText },
  { href: "/privacidad", label: "Política de privacidad", icon: ShieldCheck },
  { href: "/vende", label: "Vende en Rapitrip", icon: Store },
];

/** Ayuda: preguntas frecuentes desplegables, comentarios (con sesión), enlaces útiles y el correo de contacto si existe. */
export default async function AyudaPage() {
  const session = await getSessionInfo(await serverSupabase());
  return (
    <div className="flex flex-col gap-5">
      <SectionCard icon={<CircleHelp className="size-5" />} title="Preguntas frecuentes" text="Respuestas rápidas sobre compras, pagos y entregas." id="preguntas">
        <ul className="flex flex-col gap-2">
          {faq.map((item) => (
            <li key={item.q}>
              <details className="group rounded-2xl bg-crema/60 ring-1 ring-borde transition-colors open:bg-menta/40 open:ring-menta-borde">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-[14px] font-semibold text-tinta focus-visible:outline-2 focus-visible:outline-hoja [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-tinta-suave transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 text-[13.5px] leading-relaxed text-tinta-suave">{item.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard icon={<MessageSquareHeart className="size-5" />} title="Comentarios" text="Cuéntanos cómo te fue; lo lee el equipo de Rapitrip." id="comentarios">
        {session.signedIn ? (
          <FeedbackForm send={sendFeedback} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde">
            <p className="text-[13.5px] text-tinta-suave">Ingresa a tu cuenta para enviarnos un comentario.</p>
            <Link href={`/ingresar?next=${encodeURIComponent("/ajustes/ayuda")}`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-selva px-4 text-[13px] font-semibold text-sobre-acento hover:bg-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
              <LogIn aria-hidden="true" className="size-4" />
              Ingresar
            </Link>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={<FileText className="size-5" />} title="Más información" id="enlaces">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {links.map(({ href, label, icon }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-12 items-center gap-3 rounded-2xl bg-crema/60 px-4 text-[14px] font-semibold text-tinta ring-1 ring-borde transition-colors hover:bg-menta/60 focus-visible:outline-2 focus-visible:outline-hoja">
                {createElement(icon, { "aria-hidden": true, className: "size-4 shrink-0 text-hoja" })}
                {label}
              </Link>
            </li>
          ))}
        </ul>
        {contactEmail ? (
          <a href={`mailto:${contactEmail}`} className="mt-3 flex items-center gap-3 rounded-2xl bg-panel px-4 py-3.5 text-[14px] font-semibold text-white hover:opacity-95 focus-visible:outline-2 focus-visible:outline-hoja">
            <Mail aria-hidden="true" className="size-4 shrink-0 text-esmeralda" />
            Escríbenos a {contactEmail}
          </a>
        ) : null}
      </SectionCard>
    </div>
  );
}
