import { LegalDocument } from "@rapitrip/ui";
import { courierTerms, LEGAL_BASIS, LEGAL_UPDATED } from "@/lib/legal";

export const metadata = { title: "Términos del repartidor" };

export default function TerminosPage() {
  return (
    <LegalDocument
      eyebrow="Repartidores · Legal"
      title="Términos de uso para repartidores"
      intro="Las reglas para recoger, llevar y entregar pedidos con la app de Rapitrip."
      updated={LEGAL_UPDATED}
      basis={LEGAL_BASIS}
      sections={courierTerms}
      other={{ href: "/privacidad", label: "Ver la Política de privacidad del repartidor" }}
      contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined}
    />
  );
}
