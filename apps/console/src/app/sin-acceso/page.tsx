import { Button, Card } from "@rapitrip/ui";
import { signOut } from "@/lib/actions";

export default function SinAcceso() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="font-titulo text-3xl text-selva">Cuenta sin acceso</h1>
        <p className="mb-6 mt-2 text-tinta-suave">Tu cuenta no tiene permiso para usar la consola o fue suspendida. Si crees que es un error, contacta a un administrador.</p>
        <form action={signOut}>
          <Button variant="secondary" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </Card>
    </main>
  );
}
