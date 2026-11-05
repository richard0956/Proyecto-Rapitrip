import { PageHeader } from "@/components/shell";
import { itPolicyManual } from "@/content/it-policies";
import { roleLabel } from "@/lib/format";
import { requireAnyConsoleSession } from "@/lib/guard";
import { AccountNav } from "../account-nav";
import { PolicyManual } from "./policy-manual";

export const metadata = { title: "Políticas de TI" };

/** El Manual de Políticas de TI de Rapitrip, con lo que le toca al rol de quien está en sesión marcado como «Te aplica». */
export default async function PoliticasPage() {
  const session = await requireAnyConsoleSession();
  const label = session.role === "superadmin" ? "la dirección" : (roleLabel[session.role ?? ""] ?? "tu rol").toLowerCase();

  return (
    <>
      <PageHeader title="Mi cuenta" description="Tu perfil, la seguridad de tu acceso, tus preferencias y la ayuda de tu rol." />
      <AccountNav />
      <PolicyManual manual={itPolicyManual} area={session.area} roleLabel={label} />
    </>
  );
}
