import { getSessionInfo } from "@rapitrip/supabase";
import { Card } from "@rapitrip/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { GoogleButton } from "@/components/google-button";
import { googleEnabled } from "@/lib/google";
import { OrDivider } from "@/components/or-divider";
import { safeNext } from "@/lib/safe-next";
import { serverSupabase } from "@/lib/supabase";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Crear cuenta" };

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const session = await getSessionInfo(await serverSupabase());
  if (session.signedIn) redirect(next);

  return (
    <AuthShell>
      <Card className="flex flex-col gap-4 p-6 sm:p-8">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Crear cuenta</h1>
          <p className="mt-1 text-[13.5px] text-tinta-suave">Te toma un minuto. Confirmamos tu correo para proteger tu cuenta.</p>
        </div>
        {googleEnabled() ? (
          <>
            <GoogleButton next={next} />
            <OrDivider />
          </>
        ) : null}
        <SignupForm next={next} />
        <p className="text-center text-[13px] text-tinta-suave">
          ¿Ya tienes cuenta?{" "}
          <Link href={`/ingresar${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-hoja underline-offset-2 hover:underline">
            Ingresa
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
