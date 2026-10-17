import { Card } from "@rapitrip/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { RecoverForm } from "./recover-form";

export const metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <AuthShell>
      <Card className="flex flex-col gap-4 p-6 sm:p-8">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Recuperar contraseña</h1>
          <p className="mt-1 text-[13.5px] text-tinta-suave">Escribe tu correo y te enviamos un enlace para elegir una contraseña nueva.</p>
        </div>
        <RecoverForm />
        <Link href="/ingresar" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-hoja underline-offset-2 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a ingresar
        </Link>
      </Card>
    </AuthShell>
  );
}
