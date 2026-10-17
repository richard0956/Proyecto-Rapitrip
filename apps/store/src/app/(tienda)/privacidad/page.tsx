import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { privacySections } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidad", description: "Qué datos tratamos, para qué y cuáles son tus derechos." };

export default function PrivacidadPage() {
  return <LegalPage title="Política de privacidad" intro="Qué datos pedimos, para qué los usamos y cómo puedes ejercer tus derechos." sections={privacySections} other={{ href: "/terminos", label: "Ver los Términos y condiciones" }} />;
}
