import { getSessionInfo } from "@rapitrip/supabase";
import { Alert, Card } from "@rapitrip/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { GoogleButton } from "@/components/google-button";
import { googleEnabled } from "@/lib/google";
import { OrDivider } from "@/components/or-divider";
import { safeNext } from "@/lib/safe-next";
import { serverSupabase } from "@/lib/supabase";
import { LoginForm } from "./login-form";

export const metadata = { title: "Ingresar" };

type Params = Promise<{ next?: string; expirada?: string; error?: string; confirmado?: string }>;

export default async function IngresarPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const session = await getSessionInfo(await serverSupabase());
  if (session.signedIn && !params.expirada) redirect(next);

  return (
    <AuthShell>
      <Card className="flex flex-col gap-4 p-6 sm:p-8">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Ingresar</h1>
          <p className="mt-1 text-[13.5px] text-tinta-suave">Entra para ver tu perfil y afiliar tu comercio.</p>
        </div>
        {params.expirada ? <Alert tone="warning">Tu sesión venció por seguridad. Ingresa de nuevo y seguimos donde ibas.</Alert> : null}
        {params.error ? <Alert tone="error">El enlace no es válido o ya venció. Vuelve a intentarlo.</Alert> : null}
        {googleEnabled() ? (
          <>
            <GoogleButton next={next} />
            <OrDivider />
          </>
        ) : null}
        <LoginForm next={next} />
        <p className="text-center text-[13px] text-tinta-suave">
          ¿Primera vez?{" "}
          <Link href={`/registro${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-hoja underline-offset-2 hover:underline">
            Crea tu cuenta
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
