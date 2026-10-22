"use client";

import { Alert, Button, buttonStyles, Field, SelectField, TextareaField } from "@rapitrip/ui";
import { Building2, CheckCircle2, FileText, IdCard, Mail, MapPin, Smartphone, Tag, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Steps } from "@/components/steps";
import { saveDraft, takeDraft } from "@/lib/draft";
import type { CustomerResult } from "@/lib/result";

const DRAFT_KEY = "rapitrip:vende";
type Values = { businessKind: "informal" | "empresa"; ruc: string; cedula: string; businessName: string; contactName: string; phone: string; email: string; address: string; category: string; description: string };
const empty: Values = { businessKind: "informal", ruc: "", cedula: "", businessName: "", contactName: "", phone: "", email: "", address: "", category: "", description: "" };

export function CommerceForm({ initialName, submit }: { initialName: string; submit: (values: Values) => Promise<CustomerResult> }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ ...empty, contactName: initialName });
  const [result, setResult] = useState<CustomerResult | null>(null);
  const [restored, setRestored] = useState(false);
  const [pending, start] = useTransition();
  const set = (key: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const empresa = values.businessKind === "empresa";
  // El RUC solo se pide a las empresas; la cédula, solo al vendedor propio.
  const missing = Object.entries(values).some(([key, value]) => {
    if (key === "businessKind") return false;
    if (key === "ruc") return empresa && !value.trim();
    if (key === "cedula") return !empresa && !value.trim();
    return !value.trim();
  });

  useEffect(() => {
    const draft = takeDraft<Values>(DRAFT_KEY);
    if (draft) {
    // Leer el borrador de sessionStorage solo es posible tras hidratar: es sincronizar con un sistema externo del navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues({ ...empty, ...draft });
      setRestored(true);
    }
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    start(async () => {
      const outcome = await submit(values);
      if (!outcome.ok && outcome.expired) {
        saveDraft(DRAFT_KEY, values);
        router.replace(`/ingresar?next=${encodeURIComponent("/vende")}&expirada=1`);
        return;
      }
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  if (result?.ok) {
    return (
      <div className="flex flex-col gap-5">
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-borde p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-tinta">Solicitud enviada</h2>
            <p className="text-[13.5px] text-tinta-suave">Recibimos la solicitud de «{values.businessName}» ({empresa ? "empresa con RUC" : "vendedor propio"}). Te avisaremos a {values.email} cuando la revisemos.</p>
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-base font-bold text-tinta">Qué sigue</h2>
          <Steps
            items={[
              { title: "Revisión de datos", text: "El equipo de Rapitrip revisa la información que enviaste." },
              { title: "Convenio de afiliación", text: "Si todo está bien, firmamos el convenio con tu comercio." },
              { title: "Tu comercio queda activo", text: "Creamos tu comercio y tu cuenta de comercio en la consola." },
            ]}
          />
        </div>
        <Link href="/" className={buttonStyles({ variant: "secondary", className: "self-start" })}>
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
      {restored ? <Alert>Recuperamos lo que escribiste. Revisa y envía la solicitud.</Alert> : null}
      <SelectField
        label="Tipo de vendedor"
        value={values.businessKind}
        onChange={(e) => setValues((v) => ({ ...v, businessKind: e.target.value === "empresa" ? "empresa" : "informal", ruc: e.target.value === "empresa" ? v.ruc : "", cedula: e.target.value === "empresa" ? "" : v.cedula }))}
        hint={empresa ? "Las empresas y negocios formales indican su número RUC." : "Para personas que venden por su cuenta: piden su cédula y datos personales."}
      >
        <option value="informal">Vendedor propio o informal</option>
        <option value="empresa">Empresa o negocio formal (con RUC)</option>
      </SelectField>
      {empresa ? <Field label="Número RUC" icon={<FileText className="size-4" />} value={values.ruc} onChange={set("ruc")} autoComplete="off" placeholder="J0310000000000" hint="Entre 8 y 20 letras o números, sin espacios." required /> : null}
      {!empresa ? <Field label="Número de cédula" icon={<IdCard className="size-4" />} value={values.cedula} onChange={set("cedula")} autoComplete="off" placeholder="001-010190-0000A" hint="Entre 8 y 20 letras o números." required /> : null}
      <Field label="Nombre del negocio" icon={<Building2 className="size-4" />} value={values.businessName} onChange={set("businessName")} required />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label={empresa ? "Representante" : "Nombre completo"} icon={<UserRound className="size-4" />} autoComplete="name" value={values.contactName} onChange={set("contactName")} required />
        <Field label="Teléfono" icon={<Smartphone className="size-4" />} type="tel" autoComplete="tel" value={values.phone} onChange={set("phone")} required />
      </div>
      <Field label="Correo electrónico" icon={<Mail className="size-4" />} type="email" autoComplete="email" value={values.email} onChange={set("email")} required />
      <Field label="Dirección del negocio" icon={<MapPin className="size-4" />} autoComplete="street-address" value={values.address} onChange={set("address")} required />
      <Field label="Categoría" icon={<Tag className="size-4" />} value={values.category} onChange={set("category")} placeholder="Ferretería, ropa, belleza…" required />
      <TextareaField label="Describe tu negocio y los productos que ofreces" maxLength={500} value={values.description} onChange={set("description")} placeholder={empresa ? "Tipo de empresa, giro y productos que ofertan" : "Qué vendes, cómo trabajas y qué productos ofreces"} required />
      {result && !result.ok ? <Alert tone="error">{result.error}</Alert> : null}
      <Button variant="primary" type="submit" disabled={pending || missing} className="self-start">
        {pending ? "Enviando…" : "Enviar solicitud"}
      </Button>
    </form>
  );
}
