import { getSessionInfo } from "@rapitrip/supabase";
import { Settings, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/lib/actions";
import { avatarUrl } from "@/lib/avatar";
import { serverSupabase } from "@/lib/supabase";
import { AccountNav } from "./account-nav";
import { ProfileAvatar } from "./profile-avatar";

export const metadata = { title: { default: "Ajustes", template: "%s · Ajustes · Rapitrip" }, robots: { index: false } };

const fecha = new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "America/Managua" });

const header = "relative isolate flex items-center gap-4 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,var(--panel)_0%,#0d5644_70%,#14705a_100%)] p-6 text-white dark:bg-[linear-gradient(135deg,#0b1a2e_0%,#0b2236_70%,#0e2c3a_100%)] sm:p-8";

/**
 * «Ajustes» (la rueda del encabezado): con sesión, cabecera del cliente y todas las secciones de la cuenta; sin sesión, solo
 * Preferencias y Ayuda, con la invitación a ingresar. Cada sección de la cuenta pide la sesión por su cuenta.
 */
export default async function AjustesLayout({ children }: { children: ReactNode }) {
  const supabase = await serverSupabase();
  const session = await getSessionInfo(supabase);
  const { data: profile } = session.signedIn ? await supabase.from("my_profile").select("full_name, email, created_at, avatar_path").maybeSingle() : { data: null };
  const signedIn = Boolean(profile);
  const photo = profile ? await avatarUrl(supabase, profile.avatar_path) : null;

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-6">
      {profile ? (
        <header className={header}>
          <div aria-hidden="true" className="absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-esmeralda/20 blur-3xl" />
          <ProfileAvatar name={profile.full_name ?? profile.email} src={photo} className="size-14 text-lg ring-4 ring-white/15 sm:size-16 sm:text-xl" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-esmeralda">
              <Settings aria-hidden="true" className="size-3.5" /> Ajustes
            </p>
            <h1 className="mt-1 truncate text-[22px] font-extrabold leading-tight tracking-tight sm:text-[28px]">{profile.full_name ?? "Cliente de Rapitrip"}</h1>
            <p className="mt-0.5 truncate text-[13px] text-nav-texto">
              {profile.email}
              {profile.created_at ? <span className="hidden sm:inline"> · Cliente desde el {fecha.format(new Date(profile.created_at))}</span> : null}
            </p>
          </div>
        </header>
      ) : (
        <header className={`${header} flex-wrap justify-between`}>
          <div aria-hidden="true" className="absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-esmeralda/20 blur-3xl" />
          <div className="flex min-w-0 items-center gap-4">
            <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-esmeralda ring-4 ring-white/10 sm:size-16">
              <Settings className="size-7" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[22px] font-extrabold leading-tight tracking-tight sm:text-[28px]">Ajustes</h1>
              <p className="mt-0.5 text-[13px] text-nav-texto">Elige cómo se ve la tienda. Ingresa para administrar tu cuenta.</p>
            </div>
          </div>
          <Link href={`/ingresar?next=${encodeURIComponent("/ajustes")}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-esmeralda px-5 text-[13.5px] font-semibold text-panel transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <UserRound aria-hidden="true" className="size-4" />
            Ingresar
          </Link>
        </header>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <AccountNav signedIn={signedIn} signOut={signOut} />
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
