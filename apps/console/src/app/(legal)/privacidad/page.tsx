import { LegalDocument } from "@rapitrip/ui";
import { consolePrivacy, LEGAL_BASIS, LEGAL_UPDATED } from "@/lib/legal";

export const metadata = { title: "Privacidad de la consola" };

export default function PrivacidadPage() {
  return (
    <LegalDocument
      eyebrow="Consola · Legal"
      title="Política de privacidad de la consola"
      intro="Qué datos del equipo y de los comercios tratamos en la consola, para qué y cuáles son tus derechos."
      updated={LEGAL_UPDATED}
      basis={LEGAL_BASIS}
      sections={consolePrivacy}
      other={{ href: "/terminos", label: "Ver los Términos de uso de la consola" }}
      contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined}
    />
  );
}
