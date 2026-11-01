"use client";

import { Alert, Avatar, cn, Reveal } from "@rapitrip/ui";
import { Bike, Car, ChevronRight, CircleHelp, LogOut, MapPin, Palette, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, useCallback, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { departmentName } from "@/lib/department";
import { signOutCourier } from "@/lib/sign-out";
import type { CourierMe } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { usePolling } from "@/lib/use-polling";
import { vehicleLabel } from "@/lib/vehicle";
import { GreenPanel, PanelTag, SectionTitle, Tray } from "./panel";

const sections: { href: string; label: string; text: string; icon: LucideIcon }[] = [
  { href: "/perfil/preferencias", label: "Preferencias", text: "Avisos, mapas, pantalla y tema", icon: Palette },
  { href: "/perfil/cuenta", label: "Cuenta", text: "Tus datos, contraseña y sesiones", icon: ShieldCheck },
  { href: "/perfil/ayuda", label: "Ayuda", text: "Preguntas y reportar un fallo de la app", icon: CircleHelp },
];

/** Perfil: quién eres (panel verde) y la entrada a los ajustes, cada uno en su pantalla. Cierra con «Cerrar sesión». */
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
    await signOutCourier();
    router.replace("/ingresar");
    router.refresh();
  }

  const vehicleText = vehicleLabel(me);
  const VehicleIcon = me?.vehicle_class === "vehiculo" ? Car : Bike;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <Reveal>
        <GreenPanel labelledBy="titulo-perfil">
          <PanelTag icon={<UserRound aria-hidden="true" className="size-3.5" />}>Tu cuenta</PanelTag>
          <div className="mt-5 flex items-center gap-4">
            <Avatar name={me?.full_name} tone="dark" className="size-16 text-[22px] font-extrabold text-panel ring-4 ring-white/10" />
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
        <nav aria-labelledby="ajustes" className="flex flex-col gap-3">
          <SectionTitle id="ajustes" title="Ajustes" />
          <ul className="flex flex-col gap-2">
            {sections.map((section) => (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className="group flex items-center gap-3 rounded-[1.5rem] bg-crema p-3 ring-1 ring-selva/[0.05] transition-[background-color,transform] duration-500 ease-fluido hover:bg-menta/50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
                >
                  <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-menta text-hoja">
                    {createElement(section.icon, { className: "size-5" })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-tinta">{section.label}</span>
                    <span className="block text-[12.5px] text-tinta-suave">{section.text}</span>
                  </span>
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-superficie text-selva transition-transform duration-500 ease-fluido group-hover:translate-x-0.5">
                    <ChevronRight className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Tray>

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
