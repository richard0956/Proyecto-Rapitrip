import { LegalDocument } from "@rapitrip/ui";
import { consoleTerms, LEGAL_BASIS, LEGAL_UPDATED } from "@/lib/legal";

export const metadata = { title: "Términos de uso de la consola" };

export default function TerminosPage() {
  return (
    <LegalDocument
      eyebrow="Consola · Legal"
      title="Términos de uso de la consola"
      intro="Las reglas para el equipo de Rapitrip y los comercios afiliados que trabajan en la consola."
      updated={LEGAL_UPDATED}
      basis={LEGAL_BASIS}
      sections={consoleTerms}
      other={{ href: "/privacidad", label: "Ver la Política de privacidad de la consola" }}
      contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined}
    />
  );
}
