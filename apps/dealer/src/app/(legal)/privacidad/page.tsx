import { LegalDocument } from "@rapitrip/ui";
import { courierPrivacy, LEGAL_BASIS, LEGAL_UPDATED } from "@/lib/legal";

export const metadata = { title: "Privacidad del repartidor" };

export default function PrivacidadPage() {
  return (
    <LegalDocument
      eyebrow="Repartidores · Legal"
      title="Política de privacidad del repartidor"
      intro="Qué datos tuyos tratamos al usar la app, para qué y cuáles son tus derechos."
      updated={LEGAL_UPDATED}
      basis={LEGAL_BASIS}
      sections={courierPrivacy}
      other={{ href: "/terminos", label: "Ver los Términos de uso para repartidores" }}
      contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined}
    />
  );
}
