import type { ConsoleArea } from "@rapitrip/supabase";
import { Alert } from "@rapitrip/ui";
import { requireConsoleAccess } from "@/lib/guard";
import { cajaNav, comercioNav, coordinacionNav } from "@/lib/nav";
import { displayName } from "@/lib/profile";
import { PageHeader, Shell } from "./shell";

const titles = { caja: "Caja", coordinacion: "Coordinación", comercio: "Mi comercio" } as const;
const navs = { caja: cajaNav, coordinacion: coordinacionNav, comercio: comercioNav } as const;

/** Inicio provisional de las áreas cuyas pantallas llegan en fases posteriores (F3 a F6). */
export async function AreaHome({ area }: { area: Exclude<ConsoleArea, "admin"> }) {
  const session = await requireConsoleAccess(area);
  return (
    <Shell nav={navs[area]} name={await displayName()} role={session.role}>
      <PageHeader title={titles[area]} description="Las pantallas de esta área se construyen en las siguientes fases." />
      <Alert tone="warning">Aquí vivirán las herramientas de tu área.</Alert>
    </Shell>
  );
}
