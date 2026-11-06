import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { merchantTermsSections } from "@/lib/legal";

export const metadata: Metadata = { title: "Términos del comercio afiliado", description: "Las reglas con las que trabaja un comercio afiliado a Rapitrip." };

export default function TerminosComercioPage() {
  return <LegalPage title="Términos del comercio afiliado" intro="Lo que te comprometes a cumplir si tu negocio vende en Rapitrip." sections={merchantTermsSections} other={{ href: "/terminos", label: "Ver los Términos y condiciones generales" }} />;
}
