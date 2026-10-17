import { Alert, buttonStyles, Card } from "@rapitrip/ui";
import Link from "next/link";
import { AcceptForm } from "./accept-form";

export default async function AceptarInvitacion({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const plausible = value.length >= 40 && value.length <= 64;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="font-titulo text-3xl text-selva">Crea tu acceso</h1>
        {plausible ? (
          <>
            <p className="mb-6 mt-1 text-tinta-suave">Te invitaron a la consola de Rapitrip. Elige tu nombre y una contraseña.</p>
            <AcceptForm token={value} />
          </>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <Alert tone="error">El enlace de invitación no es válido. Pide una nueva a un administrador.</Alert>
            <Link href="/login" className={buttonStyles({ variant: "secondary" })}>
              Ir a ingresar
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}
