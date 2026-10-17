import { buttonStyles, Card } from "@rapitrip/ui";
import { Clock } from "lucide-react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Sesión expirada" };

export default function SesionExpirada() {
  return (
    <AuthShell>
      <Card className="p-8">
        <span aria-hidden="true" className="mb-4 flex size-[52px] items-center justify-center rounded-boton bg-durazno text-durazno-texto">
          <Clock className="size-6" />
        </span>
        <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Sesión expirada</h1>
        <p className="mb-6 mt-2 text-[13.5px] text-tinta-suave">Cerramos tu sesión por inactividad para proteger tu cuenta.</p>
        <Link href="/login" className={buttonStyles({ variant: "primary", className: "w-full" })}>
          Volver a ingresar
        </Link>
      </Card>
    </AuthShell>
  );
}
