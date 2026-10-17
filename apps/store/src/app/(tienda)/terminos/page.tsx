import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { termsSections } from "@/lib/legal";

export const metadata: Metadata = { title: "Términos y condiciones", description: "Las reglas para usar Rapitrip como cliente o comercio afiliado." };

export default function TerminosPage() {
  return <LegalPage title="Términos y condiciones" intro="Las reglas básicas para usar la tienda de Rapitrip, escritas para que se entiendan." sections={termsSections} other={{ href: "/privacidad", label: "Ver la Política de privacidad" }} />;
}
