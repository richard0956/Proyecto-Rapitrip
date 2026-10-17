import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { adminNav } from "@/lib/nav";
import { displayName } from "@/lib/profile";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireConsoleAccess("admin");
  return (
    <Shell nav={adminNav} name={await displayName()} role={session.role}>
      {children}
    </Shell>
  );
}
