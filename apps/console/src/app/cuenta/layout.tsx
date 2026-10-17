import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { requireAnyConsoleSession } from "@/lib/guard";
import { adminNav, comercioNav, operationsNav } from "@/lib/nav";
import { displayName } from "@/lib/profile";

export default async function CuentaLayout({ children }: { children: ReactNode }) {
  const session = await requireAnyConsoleSession();
  const nav = session.area === "admin" ? adminNav : session.area === "operations" ? operationsNav : comercioNav;
  return (
    <Shell nav={nav} name={await displayName()} role={session.role}>
      {children}
    </Shell>
  );
}
