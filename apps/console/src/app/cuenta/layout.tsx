import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { requireAnyConsoleSession } from "@/lib/guard";
import { comercioNav, adminNav, operationsNav } from "@/lib/nav";

export default async function CuentaLayout({ children }: { children: ReactNode }) {
  const session = await requireAnyConsoleSession();
  const nav = session.area === "admin" ? adminNav : session.area === "operations" ? operationsNav : comercioNav;
  return (
    <Shell nav={nav} email={session.email} role={session.role}>
      {children}
    </Shell>
  );
}
