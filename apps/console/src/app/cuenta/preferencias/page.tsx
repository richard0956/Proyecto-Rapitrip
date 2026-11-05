import { Palette, Zap } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { ThemePicker } from "@/components/theme-picker";
import { requireAnyConsoleSession } from "@/lib/guard";
import { AccountNav } from "../account-nav";
import { SectionCard } from "../section-card";
import { MotionSwitch } from "./preference-switches";

export const metadata = { title: "Preferencias" };

/**
 * Preferencias de la consola en este navegador: el tema y las animaciones, cada uno en su fila. Los avisos de compras no
 * están aquí: por seguridad (Zero Trust) una cuenta de consola no compra en la tienda.
 */
export default async function PreferenciasPage() {
  await requireAnyConsoleSession();

  return (
    <>
      <PageHeader title="Mi cuenta" description="Tu perfil, la seguridad de tu acceso, tus preferencias y la ayuda de tu rol." />
      <AccountNav />
      <div className="flex flex-col gap-5">
        <SectionCard icon={<Palette className="size-[18px]" />} title="Tema" text="Cómo se ve la consola en esta computadora. Se guarda en este navegador.">
          <ThemePicker />
        </SectionCard>
        <SectionCard icon={<Zap className="size-[18px]" />} tone="lavanda" title="Animaciones" text="Se guarda en este navegador. En otra computadora puedes elegir otra cosa.">
          <MotionSwitch />
        </SectionCard>
      </div>
    </>
  );
}
