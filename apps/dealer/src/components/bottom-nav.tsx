"use client";

import { cn } from "@rapitrip/ui";
import { History, House, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Inicio", Icon: House },
  { href: "/historial", label: "Historial", Icon: History },
  { href: "/perfil", label: "Perfil", Icon: UserRound },
] as const;

/**
 * Isla flotante al alcance del pulgar, igual que la navegación de la tienda: una píldora de cristal separada del borde.
 * Respeta el margen seguro de los teléfonos sin botón de inicio.
 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <ul className="pointer-events-auto mx-auto flex max-w-[380px] gap-1 rounded-full bg-papel/85 p-1.5 shadow-flota ring-1 ring-selva/[0.07] backdrop-blur-xl">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" || pathname.startsWith("/pedidos") : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11.5px] font-bold transition-[background-color,color,transform] duration-500 ease-fluido active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja",
                  active ? "bg-hoja text-white shadow-pulsa" : "text-tinta-suave hover:bg-menta/70",
                )}
              >
                <Icon className="size-[22px]" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
