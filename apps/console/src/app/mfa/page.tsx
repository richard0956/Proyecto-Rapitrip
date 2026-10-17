import { getSessionInfo, homePathForRole, isConsoleRole } from "@rapitrip/supabase";
import { Card } from "@rapitrip/ui";
import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { serverSupabase } from "@/lib/supabase";
import { MfaForm } from "./mfa-form";

export const metadata = { title: "Verificación en dos pasos" };

export default async function MfaPage() {
  const session = await getSessionInfo(await serverSupabase());
  if (!session.signedIn) redirect("/login");
  if (session.aal === "aal2") redirect(homePathForRole(session.role));
  // Solo los roles de consola enrolan o verifican un segundo factor aquí.
  if (!isConsoleRole(session.role)) redirect("/sin-acceso");

  return (
    <AuthShell>
      <Card className="p-8">
        <span aria-hidden="true" className="mb-4 flex size-[52px] items-center justify-center rounded-boton bg-durazno text-durazno-texto">
          <KeyRound className="size-6" />
        </span>
        <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Verificación en dos pasos</h1>
        <MfaForm />
      </Card>
    </AuthShell>
  );
}
