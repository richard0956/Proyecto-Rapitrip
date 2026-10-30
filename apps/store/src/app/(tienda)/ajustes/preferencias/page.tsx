import { getSessionInfo } from "@rapitrip/supabase";
import { Bell, LogIn, Palette } from "lucide-react";
import Link from "next/link";
import { ThemePicker } from "@/components/theme-picker";
import { serverSupabase } from "@/lib/supabase";
import { SectionCard } from "../section-card";
import { setOrderEmails } from "./actions";
import { NotificationSwitch } from "./notification-switch";

export const metadata = { title: "Preferencias" };

/** Preferencias: el tema (para todos, en este navegador) y las notificaciones (con sesión, guardadas en la cuenta). */
export default async function PreferenciasPage() {
  const supabase = await serverSupabase();
  const session = await getSessionInfo(supabase);
  const { data: profile } = session.signedIn ? await supabase.from("my_profile").select("notify_order_email").maybeSingle() : { data: null };

  return (
    <div className="flex flex-col gap-5">
      <SectionCard icon={<Palette className="size-5" />} title="Tema" text="Cómo se ve Rapitrip en este dispositivo." id="tema">
        <ThemePicker />
        <p className="mt-4 text-[12.5px] text-tinta-suave">La elección se guarda en este navegador. En otro dispositivo puedes elegir otra.</p>
      </SectionCard>

      <SectionCard icon={<Bell className="size-5" />} title="Notificaciones" text="Qué avisos te enviamos sobre tus compras." id="notificaciones">
        {profile ? (
          <NotificationSwitch enabled={profile.notify_order_email ?? true} save={setOrderEmails} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde">
            <p className="text-[13.5px] text-tinta-suave">Ingresa a tu cuenta para elegir qué avisos de tus pedidos recibes.</p>
            <Link href={`/ingresar?next=${encodeURIComponent("/ajustes/preferencias")}`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-selva px-4 text-[13px] font-semibold text-sobre-acento hover:bg-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
              <LogIn aria-hidden="true" className="size-4" />
              Ingresar
            </Link>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
