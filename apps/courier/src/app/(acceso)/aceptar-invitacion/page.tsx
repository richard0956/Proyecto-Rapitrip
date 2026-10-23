import { Alert, buttonStyles, Card } from "@rapitrip/ui";
import Link from "next/link";
import { AccessShell } from "@/components/access-shell";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Crea tu acceso" };

export default async function AceptarInvitacion({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const plausible = value.length >= 40 && value.length <= 64;

  return (
    <AccessShell>
      <Card className="flex flex-col gap-4 p-6">
        <div>
          <h1 className="text-[24px] font-extrabold leading-tight text-tinta">Crea tu acceso</h1>
          {plausible ? <p className="mt-1 text-[13.5px] text-tinta-suave">Te invitaron como repartidor de Rapitrip. Elige tu nombre y una contraseña.</p> : null}
        </div>
        {plausible ? (
          <AcceptForm token={value} />
        ) : (
          <>
            <Alert tone="error">El enlace de invitación no es válido. Pide uno nuevo a coordinación.</Alert>
            <Link href="/ingresar" className={buttonStyles({ variant: "primary" })}>
              Ir a ingresar
            </Link>
          </>
        )}
      </Card>
    </AccessShell>
  );
}
