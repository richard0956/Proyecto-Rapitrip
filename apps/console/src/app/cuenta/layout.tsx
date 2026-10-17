import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { requireAnyConsoleSession } from "@/lib/guard";
import { adminNav, cajaNav, comercioNav, coordinacionNav } from "@/lib/nav";
import { displayName } from "@/lib/profile";

export default async function CuentaLayout({ children }: { children: ReactNode }) {
  const session = await requireAnyConsoleSession();
  const nav = { admin: adminNav, caja: cajaNav, coordinacion: coordinacionNav, comercio: comercioNav }[session.area];
  return (
    <Shell nav={nav} name={await displayName()} role={session.role}>
      {children}
    </Shell>
  );
}
