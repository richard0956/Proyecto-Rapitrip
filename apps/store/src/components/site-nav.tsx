"use client";

import { Avatar, buttonStyles, ButtonIsland, cn, Lema, Logo } from "@rapitrip/ui";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CartLink } from "./cart-link";

type Props = { signedIn: boolean; email: string | null; signOut: () => Promise<void> };

const linkStyle = "inline-flex min-h-11 items-center rounded-full px-4 text-[13.5px] font-bold text-tinta transition-colors duration-500 ease-fluido hover:bg-selva/5 focus-visible:outline-2 focus-visible:outline-hoja";

/**
 * Navegación «isla»: una píldora de cristal flotando sobre la página. En móvil, el botón de tres líneas se transforma en una X y abre
 * una cortina de pantalla completa con los enlaces entrando en cascada. El desenfoque solo se aplica a elementos fijos.
 */
export function SiteNav({ signedIn, email, signOut }: Props) {
  const pathname = usePathname();
  // El menú se abre para una ruta concreta: al navegar deja de coincidir y se cierra solo.
  const [openFor, setOpenFor] = useState<string | null>(null);
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

  const items = signedIn
    ? [
        { href: "/catalogo", label: "Catálogo" },
        { href: "/tiendas", label: "Tiendas" },
        { href: "/pedidos", label: "Mis pedidos" },
        { href: "/perfil", label: "Mi perfil" },
        { href: "/vende", label: "Vende en Rapitrip" },
      ]
    : [
        { href: "/catalogo", label: "Catálogo" },
        { href: "/tiendas", label: "Tiendas" },
        { href: "/ingresar", label: "Ingresar" },
        { href: "/registro", label: "Crear cuenta" },
        { href: "/vende", label: "Vende en Rapitrip" },
      ];

  return (
    <header className="fixed inset-x-0 top-3 z-30 px-3 sm:top-5 sm:px-6">
      <div className={cn("mx-auto flex max-w-[1100px] items-center justify-between rounded-full py-1.5 pl-5 pr-1.5 shadow-suave ring-1 ring-selva/10 backdrop-blur-xl transition-colors duration-500 ease-fluido", open ? "bg-papel" : "bg-papel/75")}>
        <Link href="/" className="rounded-full py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hoja">
          <Logo tone="light" priority className="[&_img]:h-7" />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          <Link href="/catalogo" className={linkStyle}>
            Catálogo
          </Link>
          <Link href="/tiendas" className={linkStyle}>
            Tiendas
          </Link>
          <Link href="/vende" className={linkStyle}>
            Vende en Rapitrip
          </Link>
          <CartLink />
          {signedIn ? (
            <>
              <Link href="/pedidos" className={linkStyle}>
                Mis pedidos
              </Link>
              <Link href="/perfil" aria-label="Mi perfil" className="mx-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                <Avatar name={email} />
              </Link>
              <form action={signOut}>
                <button type="submit" className={cn(linkStyle, "gap-2 text-hoja")}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Salir
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/ingresar" className={linkStyle}>
                Ingresar
              </Link>
              <Link href="/registro" className={buttonStyles({ variant: "primary", className: "pr-5" })}>
                Crear cuenta
                <ButtonIsland />
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <CartLink />
        <button
          type="button"
          onClick={() => setOpenFor(open ? null : pathname)}
          aria-expanded={open}
          aria-controls="menu-movil"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="relative flex size-11 items-center justify-center rounded-full bg-hoja text-white transition-transform duration-500 ease-fluido active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
        >
          <span aria-hidden="true" className={cn("absolute h-px w-[18px] bg-current transition-transform duration-500 ease-fluido", open ? "rotate-45" : "-translate-y-[5px]")} />
          <span aria-hidden="true" className={cn("absolute h-px w-[18px] bg-current transition-[opacity,transform] duration-300 ease-fluido", open ? "scale-x-0 opacity-0" : "opacity-100")} />
          <span aria-hidden="true" className={cn("absolute h-px w-[18px] bg-current transition-transform duration-500 ease-fluido", open ? "-rotate-45" : "translate-y-[5px]")} />
        </button>
        </div>
      </div>

      <nav
        id="menu-movil"
        aria-label="Menú móvil"
        inert={!open}
        className={cn(
          "fixed inset-0 -z-10 flex flex-col justify-center gap-2 bg-selva/[0.97] px-8 pb-10 pt-28 backdrop-blur-3xl transition-[opacity,transform] duration-700 ease-fluido md:hidden",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0",
        )}
      >
        {items.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            style={{ transitionDelay: open ? `${120 + index * 70}ms` : "0ms" }}
            className={cn(
              "block rounded-2xl py-3 text-[34px] font-extrabold leading-tight tracking-tight text-white transition-[opacity,transform] duration-700 ease-fluido focus-visible:outline-2 focus-visible:outline-esmeralda",
              open ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0",
            )}
          >
            {item.label}
          </Link>
        ))}
        {signedIn ? (
          <form action={signOut} className="mt-6">
            <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-base font-bold text-bruma focus-visible:outline-2 focus-visible:outline-esmeralda">
              <LogOut className="size-5" aria-hidden="true" />
              Salir
            </button>
          </form>
        ) : null}
        <Lema tone="dark" className="mt-10" />
      </nav>
    </header>
  );
}
