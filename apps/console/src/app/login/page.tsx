import { getSessionInfo, homePathForRole } from "@rapitrip/supabase";
import { Alert, Card } from "@rapitrip/ui";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ invitacion?: string }> }) {
  const { invitacion } = await searchParams;
  const session = await getSessionInfo(await serverSupabase());
  if (session.signedIn && session.aal === "aal2") redirect(homePathForRole(session.role));

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="font-titulo text-3xl text-selva">Rapitrip · Consola</h1>
        <p className="mb-6 mt-1 text-tinta-suave">Ingresa con tu cuenta del equipo.</p>
        {invitacion === "ok" ? <Alert className="mb-4">Tu acceso está listo. Ingresa con tu correo y contraseña.</Alert> : null}
        <LoginForm />
      </Card>
    </main>
  );
}
