import type { ConsoleArea } from "@rapitrip/supabase";
import { Card } from "@rapitrip/ui";
import { requireConsoleAccess } from "@/lib/guard";
import { comercioNav, operationsNav } from "@/lib/nav";
import { PageHeader, Shell } from "./shell";

const titles = { operations: "Operaciones", comercio: "Mi comercio" } as const;

/** Inicio provisional de las áreas cuyas pantallas llegan en fases posteriores (F3 a F6). */
export async function AreaHome({ area }: { area: Exclude<ConsoleArea, "admin"> }) {
  const session = await requireConsoleAccess(area);
  return (
    <Shell nav={area === "operations" ? operationsNav : comercioNav} email={session.email} role={session.role}>
      <PageHeader title={titles[area]} />
      <Card>
        <p className="text-tinta">Las pantallas de esta área se construyen en las siguientes fases.</p>
      </Card>
    </Shell>
  );
}
