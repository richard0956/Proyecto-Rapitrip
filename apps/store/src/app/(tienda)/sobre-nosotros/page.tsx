import { Reveal } from "@rapitrip/ui";
import { Banknote, ChevronRight, ShieldCheck, Store, Truck, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { createElement } from "react";

export const metadata: Metadata = { title: "Sobre nosotros", description: "Rapitrip es un canal de comercio: compras en comercios afiliados y te lo llevamos a la puerta." };

/** Lo que hace Rapitrip hoy, tal como funciona la tienda: nada de cifras ni promesas que el sistema no cumple. */
const pillars: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Store, title: "Comercios afiliados", text: "Empresas y vendedores propios que el equipo de Rapitrip revisa antes de activarlos, con un convenio firmado." },
  { icon: ShieldCheck, title: "Compra con confianza", text: "Confirmamos tu correo antes de activar la cuenta y cada pedido queda registrado con su estado de principio a fin." },
  { icon: Truck, title: "Entrega a domicilio", text: "Cada pedido sale con un repartidor asignado. Si compras en varias tiendas, tu compra se divide en un pedido por tienda." },
  { icon: Banknote, title: "Pagas como prefieras", text: "En efectivo o con tarjeta: eliges la forma de pago al confirmar tu compra." },
];

export default function SobreNosotrosPage() {
  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-6 sm:gap-8">
      <section aria-labelledby="titulo" className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,var(--panel)_0%,#0d5644_60%,#14705a_100%)] dark:bg-[linear-gradient(180deg,#0b1a2e_0%,#0b2236_60%,#0e2c3a_100%)] px-6 py-12 text-white sm:px-12 sm:py-16">
        <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 size-96 rounded-full bg-esmeralda/20 blur-3xl" />
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-esmeralda">Sobre nosotros</p>
          <h1 id="titulo" className="mt-3 max-w-[20ch] text-[34px] font-extrabold leading-[1.05] tracking-tight sm:text-[48px]">
            Un canal de comercio para todo lo que buscas
          </h1>
          <p className="mt-4 max-w-[60ch] text-[15.5px] leading-relaxed text-nav-texto">
            Rapitrip reúne en un solo lugar a comercios afiliados que venden tecnología, hogar, muebles, herramientas, moda y mucho más. Tú eliges, pagas y nosotros coordinamos la entrega hasta tu puerta.
          </p>
        </Reveal>
      </section>

      <Reveal className="rounded-[2rem] bg-superficie p-5 shadow-[0_30px_60px_-44px_rgb(6_54_42/0.4)] ring-1 ring-selva/[0.04] sm:p-10">
        <h2 className="text-[24px] font-bold tracking-tight text-tinta sm:text-[30px]">Cómo funciona</h2>
        <ul className="stagger mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map(({ icon, title, text }) => (
            <li key={title} className="rounded-tarjeta bg-superficie p-5 shadow-[0_18px_40px_-30px_rgb(6_54_42/0.35)] ring-1 ring-selva/[0.05]">
              <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-menta to-superficie text-hoja">
                {createElement(icon, { className: "size-6" })}
              </span>
              <h3 className="mt-4 text-[16px] font-bold text-tinta">{title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-tinta-suave">{text}</p>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/catalogo" className="group flex items-center justify-between gap-4 rounded-[1.75rem] bg-superficie p-6 shadow-[0_18px_40px_-30px_rgb(6_54_42/0.45)] ring-1 ring-selva/[0.05] hover:bg-crema">
          <span>
            <span className="block text-[18px] font-bold text-tinta">Explora el catálogo</span>
            <span className="mt-1 block text-[13.5px] text-tinta-suave">Productos de todos los comercios afiliados.</span>
          </span>
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-selva text-sobre-acento transition-transform group-hover:translate-x-0.5">
            <ChevronRight className="size-4" />
          </span>
        </Link>
        <Link href="/vende" className="group flex items-center justify-between gap-4 rounded-[1.75rem] bg-panel p-6 text-white shadow-pulsa hover:opacity-95">
          <span>
            <span className="block text-[18px] font-bold">¿Tienes un negocio?</span>
            <span className="mt-1 block text-[13.5px] text-nav-texto">Afilia tu comercio y vende en Rapitrip.</span>
          </span>
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-superficie text-selva transition-transform group-hover:translate-x-0.5">
            <ChevronRight className="size-4" />
          </span>
        </Link>
      </Reveal>
    </main>
  );
}
