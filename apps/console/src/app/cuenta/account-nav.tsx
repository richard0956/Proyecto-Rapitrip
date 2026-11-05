"use client";

import { cn } from "@rapitrip/ui";
import { BookOpen, KeyRound, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/cuenta", label: "Perfil", icon: UserRound },
  { href: "/cuenta/seguridad", label: "Seguridad", icon: KeyRound },
  { href: "/cuenta/preferencias", label: "Preferencias", icon: SlidersHorizontal },
  { href: "/cuenta/ayuda", label: "Ayuda", icon: BookOpen },
  { href: "/cuenta/politicas", label: "Políticas de TI", icon: ShieldCheck },
] as const;

/** Las secciones de «Mi cuenta», como pestañas arriba de cada una. */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de mi cuenta" className="mb-5 flex flex-wrap gap-2">
      {sections.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-bold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja",
              active ? "bg-hoja text-sobre-acento shadow-pulsa" : "bg-papel text-tinta ring-1 ring-borde hover:bg-menta/60",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
