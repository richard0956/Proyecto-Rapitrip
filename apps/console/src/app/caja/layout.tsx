import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { cajaNav } from "@/lib/nav";
import { displayName } from "@/lib/profile";

export default async function CajaLayout({ children }: { children: ReactNode }) {
  const session = await requireConsoleAccess("caja");
  return (
    <Shell nav={cajaNav} name={await displayName()} role={session.role}>
      {children}
    </Shell>
  );
}
