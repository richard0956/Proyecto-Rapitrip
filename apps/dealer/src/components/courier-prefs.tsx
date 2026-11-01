"use client";

import { cn } from "@rapitrip/ui";
import { BellRing, Check, MapPinned, Navigation, Route, Smartphone, Volume2 } from "lucide-react";
import { createElement, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { playOfferAlert } from "@/lib/offer-alert";
import { setPref, usePrefs, type MapsApp } from "@/lib/prefs";
import { wakeLockSupported } from "@/lib/use-wake-lock";
import { SettingsSection } from "./settings-header";

/** Interruptor con el mismo aspecto que el de «Correos de mis pedidos» de la tienda: fila crema, título, ayuda y la palanca. */
function Switch({ icon, title, text, checked, onChange, disabled }: { icon: ReactNode; title: string; text: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-crema p-4 ring-1 ring-selva/[0.05]">
      <span className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-hoja">
          {icon}
        </span>
        <span>
          <span id={`${id}-titulo`} className="block text-[14px] font-bold text-tinta">
            {title}
          </span>
          <span id={`${id}-texto`} className="block text-[12.5px] text-tinta-suave">
            {text}
          </span>
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-texto`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-300 ease-fluido focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja disabled:opacity-50", checked ? "bg-hoja" : "bg-borde-campo")}
      >
        <span aria-hidden="true" className={cn("absolute left-1 size-6 rounded-full bg-superficie shadow-sm transition-transform duration-300 ease-fluido", checked ? "translate-x-6" : "translate-x-0")} />
      </button>
    </div>
  );
}

const mapsApps: { value: MapsApp; label: string; text: string; icon: typeof Navigation }[] = [
  { value: "google", label: "Google Maps", text: "Abre Google Maps.", icon: MapPinned },
  { value: "waze", label: "Waze", text: "Abre Waze con la ruta lista para salir.", icon: Navigation },
  { value: "apple", label: "Apple Maps", text: "Abre Mapas del iPhone con la ruta.", icon: Route },
];

/** Sonido y vibración al llegar una propuesta con la app abierta, con un botón para probarlo (también activa el sonido). */
export function AlertPrefs() {
  const prefs = usePrefs();
  const [tested, setTested] = useState<"sono" | "sin-sonido" | null>(null);
  return (
    <SettingsSection id="aviso" icon={<Volume2 className="size-5" />} title="Al llegar una propuesta" text="Con la app abierta en la pantalla. Con la app cerrada te avisan los avisos de propuestas.">
      <div className="flex flex-col gap-3">
        <Switch icon={<BellRing className="size-5" />} title="Sonido y vibración" text="Un «din-don» corto y dos vibraciones." checked={prefs.alert} onChange={(next) => setPref("alert", next)} />
        <button
          type="button"
          disabled={!prefs.alert}
          onClick={() => void playOfferAlert().then((sounded) => setTested(sounded ? "sono" : "sin-sonido"))}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-menta px-5 text-[13.5px] font-bold text-selva ring-1 ring-selva/10 transition-[background-color,transform] duration-300 ease-fluido hover:bg-menta/70 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
        >
          <Volume2 aria-hidden="true" className="size-4" />
          Probar el aviso
        </button>
        <p aria-live="polite" className="px-1 text-[12.5px] text-tinta-suave">
          {tested === "sono" ? "¿Lo escuchaste? Así suena cuando llega una propuesta." : tested === "sin-sonido" ? "Este teléfono no dejó sonar. Revisa el volumen o el modo silencio." : "Sube el volumen del teléfono: el sonido sigue al volumen multimedia."}
        </p>
      </div>
    </SettingsSection>
  );
}

/** App de mapas que abren los botones «Cómo llegar» del pedido. */
export function MapsPrefs() {
  const prefs = usePrefs();
  const selected = mapsApps.find((app) => app.value === prefs.maps);
  return (
    <SettingsSection id="navegacion" icon={<Navigation className="size-5" />} title="Navegación" text="Qué app abre «Cómo llegar» en la tienda y con el cliente.">
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="App de mapas" className="grid grid-cols-3 gap-2">
          {mapsApps.map((app) => {
            const checked = prefs.maps === app.value;
            return (
              <label
                key={app.value}
                className={cn(
                  "relative flex min-h-[84px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl p-2 text-center ring-1 transition-[background-color,box-shadow] duration-300 ease-fluido has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-hoja",
                  checked ? "bg-menta/60 ring-2 ring-hoja" : "bg-crema ring-borde hover:ring-borde-campo",
                )}
              >
                <input type="radio" name="mapas" value={app.value} checked={checked} onChange={() => setPref("maps", app.value)} className="sr-only" />
                <span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-xl", checked ? "bg-hoja text-sobre-acento" : "bg-superficie text-hoja")}>
                  {createElement(app.icon, { className: "size-[18px]" })}
                </span>
                <span className="text-[12.5px] font-bold leading-tight text-tinta">{app.label}</span>
                {checked ? (
                  <span aria-hidden="true" className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-hoja text-sobre-acento">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
        <p className="px-1 text-[12.5px] text-tinta-suave">{selected?.text} Si no la tienes instalada, se abre en el navegador.</p>
      </div>
    </SettingsSection>
  );
}

// En el servidor no se sabe si el navegador lo permite: se asume que sí hasta hidratar.
const noop = () => () => {};

/** Pantalla encendida mientras está disponible o con un pedido abierto, para no desbloquear el teléfono a cada rato. */
export function ScreenPrefs() {
  const prefs = usePrefs();
  const supported = useSyncExternalStore(noop, wakeLockSupported, () => true);
  return (
    <SettingsSection id="pantalla" icon={<Smartphone className="size-5" />} title="Pantalla" text="Para tener el pedido a la vista sin desbloquear el teléfono.">
      <div className="flex flex-col gap-3">
        <Switch
          icon={<Smartphone className="size-5" />}
          title="Mantener la pantalla encendida"
          text="Mientras estás disponible o con un pedido abierto. Gasta algo más de batería."
          checked={prefs.awake && supported}
          disabled={!supported}
          onChange={(next) => setPref("awake", next)}
        />
        {!supported ? <p className="px-1 text-[12.5px] text-tinta-suave">Este navegador no lo permite. En iPhone hace falta iOS 16.4 o más nuevo.</p> : null}
      </div>
    </SettingsSection>
  );
}
