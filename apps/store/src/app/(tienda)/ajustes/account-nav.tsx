"use client";

import { cn } from "@rapitrip/ui";
import { CircleHelp, Database, LogIn, LogOut, MapPin, Package, Palette, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createElement } from "react";

type Section = { href: string; label: string; text: string; icon: LucideIcon; account?: boolean };

/** Las secciones de la cuenta (`account`) solo aparecen con sesión; Preferencias y Ayuda, siempre. */
const sections: Section[] = [
  { href: "/ajustes", label: "Perfil", text: "Foto, nombre y correo", icon: UserRound, account: true },
  { href: "/ajustes/direcciones", label: "Direcciones", text: "Lugares de entrega", icon: MapPin, account: true },
  { href: "/ajustes/seguridad", label: "Seguridad", text: "Contraseña y sesiones", icon: ShieldCheck, account: true },
  { href: "/ajustes/preferencias", label: "Preferencias", text: "Tema y notificaciones", icon: Palette },
  { href: "/ajustes/datos", label: "Mis datos", text: "Descargar o eliminar", icon: Database, account: true },
  { href: "/ajustes/ayuda", label: "Ayuda", text: "Preguntas y comentarios", icon: CircleHelp },
];

const item = "group flex min-h-11 items-center gap-3 rounded-full px-4 text-[13.5px] font-semibold transition-colors duration-300 ease-fluido focus-visible:outline-2 focus-visible:outline-hoja lg:rounded-2xl lg:px-3 lg:py-2.5";
const idle = "bg-superficie text-tinta ring-1 ring-selva/[0.06] hover:bg-menta/60 lg:bg-transparent lg:ring-0";

/**
 * Menú de «Ajustes»: columna fija con ícono y descripción en pantallas anchas; en móvil, pestañas que se deslizan. Con sesión
 * cierra con «Mis pedidos» y «Cerrar sesión»; sin sesión, con «Ingresar».
 */
export function AccountNav({ signedIn, signOut }: { signedIn: boolean; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  const visible = sections.filter((section) => signedIn || !section.account);
  return (
    <nav aria-label="Secciones de ajustes" className="lg:sticky lg:top-28">
      <ul className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-[1.75rem] lg:bg-superficie lg:p-2 lg:shadow-[0_18px_40px_-30px_rgb(6_54_42/0.45)] lg:ring-1 lg:ring-selva/[0.05] [&::-webkit-scrollbar]:hidden">
        {visible.map((section) => {
          const active = pathname === section.href;
          return (
            <li key={section.href} className="shrink-0">
              <Link href={section.href} aria-current={active ? "page" : undefined} className={cn(item, active ? "bg-selva text-sobre-acento" : idle)}>
                <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center lg:size-9 lg:rounded-xl", active ? "lg:bg-sobre-acento/15" : "text-hoja lg:bg-menta/70")}>
                  {createElement(section.icon, { className: "size-4 lg:size-[18px]" })}
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap">{section.label}</span>
                  <span className={cn("hidden text-[11.5px] font-medium lg:block", active ? "text-sobre-acento/75" : "text-tinta-suave")}>{section.text}</span>
                </span>
              </Link>
            </li>
          );
        })}
        <li aria-hidden="true" className="mx-3 my-1 hidden h-px bg-borde lg:block" />
        {signedIn ? (
          <>
            <li className="shrink-0">
              <Link href="/pedidos" className={cn(item, idle)}>
                <span aria-hidden="true" className="flex shrink-0 items-center justify-center text-hoja lg:size-9 lg:rounded-xl lg:bg-menta/70">
                  <Package className="size-4 lg:size-[18px]" />
                </span>
                <span className="whitespace-nowrap">Mis pedidos</span>
              </Link>
            </li>
            <li className="shrink-0">
              <form action={signOut}>
                <button type="submit" className={cn(item, "w-full bg-superficie text-rojo ring-1 ring-selva/[0.06] hover:bg-rosa lg:bg-transparent lg:ring-0")}>
                  <span aria-hidden="true" className="flex shrink-0 items-center justify-center lg:size-9 lg:rounded-xl lg:bg-rosa">
                    <LogOut className="size-4 lg:size-[18px]" />
                  </span>
                  <span className="whitespace-nowrap">Cerrar sesión</span>
                </button>
              </form>
            </li>
          </>
        ) : (
          <li className="shrink-0">
            <Link href={`/ingresar?next=${encodeURIComponent("/ajustes")}`} className={cn(item, idle)}>
              <span aria-hidden="true" className="flex shrink-0 items-center justify-center text-hoja lg:size-9 lg:rounded-xl lg:bg-menta/70">
                <LogIn className="size-4 lg:size-[18px]" />
              </span>
              <span className="whitespace-nowrap">Ingresar</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
