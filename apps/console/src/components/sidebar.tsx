"use client";

import { Activity, Banknote, Clock, FileText, House, Layers, ClipboardList, Lock, LogOut, Menu, ReceiptText, ShieldCheck, SlidersHorizontal, Store, TriangleAlert, Truck, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { Avatar, cn } from "@rapitrip/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { accountItem, type NavIcon, type NavItem, type NavSection } from "@/lib/nav";

const icons: Record<NavIcon, LucideIcon> = {
  home: House, users: Users, file: FileText, store: Store, layers: Layers, truck: Truck, settings: SlidersHorizontal, orders: ClipboardList,
  activity: Activity, alert: TriangleAlert, cash: Banknote, receipt: ReceiptText, clock: Clock, shield: ShieldCheck, lock: Lock, user: UserRound,
};

const itemBase = "flex min-h-9 items-center gap-2.5 rounded-campo px-2.5 py-2 text-[13.5px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-menta-borde";

function isActive(pathname: string, item: NavItem) {
  const paths = [item.href, ...(item.also ?? [])];
  return paths.some((path) => pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`)));
}

function NavEntry({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = icons[item.icon];
  const content = (
    <>
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      <span className="min-w-0 flex-1">{item.label}</span>
    </>
  );
  if (item.soon) {
    return (
      <span aria-disabled="true" className={cn(itemBase, "cursor-not-allowed font-medium text-nav-texto/60")}>
        {content}
        <span className="rounded-full bg-durazno px-2.5 py-1 text-[9px] font-bold leading-none text-durazno-texto">Pronto</span>
      </span>
    );
  }
  const active = isActive(pathname, item);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(itemBase, active ? "bg-menta-borde font-bold text-selva" : "font-medium text-nav-texto hover:bg-selva-panel")}>
      {content}
    </Link>
  );
}

type Props = {
  sections: NavSection[];
  name: string | null;
  roleLabel: string;
  sessionMinutes: number;
  signOut: () => Promise<void>;
};

/** Barra lateral de 264 px en escritorio; por debajo de 1024 px pasa a un cajón que se abre con un botón. */
export function Sidebar({ sections, name, roleLabel, sessionMinutes, signOut }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <header className="flex items-center justify-between bg-selva px-4 py-3 lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="menu-principal"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="flex size-11 items-center justify-center rounded-campo text-white hover:bg-selva-panel focus-visible:outline-2 focus-visible:outline-menta-borde"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      <aside
        id="menu-principal"
        className={cn(
          "flex-col gap-[3px] overflow-y-auto bg-selva px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh",
          open ? "fixed inset-x-0 bottom-0 top-[68px] z-40 flex" : "hidden",
        )}
      >
        <Logo className="mb-3.5 hidden lg:flex" />
        <div className="flex items-center gap-2.5 rounded-panel bg-selva-panel px-3 py-2.5">
          <Avatar name={name} tone="dark" size="sm" />
          <div className="min-w-0 leading-[1.4]">
            <p className="truncate text-[13px] font-bold text-white">{name ?? "Mi cuenta"}</p>
            <p className="truncate text-[11px] text-menta-borde">{roleLabel}</p>
          </div>
        </div>
        {sections.map((section, index) => (
          <nav key={section.label ?? index} aria-label={section.label ?? "Principal"} className="flex flex-col gap-[3px]">
            {section.label ? <p className="px-2.5 pb-1 pt-3.5 text-micro font-bold uppercase tracking-[0.08em] text-menta-borde">{section.label}</p> : <div className="h-3" />}
            {section.items.map((item) => (
              <NavEntry key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
        ))}
        <div className="mt-auto flex flex-col gap-[3px] pt-6">
          <NavEntry item={accountItem} pathname={pathname} />
          <form action={signOut}>
            <button type="submit" className={cn(itemBase, "w-full font-medium text-nav-texto hover:bg-selva-panel")}>
              <LogOut aria-hidden="true" className="size-[18px] shrink-0" />
              Cerrar sesión
            </button>
          </form>
          <p className="px-2.5 pt-2.5 text-micro text-menta-borde">La sesión se cierra a los {sessionMinutes} min sin actividad</p>
        </div>
      </aside>
    </>
  );
}
