import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { coordinacionNav } from "@/lib/nav";
import { displayName } from "@/lib/profile";

export default async function CoordinacionLayout({ children }: { children: ReactNode }) {
  const session = await requireConsoleAccess("coordinacion");
  return (
    <Shell nav={coordinacionNav} name={await displayName()} role={session.role}>
      {children}
    </Shell>
  );
}
