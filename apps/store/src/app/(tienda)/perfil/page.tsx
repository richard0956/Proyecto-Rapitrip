import { Alert, Avatar, buttonStyles, Card } from "@rapitrip/ui";
import { MapPin, Package, Store } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { updateProfile } from "./actions";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Mi perfil", robots: { index: false } };

const fecha = new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "America/Managua" });

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ clave?: string }> }) {
  const { clave } = await searchParams;
  await requireCustomer("/perfil");
  const supabase = await serverSupabase();
  const { data: profile } = await supabase.from("my_profile").select("*").maybeSingle();
  // La vista solo responde con una sesión de menos de un día: si viene vacía, hay que ingresar de nuevo.
  if (!profile) redirect(`/ingresar?next=${encodeURIComponent("/perfil")}&expirada=1`);

  return (
    <main className="mx-auto max-w-[1176px] px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Mi perfil</h1>
      <p className="mt-1 text-[13.5px] text-tinta-suave">Tus datos de contacto en Rapitrip.</p>
      {clave === "ok" ? <Alert className="mt-5">Tu contraseña se actualizó.</Alert> : null}

      <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={profile.full_name ?? profile.email} />
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-tinta">{profile.full_name ?? "Sin nombre"}</h2>
              <p className="truncate text-xs text-tinta-suave">{profile.email}</p>
            </div>
          </div>
          <ProfileForm initial={{ fullName: profile.full_name ?? "", phone: profile.phone ?? "" }} save={updateProfile} />
          {profile.created_at ? <p className="mt-4 text-xs text-tinta-suave">Cliente desde el {fecha.format(new Date(profile.created_at))}.</p> : null}
        </Card>

        <div className="flex flex-col gap-5">
        <Card className="p-6">
          <h2 className="text-base font-bold text-tinta">Mis compras</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/pedidos" className={buttonStyles({ variant: "secondary" })}>
              <Package aria-hidden="true" className="size-4" />
              Mis pedidos
            </Link>
            <Link href="/perfil/direcciones" className={buttonStyles({ variant: "secondary" })}>
              <MapPin aria-hidden="true" className="size-4" />
              Mis direcciones
            </Link>
          </div>
        </Card>
        <Card className="p-6">
          <span aria-hidden="true" className="mb-3 flex size-11 items-center justify-center rounded-boton bg-lavanda text-tinta">
            <Store className="size-5" />
          </span>
          <h2 className="text-base font-bold text-tinta">¿Tienes un negocio?</h2>
          <p className="mt-1 max-w-[52ch] text-[13.5px] text-tinta-suave">Envía una solicitud para afiliar tu comercio y vender en Rapitrip con esta misma cuenta.</p>
          <Link href="/vende" className={buttonStyles({ variant: "primary", className: "mt-4" })}>
            Vende en Rapitrip
          </Link>
          <p className="mt-5 text-xs text-tinta-suave">¿Olvidaste tu contraseña o quieres cambiarla?</p>
          <Link href="/recuperar" className="text-[13px] font-bold text-hoja underline-offset-2 hover:underline">
            Enviarme un enlace para cambiarla
          </Link>
        </Card>
        </div>
      </div>
    </main>
  );
}
