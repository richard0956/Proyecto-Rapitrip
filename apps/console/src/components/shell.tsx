import type { AppRole } from "@rapitrip/validation";
import { Avatar } from "@rapitrip/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/lib/actions";
import { roleLabel } from "@/lib/format";
import type { NavSection } from "@/lib/nav";
import { SESSION_INACTIVITY_MINUTES } from "@/lib/session-config";
import { SessionActivity } from "./session-activity";
import { Sidebar } from "./sidebar";

export async function Shell({ nav, name, role, children }: { nav: NavSection[]; name: string | null; role: AppRole | null; children: ReactNode }) {
  const sections = nav
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.roles || (role !== null && item.roles.includes(role))) }))
    .filter((section) => section.items.length > 0);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <SessionActivity />
      <Sidebar sections={sections} name={name} roleLabel={role ? (roleLabel[role] ?? role) : ""} sessionMinutes={SESSION_INACTIVITY_MINUTES} signOut={signOut} />
      <div className="relative">
        <Link href="/cuenta" className="absolute right-4 top-6 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja sm:right-8 lg:top-7">
          <Avatar name={name} />
          <span className="sr-only">Ir a mi cuenta</span>
        </Link>
        <main className="mx-auto w-full max-w-[1176px] px-4 pb-10 pt-6 sm:px-8 lg:pt-7">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4 pr-14">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight text-tinta">{title}</h1>
        {description ? <p className="mt-1 max-w-[62ch] text-[13.5px] text-tinta-suave">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
