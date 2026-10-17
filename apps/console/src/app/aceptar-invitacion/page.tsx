import { Alert, buttonStyles, Card } from "@rapitrip/ui";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Crea tu acceso" };

export default async function AceptarInvitacion({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const plausible = value.length >= 40 && value.length <= 64;

  return (
    <AuthShell>
      <Card className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Crea tu acceso</h1>
          {plausible ? <p className="mt-1 text-[13.5px] text-tinta-suave">Te invitaron a la consola de Rapitrip. Elige tu nombre y una contraseña.</p> : null}
        </div>
        {plausible ? (
          <AcceptForm token={value} />
        ) : (
          <>
            <Alert tone="error">El enlace de invitación no es válido. Pide una nueva a un administrador.</Alert>
            <Link href="/login" className={buttonStyles({ variant: "primary" })}>
              Ir a ingresar
            </Link>
          </>
        )}
      </Card>
    </AuthShell>
  );
}
