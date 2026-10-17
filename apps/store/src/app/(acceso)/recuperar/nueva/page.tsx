import { Card } from "@rapitrip/ui";
import { AuthShell } from "@/components/auth-shell";
import { requireCustomer } from "@/lib/session";
import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Nueva contraseña" };

export default async function NuevaClavePage() {
  await requireCustomer("/recuperar/nueva");
  return (
    <AuthShell>
      <Card className="flex flex-col gap-4 p-6 sm:p-8">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Elige una contraseña nueva</h1>
          <p className="mt-1 text-[13.5px] text-tinta-suave">Úsala la próxima vez que ingreses.</p>
        </div>
        <NewPasswordForm />
      </Card>
    </AuthShell>
  );
}
