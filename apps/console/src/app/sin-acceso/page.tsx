import { Button, Card } from "@rapitrip/ui";
import { LockKeyhole } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { signOut } from "@/lib/actions";

export const metadata = { title: "Cuenta sin acceso" };

export default function SinAcceso() {
  return (
    <AuthShell>
      <Card className="p-8">
        <span aria-hidden="true" className="mb-4 flex size-[52px] items-center justify-center rounded-boton bg-rosa text-rojo">
          <LockKeyhole className="size-6" />
        </span>
        <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Cuenta sin acceso</h1>
        <p className="mb-6 mt-2 text-[13.5px] text-tinta-suave">Tu cuenta no tiene permiso para usar la consola o fue suspendida. Si crees que es un error, contacta a un administrador.</p>
        <form action={signOut}>
          <Button variant="primary" type="submit" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </Card>
    </AuthShell>
  );
}
