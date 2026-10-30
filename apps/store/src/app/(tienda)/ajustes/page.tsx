import { Alert, buttonStyles } from "@rapitrip/ui";
import { getSessionInfo } from "@rapitrip/supabase";
import { Camera, Mail, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { avatarUrl } from "@/lib/avatar";
import { serverSupabase } from "@/lib/supabase";
import { changeEmail, saveAvatar, updateProfile } from "./actions";
import { AvatarUploader } from "./avatar-uploader";
import { EmailForm } from "./email-form";
import { ProfileForm } from "./profile-form";
import { SectionCard } from "./section-card";

export const metadata = { title: "Perfil" };

/**
 * Portada de Ajustes. Con sesión es el Perfil (foto, nombre y teléfono, correo); sin sesión, Ajustes empieza en Preferencias.
 */
export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ correo?: string }> }) {
  const { correo } = await searchParams;
  const supabase = await serverSupabase();
  const session = await getSessionInfo(supabase);
  if (!session.signedIn) redirect("/ajustes/preferencias");
  const { data: profile } = await supabase.from("my_profile").select("id, full_name, phone, email, avatar_path").maybeSingle();
  if (!profile) redirect(`/ingresar?next=${encodeURIComponent("/ajustes")}&expirada=1`);
  const photo = await avatarUrl(supabase, profile.avatar_path);

  return (
    <div className="flex flex-col gap-5">
      {correo === "pendiente" ? <Alert>Confirmaste uno de los dos enlaces. Abre también el que enviamos al otro correo para terminar el cambio.</Alert> : null}

      <SectionCard icon={<Camera className="size-5" />} title="Foto de perfil" text="Aparece en tus ajustes y en el menú de la tienda." id="foto">
        <AvatarUploader userId={profile.id ?? ""} name={profile.full_name ?? profile.email} photo={photo} currentPath={profile.avatar_path} save={saveAvatar} />
      </SectionCard>

      <SectionCard icon={<UserRound className="size-5" />} title="Datos personales" text="Así te identifican las tiendas y los repartidores." id="datos">
        <ProfileForm initial={{ fullName: profile.full_name ?? "", phone: profile.phone ?? "" }} save={updateProfile} />
      </SectionCard>

      <SectionCard icon={<Mail className="size-5" />} title="Correo de la cuenta" text="Con él ingresas y te avisamos de tus pedidos." id="correo">
        <EmailForm email={profile.email} change={changeEmail} />
      </SectionCard>

      <section aria-labelledby="vende-titulo" className="relative isolate flex flex-col gap-4 overflow-hidden rounded-[1.75rem] bg-panel p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div aria-hidden="true" className="absolute -bottom-24 -right-16 -z-10 size-64 rounded-full bg-esmeralda/20 blur-3xl" />
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-esmeralda">
            <Store className="size-5" />
          </span>
          <div>
            <h2 id="vende-titulo" className="text-[17px] font-bold tracking-tight">
              ¿Tienes un negocio?
            </h2>
            <p className="mt-0.5 max-w-[46ch] text-[13px] text-nav-texto">Con esta misma cuenta envías la solicitud para vender en Rapitrip.</p>
          </div>
        </div>
        <Link href="/vende" className={buttonStyles({ variant: "primary", className: "shrink-0 self-start sm:self-auto" })}>
          Vende en Rapitrip
        </Link>
      </section>
    </div>
  );
}
