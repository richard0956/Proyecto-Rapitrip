import { Palette } from "lucide-react";
import { AlertPrefs, MapsPrefs, MotionPrefs, ScreenPrefs } from "@/components/courier-prefs";
import { PushCard } from "@/components/push-card";
import { SettingsHeader, SettingsSection } from "@/components/settings-header";
import { ThemePicker } from "@/components/theme-picker";

export const metadata = { title: "Preferencias" };

/**
 * Preferencias, como las de la tienda pero con lo que importa en la calle: cómo te avisa una propuesta (con la app cerrada y
 * abierta), qué app de mapas usas, si la pantalla se queda encendida y el tema. Todo vale para este teléfono.
 */
export default function PreferenciasPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <SettingsHeader icon={<Palette aria-hidden="true" className="size-3.5" />} title="Preferencias" text="Cómo te avisa la app, cómo te lleva y cómo se ve en este teléfono." />

      <PushCard />
      <AlertPrefs />
      <MapsPrefs />
      <ScreenPrefs />
      <MotionPrefs />

      <SettingsSection id="tema" icon={<Palette className="size-5" />} title="Tema" text="Se guarda en este teléfono.">
        <ThemePicker />
      </SettingsSection>
    </div>
  );
}
