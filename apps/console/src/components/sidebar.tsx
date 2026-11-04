"use client";

import { Activity, Banknote, Clock, FileText, House, Layers, ClipboardList, Lock, LogOut, Menu, ReceiptText, ShieldCheck, SlidersHorizontal, Sparkle, Store, TriangleAlert, Truck, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { cn, Logo } from "@rapitrip/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { accountItem, type NavIcon, type NavItem, type NavSection } from "@/lib/nav";
import { ProfilePhoto } from "./profile-photo";

const icons: Record<NavIcon, LucideIcon> = {
  home: House, users: Users, file: FileText, store: Store, layers: Layers, truck: Truck, settings: SlidersHorizontal, orders: ClipboardList,
  activity: Activity, alert: TriangleAlert, cash: Banknote, receipt: ReceiptText, clock: Clock, shield: ShieldCheck, lock: Lock, user: UserRound,
};

const itemBase = "flex min-h-9 items-center gap-2.5 rounded-campo px-2.5 py-2 text-[13.5px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-menta-borde";

// `exact` solo limita la ruta propia del ítem; las de `also` marcan el ítem también en sus subrutas (por ejemplo, la ficha de un pedido).
function isActive(pathname: string, item: NavItem) {
  const own = pathname === item.href || (!item.exact && item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
  return own || (item.also ?? []).some((path) => pathname === path || pathname.startsWith(`${path}/`));
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
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(itemBase, active ? "bg-esmeralda font-bold text-selva shadow-[0_8px_20px_-10px_rgb(36_192_142/0.7)]" : "font-medium text-nav-texto hover:bg-white/10")}>
      {content}
    </Link>
  );
}

type Props = {
  sections: NavSection[];
  name: string | null;
  /** Enlace firmado de la foto de perfil; sin foto se ven las iniciales. */
  photo?: string | null;
  roleLabel: string;
  sessionMinutes: number;
  signOut: () => Promise<void>;
};

/** Barra lateral de 264 px en escritorio; por debajo de 1024 px pasa a un cajón que se abre con un botón. */
export function Sidebar({ sections, name, photo = null, roleLabel, sessionMinutes, signOut }: Props) {
  const pathname = usePathname();
  // El cajón se abre para una ruta concreta: al navegar deja de coincidir y se cierra solo, sin efectos.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  return (
    <>
      <header className="flex items-center justify-between bg-selva px-4 py-3 lg:hidden">
        <Logo tone="dark" subtitle="Consola de operación" priority />
        <button
          type="button"
          onClick={() => setOpenFor(open ? null : pathname)}
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
          // El mismo panel verde de la tienda y del repartidor: se aclara hacia abajo, con un brillo esmeralda arriba y uno marino abajo.
          // Los brillos van en el fondo y no como elementos, para no agrandar el área con desplazamiento.
          "relative flex-col gap-[3px] overflow-y-auto bg-[radial-gradient(18rem_18rem_at_115%_-4%,rgb(36_192_142/0.22),transparent_70%),radial-gradient(20rem_20rem_at_-20%_104%,rgb(12_78_103/0.55),transparent_70%),linear-gradient(180deg,var(--panel)_0%,#0d5644_58%,#14705a_100%)] px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh",
          open ? "fixed inset-x-0 bottom-0 top-[68px] z-40 flex" : "hidden",
        )}
      >
        <Sparkle aria-hidden="true" className="absolute right-6 top-7 hidden size-4 fill-esmeralda text-esmeralda lg:block" />
        <Sparkle aria-hidden="true" className="absolute right-12 top-12 hidden size-2.5 fill-esmeralda/70 text-esmeralda/70 lg:block" />
        <Logo tone="dark" subtitle="Consola de operación" priority className="mb-4 hidden lg:flex" />
        <div className="flex items-center gap-2.5 rounded-panel bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/10">
          <ProfilePhoto name={name} src={photo} tone="dark" className="size-9 text-xs" />
          <div className="min-w-0 leading-[1.4]">
            <p className="truncate text-[13px] font-bold text-white">{name ?? "Mi cuenta"}</p>
            <p className="truncate text-[11px] text-bruma">{roleLabel}</p>
          </div>
        </div>
        {sections.map((section, index) => (
          <nav key={section.label ?? index} aria-label={section.label ?? "Principal"} className="flex flex-col gap-[3px]">
            {section.label ? <p className="px-2.5 pb-1 pt-3.5 text-micro font-bold uppercase tracking-[0.08em] text-bruma">{section.label}</p> : <div className="h-3" />}
            {section.items.map((item) => (
              <NavEntry key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
        ))}
        <div className="mt-auto flex flex-col gap-[3px] pt-6">
          <NavEntry item={accountItem} pathname={pathname} />
          <form action={signOut}>
            <button type="submit" className={cn(itemBase, "w-full font-medium text-nav-texto hover:bg-white/10")}>
              <LogOut aria-hidden="true" className="size-[18px] shrink-0" />
              Cerrar sesión
            </button>
          </form>
          {/* Abajo el verde es más claro: `nav-texto` mantiene el contraste que `bruma` ya no alcanza a este tamaño. */}
          <p className="px-2.5 pt-2.5 text-micro text-nav-texto">La sesión se cierra a los {sessionMinutes} min sin actividad</p>
        </div>
      </aside>
    </>
  );
}
