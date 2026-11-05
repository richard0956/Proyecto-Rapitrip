import { Alert, Badge } from "@rapitrip/ui";
import { BadgeCheck, Camera, Lock, Mail, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { avatarUrl } from "@/lib/avatar";
import { formatDate, formatDateTime, roleLabel } from "@/lib/format";
import { requireAnyConsoleSession } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { AccountNav } from "./account-nav";
import { saveAvatar, updateProfile } from "./actions";
import { AvatarUploader } from "./avatar-uploader";
import { ProfileForm } from "./profile-form";
import { SectionCard } from "./section-card";

export const metadata = { title: "Mi cuenta" };

/** Perfil en dos filas parejas: foto y correo institucional (solo lectura); datos personales y roles de la cuenta. */
export default async function CuentaPage() {
  await requireAnyConsoleSession();
  const supabase = await serverSupabase();
  const [profile, roles] = await Promise.all([supabase.from("my_profile").select("*").maybeSingle(), supabase.from("my_roles").select("*").order("granted_at")]);
  if (profile.error || roles.error) console.error("[cuenta]", profile.error?.message, roles.error?.message);
  const photo = await avatarUrl(supabase, profile.data?.avatar_path);

  return (
    <>
      <PageHeader title="Mi cuenta" description="Tu perfil, la seguridad de tu acceso, tus preferencias y la ayuda de tu rol." />
      <AccountNav />
      {profile.error || !profile.data?.id ? (
        <Alert tone="error">No pudimos cargar tu perfil. Recarga la página o vuelve a ingresar.</Alert>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
          <SectionCard outerClassName="h-full" icon={<Camera className="size-[18px]" />} title="Foto de perfil" text="Te identifica en tu consola.">
            <AvatarUploader userId={profile.data.id} name={profile.data.full_name} photo={photo} currentPath={profile.data.avatar_path} save={saveAvatar} />
          </SectionCard>
          <SectionCard outerClassName="h-full" icon={<Mail className="size-[18px]" />} tone="lavanda" title="Correo de la cuenta" text="Las cuentas del equipo usan un correo institucional.">
            <div className="flex items-center justify-between gap-3 rounded-panel bg-crema/70 px-4 py-3 ring-1 ring-borde">
              <span className="min-w-0 truncate text-sm font-bold text-tinta">{profile.data.email}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-papel px-2.5 py-1 text-[11.5px] font-bold text-tinta-suave ring-1 ring-borde">
                <Lock aria-hidden="true" className="size-3" />
                Institucional
              </span>
            </div>
            <p className="mt-3 text-[12.5px] leading-snug text-tinta-suave">No se cambia desde aquí. Si tu correo cambió, pídele a la administración que actualice tu acceso.</p>
            <p className="mt-2 text-[12px] text-tinta-suave">Último ingreso: {formatDateTime(profile.data.last_sign_in_at)}</p>
          </SectionCard>
          <SectionCard outerClassName="h-full" icon={<UserRound className="size-[18px]" />} title="Datos personales" text="Tu nombre aparece en la auditoría y en lo que registras.">
            <ProfileForm fullName={profile.data.full_name ?? ""} phone={profile.data.phone ?? ""} save={updateProfile} />
          </SectionCard>
          <SectionCard outerClassName="h-full" icon={<BadgeCheck className="size-[18px]" />} tone="durazno" title="Mis roles" text="Lo que puedes hacer en la consola. Los asigna la administración.">
            {(roles.data ?? []).length === 0 ? (
              <p className="text-[13px] text-tinta-suave">No tienes roles asignados.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(roles.data ?? []).map((row) => (
                  <li key={row.id ?? row.role} className="flex items-center justify-between gap-3 rounded-panel bg-papel px-4 py-3 ring-1 ring-borde">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-tinta">{roleLabel[row.role ?? ""] ?? row.role}</span>
                      <span className="block text-xs text-tinta-suave">Desde {formatDate(row.granted_at)}</span>
                    </span>
                    <Badge tone={row.status === "activo" ? "positive" : row.status === "suspendido" ? "danger" : "neutral"}>{row.status === "activo" ? "Activo" : row.status === "suspendido" ? "Suspendido" : "Revocado"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}
