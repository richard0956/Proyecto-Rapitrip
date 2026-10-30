"use client";

import { cn, Lema } from "@rapitrip/ui";
import { Flame, Home, LayoutGrid, LogOut, Percent, Search, Settings, Sparkles, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CustomerResult } from "@/lib/result";
import { AccountMenu } from "./account-menu";
import { AddressPicker, type HeaderAddress } from "./address-picker";
import { BrandMark } from "./brand-mark";
import { CartLink } from "./cart-link";
import { ThemeSync } from "./theme-picker";

type Props = {
  signedIn: boolean;
  email: string | null;
  /** Enlace firmado de la foto de perfil, si el cliente subió una. */
  photo?: string | null;
  addresses: HeaderAddress[];
  setDefault: (id: string) => Promise<CustomerResult>;
  signOut: () => Promise<void>;
};

/** Vidrio esmerilado del encabezado fijo: blanco translúcido que desenfoca lo que pasa por detrás. */
const glass = "bg-superficie/85 backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-500 ease-fluido";

/** Los apartados clave de la tienda: una sola fila de pestañas debajo de la barra principal. */
const sections = [
  {
    href: "/",
    label: "Inicio",
    icon: Home,
    match: (path: string, orden: string | null, descuento: boolean) => path === "/" && !orden && !descuento,
  },
  {
    href: "/catalogo",
    label: "Catálogo",
    icon: LayoutGrid,
    match: (path: string, orden: string | null, descuento: boolean) => path === "/catalogo" && !orden && !descuento,
  },
  {
    href: "/tiendas",
    label: "Tiendas",
    icon: Store,
    match: (path: string) => path.startsWith("/tiendas"),
  },
  {
    href: "/catalogo?descuento=1&orden=descuento",
    label: "Descuentos",
    icon: Percent,
    match: (path: string, _o: string | null, descuento: boolean) => path === "/catalogo" && descuento,
  },
  {
    href: "/catalogo?orden=vendidos",
    label: "Más vendidos",
    icon: Flame,
    match: (path: string, orden: string | null) => path === "/catalogo" && orden === "vendidos",
  },
  {
    href: "/catalogo?orden=recientes",
    label: "Novedades",
    icon: Sparkles,
    match: (path: string, orden: string | null) => path === "/catalogo" && orden === "recientes",
  },
];

/**
 * Ubicación y buscador en una sola píldora: a la izquierda «Entregar en» (el nombre de la dirección), una línea divisoria y el
 * buscador, que es un formulario GET al catálogo y funciona sin JavaScript.
 */
function LocationSearch({ id, signedIn, addresses, setDefault, className = "" }: { id: string; signedIn: boolean; addresses: HeaderAddress[]; setDefault: Props["setDefault"]; className?: string }) {
  return (
    <div className={cn("flex h-11 min-w-0 items-center rounded-full bg-crema transition-shadow focus-within:ring-2 focus-within:ring-hoja", className)}>
      <AddressPicker compact signedIn={signedIn} addresses={addresses} setDefault={setDefault} className="h-full shrink-0" />
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-selva/15" />
      <form action="/catalogo" role="search" className="relative h-full min-w-0 flex-1">
        <label htmlFor={id} className="sr-only">
          Buscar productos
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" />
        <input
          id={id}
          name="q"
          type="search"
          maxLength={80}
          placeholder="Buscar productos…"
          className="h-full w-full rounded-r-full bg-transparent pl-9 pr-4 text-[13.5px] text-tinta placeholder:text-tinta-suave/80 focus:outline-none"
        />
      </form>
    </div>
  );
}

/**
 * Encabezado de la tienda: una barra blanca con la ubicación unida al buscador a la izquierda, la marca en el centro exacto y la
 * cuenta con el carrito a la derecha; debajo, los apartados clave centrados en una sola píldora. «Vende en Rapitrip» vive al
 * final de la portada y en el pie. En móvil la barra deja el menú, la marca y el carrito; la ubicación con el buscador baja a su
 * propia fila.
 */
export function SiteNav({ signedIn, email, photo = null, addresses, setDefault, signOut }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const orden = params.get("orden");
  const descuento = params.get("descuento") === "1";
  // El menú se abre para una ruta concreta: al navegar deja de coincidir y se cierra solo.
  const [openFor, setOpenFor] = useState<string | null>(null);
  // Al bajar, el encabezado se queda fijo arriba; la sombra crece un poco para separarlo del contenido que pasa por detrás.
  const [scrolled, setScrolled] = useState(false);
  // En móvil, al bajar queda solo la barra principal: el buscador y los apartados se pliegan y vuelven al subir. No se pliegan
  // mientras el foco está dentro (por ejemplo, escribiendo en el buscador o con la lista de direcciones abierta).
  const [collapsed, setCollapsed] = useState(false);
  const rowsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      const busy = !!rowsRef.current?.contains(document.activeElement);
      // Solo en móvil: en pantallas medianas en adelante las filas siempre se ven (y deben seguir activas).
      const mobile = window.matchMedia("(max-width: 767.98px)").matches;
      if (!mobile || y < 120 || y < last - 6) setCollapsed(false);
      else if (y > last + 6 && !busy) setCollapsed(true);
      if (Math.abs(y - last) > 6) last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const open = openFor === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenFor(null);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const menu = signedIn
    ? [...sections.slice(1), { href: "/pedidos", label: "Mis pedidos" }, { href: "/ajustes", label: "Ajustes" }]
    : [...sections.slice(1), { href: "/ajustes", label: "Ajustes" }, { href: "/ingresar", label: "Ingresar" }, { href: "/registro", label: "Crear cuenta" }];

  return (
    <>
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className="mx-auto max-w-[1180px]">
          {/* Tres columnas iguales a los lados: el logo queda en el centro exacto, sin importar lo que haya a cada lado. */}
          <div
            className={cn(
              "grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-full p-2 ring-1 ring-selva/[0.06]",
              glass,
              scrolled ? "shadow-[0_22px_44px_-24px_rgb(6_54_42/0.45)]" : "shadow-[0_18px_40px_-30px_rgb(6_54_42/0.45)]",
            )}
          >
            <div className="flex min-w-0 items-center justify-self-start">
              <button
                type="button"
                onClick={() => setOpenFor(open ? null : pathname)}
                aria-expanded={open}
                aria-controls="menu-movil"
                aria-label={open ? "Cerrar menú" : "Abrir menú"}
                className="relative flex size-11 items-center justify-center rounded-full bg-selva text-sobre-acento transition-transform duration-500 ease-fluido active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja md:hidden"
              >
                <span aria-hidden="true" className="absolute h-px w-[18px] -translate-y-[5px] bg-current" />
                <span aria-hidden="true" className="absolute h-px w-[18px] bg-current" />
                <span aria-hidden="true" className="absolute h-px w-[18px] translate-y-[5px] bg-current" />
              </button>
              <LocationSearch id="buscar" signedIn={signedIn} addresses={addresses} setDefault={setDefault} className="hidden w-full max-w-[380px] md:flex" />
            </div>

            <Link href="/" aria-label="Rapitrip, inicio" className="rounded-full px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
              <BrandMark priority />
            </Link>

            <div className="flex items-center gap-1.5 justify-self-end">
              {signedIn ? (
                <div className="hidden items-center gap-1 md:flex">
                  <Link href="/pedidos" className="inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-semibold text-tinta hover:bg-crema">
                    Mis pedidos
                  </Link>
                  <AccountMenu email={email} photo={photo} signOut={signOut} />
                </div>
              ) : (
                <Link href="/ingresar" className="hidden min-h-11 items-center gap-2 rounded-full bg-crema px-4 text-[13px] font-semibold text-tinta transition-colors hover:bg-menta md:inline-flex">
                  <UserRound aria-hidden="true" className="size-4" />
                  Ingresar
                </Link>
              )}
              <ThemeSync />
              <Link
                href="/ajustes"
                aria-label="Ajustes"
                title="Ajustes"
                aria-current={pathname.startsWith("/ajustes") ? "page" : undefined}
                className="group flex size-11 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta ring-1 ring-selva/[0.08] transition-colors duration-500 ease-fluido hover:bg-crema focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja aria-[current=page]:bg-selva aria-[current=page]:text-sobre-acento"
              >
                <Settings aria-hidden="true" className="size-5 transition-transform duration-700 ease-fluido group-hover:rotate-90" />
              </Link>
              <CartLink />
            </div>
          </div>

          {/* Fila del buscador en móvil: se pliega al bajar y vuelve al subir. Se pliega con la altura, sin opacidad: la opacidad
            cortaría el desenfoque del vidrio. */}
          <div ref={rowsRef} className={cn("grid transition-[grid-template-rows] duration-500 ease-fluido md:grid-rows-[1fr]", collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}>
            <div className="min-h-0 overflow-hidden pb-2 md:pb-0" inert={collapsed ? true : undefined}>
              <LocationSearch
                id="buscar-movil"
                signedIn={signedIn}
                addresses={addresses}
                setDefault={setDefault}
                className={cn("mt-2.5 shadow-[0_18px_40px_-30px_rgb(6_54_42/0.45)] ring-1 ring-selva/[0.06] md:hidden", glass)}
              />
            </div>
          </div>
        </div>

        <nav
          id="menu-movil"
          aria-label="Menú móvil"
          inert={!open}
          className={cn(
            "fixed inset-0 z-40 flex flex-col justify-center gap-1 overflow-y-auto bg-panel/[0.97] px-8 pb-10 pt-24 backdrop-blur-3xl transition-[opacity,transform] duration-700 ease-fluido md:hidden",
            open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0",
          )}
        >
          <button
            type="button"
            onClick={() => setOpenFor(null)}
            aria-label="Cerrar menú"
            className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full bg-white/10 text-white focus-visible:outline-2 focus-visible:outline-esmeralda"
          >
            <span aria-hidden="true" className="absolute h-px w-[18px] rotate-45 bg-current" />
            <span aria-hidden="true" className="absolute h-px w-[18px] -rotate-45 bg-current" />
          </button>
          {menu.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                transitionDelay: open ? `${120 + index * 50}ms` : "0ms",
              }}
              className={cn(
                "block rounded-2xl py-2 text-[28px] font-extrabold leading-tight tracking-tight text-white transition-[opacity,transform] duration-700 ease-fluido focus-visible:outline-2 focus-visible:outline-esmeralda",
                open ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0",
              )}
            >
              {item.label}
            </Link>
          ))}
          {signedIn ? (
            <form action={signOut} className="mt-6">
              <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-base font-bold text-bruma focus-visible:outline-2 focus-visible:outline-esmeralda dark:text-nav-texto/70">
                <LogOut className="size-5" aria-hidden="true" />
                Salir
              </button>
            </form>
          ) : null}
          <Lema tone="dark" className="mt-10" />
        </nav>
      </header>

      {/* Los apartados no acompañan al bajar: se quedan en su lugar, debajo del encabezado, y se van con la página. */}
      <div className="px-3 sm:px-6">
        <div className="mx-auto max-w-[1180px]">
          <nav aria-label="Apartados" className="-mx-3 mt-3 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <ul className={cn("mx-auto flex w-max items-center gap-1.5 rounded-full p-1 ring-1 ring-selva/[0.05]", glass)}>
              {sections.map(({ href, label, icon: Icon, match }) => {
                const active = match(pathname, orden, descuento);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors duration-500 ease-fluido focus-visible:outline-2 focus-visible:outline-hoja",
                        active ? "bg-selva text-sobre-acento shadow-pulsa" : "text-tinta hover:bg-superficie dark:hover:bg-selva/10",
                      )}
                    >
                      <Icon aria-hidden="true" className={cn("size-4", active ? "text-esmeralda dark:text-sobre-acento" : "text-hoja")} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
