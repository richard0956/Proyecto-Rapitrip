import { buttonStyles, Card } from "@rapitrip/ui";
import Link from "next/link";

export default function SesionExpirada() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="font-titulo text-3xl text-selva">Sesión expirada</h1>
        <p className="mb-6 mt-2 text-tinta-suave">Cerramos tu sesión por inactividad para proteger tu cuenta.</p>
        <Link href="/login" className={buttonStyles({ variant: "primary" })}>
          Volver a ingresar
        </Link>
      </Card>
    </main>
  );
}
