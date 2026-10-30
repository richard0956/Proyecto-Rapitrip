import { Alert } from "@rapitrip/ui";
import { KeyRound, Mail, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { signOut } from "@/lib/actions";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { SectionCard } from "../section-card";
import { changePassword, reauthenticateForPassword, signOutEverywhere } from "./actions";
import { PasswordForm } from "./password-form";
import { SessionsCard } from "./sessions-card";

export const metadata = { title: "Seguridad" };

/** Logo de Google en sus colores (las marcas no se dibujan con el ícono genérico). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

/** Seguridad: cambiar la contraseña, ver con qué se ingresa (correo o Google) y cerrar sesiones. */
export default async function SeguridadPage({ searchParams }: { searchParams: Promise<{ clave?: string }> }) {
  const { clave } = await searchParams;
  await requireCustomer("/ajustes/seguridad");
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  const providers = new Set((data.user?.identities ?? []).map((identity) => identity.provider));
  const hasGoogle = providers.has("google");
  const hasPassword = providers.has("email");

  return (
    <div className="flex flex-col gap-5">
      {clave === "ok" ? <Alert>Tu contraseña se actualizó.</Alert> : null}

      <SectionCard
        icon={<KeyRound className="size-5" />}
        title={hasPassword ? "Cambiar contraseña" : "Crear una contraseña"}
        text={hasPassword ? "Elige una contraseña nueva para ingresar con tu correo." : "Ingresas con Google; con una contraseña también podrás entrar con tu correo."}
        id="contrasena"
      >
        <PasswordForm actions={{ change: changePassword, sendCode: reauthenticateForPassword }} />
      </SectionCard>

      <SectionCard icon={<ShieldCheck className="size-5" />} title="Formas de ingresar" text="Con qué puedes entrar a tu cuenta." id="ingreso">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li className="flex items-center gap-3 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-superficie text-hoja ring-1 ring-borde">
              <Mail className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-tinta">Correo y contraseña</span>
              <span className="block text-[12.5px] text-tinta-suave">{hasPassword ? "Activo" : "Sin contraseña todavía"}</span>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${hasPassword ? "bg-menta text-exito" : "bg-calido text-durazno-texto"}`}>{hasPassword ? "Activo" : "Pendiente"}</span>
          </li>
          <li className="flex items-center gap-3 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-borde">
              <GoogleMark />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-tinta">Google</span>
              <span className="block text-[12.5px] text-tinta-suave">{hasGoogle ? "Tu cuenta está unida a Google" : "Puedes ingresar con Google usando este mismo correo"}</span>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${hasGoogle ? "bg-menta text-exito" : "bg-crema text-tinta-suave ring-1 ring-borde"}`}>{hasGoogle ? "Unida" : "Sin unir"}</span>
          </li>
        </ul>
      </SectionCard>

      <SectionCard icon={<MonitorSmartphone className="size-5" />} title="Sesiones" text="Dónde está abierta tu cuenta." id="sesiones">
        <SessionsCard signOut={signOut} signOutEverywhere={signOutEverywhere} />
      </SectionCard>
    </div>
  );
}
