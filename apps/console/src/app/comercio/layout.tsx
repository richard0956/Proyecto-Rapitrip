import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { comercioNav } from "@/lib/nav";
import { displayName } from "@/lib/profile";

export default async function ComercioLayout({ children }: { children: ReactNode }) {
  const session = await requireConsoleAccess("comercio");
  return (
    <Shell nav={comercioNav} name={await displayName()} role={session.role}>
      {children}
    </Shell>
  );
}
