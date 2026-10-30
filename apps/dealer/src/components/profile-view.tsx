"use client";

import { Alert, Avatar, cn, Reveal } from "@rapitrip/ui";
import { Bike, Car, LogOut, MapPin, Phone, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { departmentName } from "@/lib/department";
import { disablePush } from "@/lib/push-client";
import type { CourierMe } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { usePolling } from "@/lib/use-polling";
import { GreenPanel, PanelTag, SectionTitle, Tray } from "./panel";
import { PushCard } from "./push-card";

const vehicle: Record<string, string> = { moto: "Moto", vehiculo: "Vehículo" };

/** Un dato de la ficha: fila crema con su ícono, como los detalles de la tarjeta de propuesta. */
function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-crema px-3 py-2.5">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-menta text-hoja">
        {icon}
      </span>
      <dt className="flex-1 text-[13px] font-semibold text-tinta-suave">{label}</dt>
      <dd className="text-right text-[14px] font-bold text-tinta">{value || "—"}</dd>
    </div>
  );
}

export function ProfileView() {
  const supabase = getSupabase();
  const router = useRouter();
  const guard = useAuthGuard();
  const [me, setMe] = useState<CourierMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error: failure } = await supabase.from("courier_me").select("*").maybeSingle();
    if (failure) {
      if (!guard(failure)) setError(friendlyError(failure, "No pudimos cargar tus datos."));
      return;
    }
    setMe(data as CourierMe | null);
    setError(null);
  }, [supabase, guard]);
  usePolling(load, 60_000);

  async function logout() {
    setLeaving(true);
    // Este teléfono deja de recibir los avisos de esta cuenta (si otra persona lo usa, no los recibirá).
    await disablePush();
    await supabase.auth.signOut();
    router.replace("/ingresar");
    router.refresh();
  }

  const vehicleText = me?.vehicle_class ? vehicle[me.vehicle_class] : me?.vehicle_type;
  const VehicleIcon = me?.vehicle_class === "vehiculo" ? Car : Bike;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <Reveal>
        <GreenPanel labelledBy="titulo-perfil">
          <PanelTag icon={<UserRound aria-hidden="true" className="size-3.5" />}>Tu cuenta</PanelTag>
          <div className="mt-5 flex items-center gap-4">
            <Avatar name={me?.full_name} tone="dark" className="size-16 text-[22px] font-extrabold ring-4 ring-white/10" />
            <div className="min-w-0">
              <h1 id="titulo-perfil" className="text-[26px] font-extrabold leading-tight tracking-tight">
                {me?.full_name ?? "Perfil"}
              </h1>
              <p className="mt-0.5 text-[13.5px] text-white/75">Repartidor de Rapitrip</p>
            </div>
          </div>
          <ul className="mt-5 flex flex-wrap gap-2 text-[12.5px] font-semibold">
            {vehicleText ? (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 ring-1 ring-white/10">
                <VehicleIcon aria-hidden="true" className="size-3.5 text-esmeralda" /> {vehicleText}
              </li>
            ) : null}
            {me?.department ? (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 ring-1 ring-white/10">
                <MapPin aria-hidden="true" className="size-3.5 text-esmeralda" /> {departmentName(me.department)}
              </li>
            ) : null}
            <li className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1", me?.available ? "bg-esmeralda/20 ring-esmeralda/40" : "bg-white/5 text-white/70 ring-white/10")}>
              <span aria-hidden="true" className={cn("size-2 rounded-full", me?.available ? "bg-esmeralda" : "bg-white/40")} />
              {me?.available ? "En línea" : "Fuera de línea"}
            </li>
          </ul>
        </GreenPanel>
      </Reveal>

      {error ? <Alert tone="warning">{error}</Alert> : null}

      <Tray>
        <section aria-labelledby="datos" className="flex flex-col gap-3">
          <SectionTitle id="datos" title="Tus datos" text="Si algo está mal, pide a coordinación que lo corrija." />
          <dl className="flex flex-col gap-2">
            <Row icon={<Phone className="size-4" />} label="Teléfono" value={me?.phone} />
            <Row icon={<VehicleIcon className="size-4" />} label="Vehículo" value={vehicleText} />
            <Row icon={<MapPin className="size-4" />} label="Departamento" value={departmentName(me?.department)} />
          </dl>
        </section>
      </Tray>

      <PushCard />

      <button
        type="button"
        disabled={leaving}
        onClick={logout}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-superficie text-[14px] font-bold text-tinta ring-1 ring-borde transition-[background-color,color,transform] duration-500 ease-fluido hover:bg-rosa hover:text-rojo active:scale-[0.98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
      >
        <LogOut className="size-4" aria-hidden="true" />
        {leaving ? "Saliendo…" : "Cerrar sesión"}
      </button>
    </div>
  );
}
