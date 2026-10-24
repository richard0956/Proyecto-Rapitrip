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

/** Barra inferior al alcance del pulgar. Respeta el margen seguro de los teléfonos sin botón de inicio. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-papel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-[640px]">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" || pathname.startsWith("/pedidos") : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11.5px] font-bold focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-hoja",
                  active ? "text-hoja" : "text-tinta-suave",
                )}
              >
                <Icon className="size-[22px]" aria-hidden="true" strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
