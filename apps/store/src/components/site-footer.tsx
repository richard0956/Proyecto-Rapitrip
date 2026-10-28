import { Lema } from "@rapitrip/ui";
import { Banknote, CreditCard, KeyRound, MapPin, Package, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createElement } from "react";
import { BrandMark } from "./brand-mark";

const columns = [
  {
    title: "Comprar",
    links: [
      { href: "/catalogo", label: "Catálogo" },
      { href: "/tiendas", label: "Tiendas" },
      { href: "/catalogo?descuento=1&orden=descuento", label: "Descuentos" },
      { href: "/catalogo?orden=vendidos", label: "Más vendidos" },
      { href: "/catalogo?orden=recientes", label: "Novedades" },
    ],
  },
  {
    title: "Tu cuenta",
    links: [
      { href: "/ingresar", label: "Ingresar" },
      { href: "/registro", label: "Crear cuenta" },
      { href: "/pedidos", label: "Mis pedidos" },
      { href: "/perfil", label: "Mi perfil" },
    ],
  },
  {
    title: "Rapitrip",
    links: [
      { href: "/sobre-nosotros", label: "Sobre nosotros" },
      { href: "/vende", label: "Vende en Rapitrip" },
      { href: "/terminos", label: "Términos" },
      { href: "/privacidad", label: "Privacidad" },
    ],
  },
];

/** Accesos de ayuda con ícono, en el lugar de los datos de contacto de la referencia. */
const help: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/pedidos", label: "Sigue tu pedido", icon: Package },
  { href: "/perfil/direcciones", label: "Tus direcciones de entrega", icon: MapPin },
  { href: "/recuperar", label: "Recupera tu contraseña", icon: KeyRound },
];

/** Formas de pago como baldosas de tarjeta, igual que la fila de logos de pago de la referencia. */
const payments = [
  { label: "Efectivo", icon: Banknote, tone: "bg-exito text-sobre-acento" },
  { label: "Tarjeta", icon: CreditCard, tone: "bg-marino text-sobre-acento" },
];

const linkStyle = "text-[13px] text-tinta-suave underline-offset-4 transition-colors hover:text-hoja hover:underline";

/**
 * Pie de página a la manera de la referencia: marca, lema y formas de pago a la izquierda; columnas de enlaces y una columna de
 * ayuda con íconos a la derecha; abajo, una franja con el derecho de autor, la privacidad al centro y los términos a la derecha.
 */
export function SiteFooter() {
  return (
    <footer className="mt-12 px-3 pb-3 sm:mt-16 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-[1180px] overflow-hidden rounded-[2rem] bg-superficie bg-[radial-gradient(120%_90%_at_0%_100%,color-mix(in_srgb,var(--menta)_70%,transparent),transparent_60%)] px-6 pt-9 shadow-[0_30px_60px_-40px_rgb(6_54_42/0.35)] ring-1 ring-selva/[0.05] sm:px-10 sm:pt-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_2.4fr]">
          <div className="flex flex-col gap-4">
            <BrandMark />
            <Lema />
            <p className="max-w-[32ch] text-[13.5px] leading-relaxed text-tinta-suave">Tecnología, hogar, herramientas, moda y mucho más de comercios afiliados, con entrega hasta tu puerta.</p>
            <div>
              <p className="text-[12px] font-semibold text-tinta">Formas de pago</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {payments.map(({ label, icon, tone }) => (
                  <li key={label} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-bold shadow-sm ${tone}`}>
                    {createElement(icon, { "aria-hidden": true, className: "size-4" })}
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <nav aria-label="Pie de página" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="text-[13px] font-semibold text-tinta">{column.title}</p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={linkStyle}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <p className="text-[13px] font-semibold text-tinta">Ayuda</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {help.map(({ href, label, icon }) => (
                  <li key={label}>
                    <Link href={href} className={`flex items-start gap-2 ${linkStyle}`}>
                      {createElement(icon, { "aria-hidden": true, className: "mt-0.5 size-4 shrink-0 text-hoja" })}
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-9 grid grid-cols-1 items-center gap-3 border-t border-selva/10 py-5 text-[12px] text-tinta-suave sm:grid-cols-3">
          <p>© {new Date().getFullYear()} Rapitrip. Todos los derechos reservados.</p>
          <Link href="/privacidad" className="hover:text-hoja sm:justify-self-center">
            Privacidad
          </Link>
          <Link href="/terminos" className="hover:text-hoja sm:justify-self-end">
            Términos y condiciones
          </Link>
        </div>
      </div>
    </footer>
  );
}
