import { getSessionInfo, homePathForRole } from "@rapitrip/supabase";
import { Alert, Card } from "@rapitrip/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { serverSupabase } from "@/lib/supabase";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ invitacion?: string }> }) {
  const { invitacion } = await searchParams;
  const session = await getSessionInfo(await serverSupabase());
  if (session.signedIn && session.aal === "aal2") redirect(homePathForRole(session.role));

  return (
    <AuthShell>
      <Card className="flex flex-col gap-4 p-7">
        <div>
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-tinta">Iniciar sesión</h1>
          <p className="mt-1 text-[13.5px] text-tinta-suave">Usa el correo con el que recibiste tu invitación.</p>
        </div>
        {invitacion === "ok" ? <Alert>Tu acceso está listo. Ingresa con tu correo y contraseña.</Alert> : null}
        <LoginForm />
        <Alert>El sistema te lleva al área de tu rol: administración, operaciones o comercio.</Alert>
        <p className="text-[12.5px] leading-snug text-tinta-suave">
          Al ingresar aceptas los{" "}
          <Link href="/terminos" className="font-bold text-hoja underline-offset-2 hover:underline">
            Términos de uso
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="font-bold text-hoja underline-offset-2 hover:underline">
            Política de privacidad
          </Link>{" "}
          de la consola.
        </p>
      </Card>
    </AuthShell>
  );
}
