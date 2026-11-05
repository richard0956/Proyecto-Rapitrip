import { Button } from "@rapitrip/ui";
import { Clock, KeyRound, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { requireAnyConsoleSession } from "@/lib/guard";
import { SESSION_INACTIVITY_MINUTES } from "@/lib/session-config";
import { serverSupabase } from "@/lib/supabase";
import { AccountNav } from "../account-nav";
import { changePassword, reauthenticateForPassword, signOutEverywhere } from "../actions";
import { SectionCard } from "../section-card";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Seguridad" };

/**
 * Seguridad de la cuenta. La contraseña solo la cambian dirección y administración; el resto del equipo la tiene por invitación y
 * se la restablece la administración. El segundo factor y las sesiones aplican a todos.
 */
export default async function SeguridadPage() {
  const session = await requireAnyConsoleSession();
  const canChangePassword = session.area === "admin";
  const supabase = await serverSupabase();
  const { data: profile } = await supabase.from("my_profile").select("last_sign_in_at").maybeSingle();

  return (
    <>
      <PageHeader title="Mi cuenta" description="Tu perfil, la seguridad de tu acceso, tus preferencias y la ayuda de tu rol." />
      <AccountNav />
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        <SectionCard outerClassName="h-full" icon={<KeyRound className="size-[18px]" />} title="Contraseña" text={canChangePassword ? "Cámbiala si crees que alguien más la conoce. Pedimos un código al correo si tu ingreso no es reciente." : "Tu acceso se creó con una invitación de la administración."}>
          {canChangePassword ? (
            <PasswordForm actions={{ change: changePassword, sendCode: reauthenticateForPassword }} />
          ) : (
            <div className="rounded-panel bg-crema/70 p-4 ring-1 ring-borde">
              <p className="text-sm font-bold text-tinta">La contraseña la gestiona la administración</p>
              <p className="mt-1 text-[12.5px] leading-snug text-tinta-suave">
                Si la olvidaste o crees que alguien más la conoce, avísale a la administración para que restablezca tu acceso. También puedes reportarlo como incidente de seguridad en «Reportar incidente».
              </p>
            </div>
          )}
        </SectionCard>

        <div className="flex flex-col gap-5">
          <SectionCard icon={<Smartphone className="size-[18px]" />} tone="lavanda" title="Segundo factor" text="Cada ingreso pide el código de tu aplicación de autenticación.">
            <div className="flex items-start gap-3 rounded-panel bg-menta/50 p-4 ring-1 ring-menta-borde">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-hoja" />
              <div>
                <p className="text-sm font-bold text-tinta">Activado</p>
                <p className="text-[12.5px] leading-snug text-tinta-suave">Si cambiaste de teléfono o perdiste la aplicación, pide a la administración que lo restablezca; lo volverás a enrolar al ingresar.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard outerClassName="flex-1" icon={<Clock className="size-[18px]" />} tone="durazno" title="Sesiones" text="Dónde está abierta tu cuenta.">
            <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              <dt className="text-tinta-suave">Último ingreso</dt>
              <dd className="font-semibold text-tinta">{formatDateTime(profile?.last_sign_in_at)}</dd>
              <dt className="text-tinta-suave">Cierre automático</dt>
              <dd className="font-semibold text-tinta">A los {SESSION_INACTIVITY_MINUTES} min sin actividad</dd>
            </dl>
            <form action={signOutEverywhere}>
              <Button variant="secondary" type="submit" className="w-full">
                <LogOut aria-hidden="true" className="size-4" />
                Cerrar sesión en todos los dispositivos
              </Button>
            </form>
            <p className="mt-2 text-[12px] text-tinta-suave">Úsalo si ingresaste en una computadora que no es tuya. También cierra esta sesión.</p>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
