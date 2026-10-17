import { getSessionInfo, homePathForRole, isConsoleRole } from "@rapitrip/supabase";
import { Card } from "@rapitrip/ui";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase";
import { MfaForm } from "./mfa-form";

export default async function MfaPage() {
  const session = await getSessionInfo(await serverSupabase());
  if (!session.signedIn) redirect("/login");
  if (session.aal === "aal2") redirect(homePathForRole(session.role));
  // Solo los roles de consola enrolan o verifican un segundo factor aquí.
  if (!isConsoleRole(session.role)) redirect("/sin-acceso");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="font-titulo text-3xl text-selva">Verificación en dos pasos</h1>
        <MfaForm />
      </Card>
    </main>
  );
}
