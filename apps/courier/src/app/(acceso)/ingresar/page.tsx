import { Alert, Card } from "@rapitrip/ui";
import { redirect } from "next/navigation";
import { AccessShell } from "@/components/access-shell";
import { claimsHaveCourierRole } from "@/lib/claims";
import { serverSupabase } from "@/lib/supabase";
import { LoginForm } from "./login-form";

export const metadata = { title: "Ingresar" };

type Params = Promise<{ invitacion?: string; "sin-acceso"?: string; expirada?: string }>;

export default async function IngresarPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (claims && claimsHaveCourierRole(claims) && !params.expirada) redirect("/");

  return (
    <AccessShell>
      <Card className="flex flex-col gap-4 p-6">
        <div>
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-tinta">Ingresar</h1>
          <p className="mt-1 text-[13.5px] text-tinta-suave">Entra para ver tus propuestas y tus pedidos.</p>
        </div>
        {params.invitacion === "ok" ? <Alert tone="info">Tu acceso está listo. Ingresa con tu correo y tu contraseña.</Alert> : null}
        {params["sin-acceso"] ? <Alert tone="warning">Esta cuenta no tiene acceso de repartidor. Pide a coordinación que te invite.</Alert> : null}
        {params.expirada ? <Alert tone="warning">Tu sesión venció. Ingresa de nuevo.</Alert> : null}
        <LoginForm />
        <p className="text-[12.5px] text-tinta-suave">¿Olvidaste tu contraseña? Pide a coordinación que te envíe una invitación nueva.</p>
      </Card>
    </AccessShell>
  );
}
