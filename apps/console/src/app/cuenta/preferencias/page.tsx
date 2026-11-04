import { Bell, MonitorSmartphone } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { requireAnyConsoleSession } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { AccountNav } from "../account-nav";
import { setOrderEmails } from "../actions";
import { SectionCard } from "../section-card";
import { MotionSwitch, OrderEmailSwitch } from "./preference-switches";

export const metadata = { title: "Preferencias" };

/** Preferencias: los avisos por correo (en la cuenta) y la pantalla (en este navegador). */
export default async function PreferenciasPage() {
  await requireAnyConsoleSession();
  const supabase = await serverSupabase();
  const { data: profile } = await supabase.from("my_profile").select("notify_order_email").maybeSingle();

  return (
    <>
      <PageHeader title="Mi cuenta" description="Tu perfil, la seguridad de tu acceso, tus preferencias y la ayuda de tu rol." />
      <AccountNav />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <SectionCard icon={<Bell className="size-[18px]" />} title="Avisos por correo" text="Se guardan en tu cuenta y valen en cualquier dispositivo.">
          <OrderEmailSwitch enabled={profile?.notify_order_email ?? true} save={setOrderEmails} />
          <p className="mt-3 text-[12px] leading-snug text-tinta-suave">Los avisos de trabajo de la consola, como las alertas de incidentes graves, no dependen de esta opción.</p>
        </SectionCard>
        <SectionCard icon={<MonitorSmartphone className="size-[18px]" />} tone="lavanda" title="Pantalla" text="Se guarda en este navegador. En otra computadora puedes elegir otra cosa.">
          <MotionSwitch />
        </SectionCard>
      </div>
    </>
  );
}
