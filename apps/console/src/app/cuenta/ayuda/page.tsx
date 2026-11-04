import { PageHeader } from "@/components/shell";
import { requireAnyConsoleSession } from "@/lib/guard";
import { helpFor } from "@/lib/help";
import { AccountNav } from "../account-nav";
import { HelpManual } from "./help-manual";

export const metadata = { title: "Ayuda" };

/** Manual de funciones según el rol de quien está en sesión: cada área ve solo lo que puede hacer. */
export default async function AyudaPage() {
  const session = await requireAnyConsoleSession();
  const guide = helpFor(session.area, session.role === "superadmin");

  return (
    <>
      <PageHeader title="Mi cuenta" description="Tu perfil, la seguridad de tu acceso, tus preferencias y la ayuda de tu rol." />
      <AccountNav />
      <HelpManual guide={guide} />
    </>
  );
}
