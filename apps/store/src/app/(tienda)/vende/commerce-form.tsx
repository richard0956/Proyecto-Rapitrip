"use client";

import { Alert, Button, buttonStyles, Field } from "@rapitrip/ui";
import { Building2, MapPin, Smartphone, Tag, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Steps } from "@/components/steps";
import { saveDraft, takeDraft } from "@/lib/draft";
import type { CustomerResult } from "@/lib/result";

const DRAFT_KEY = "rapitrip:vende";
type Values = { businessName: string; contactName: string; phone: string; address: string; category: string };
const empty: Values = { businessName: "", contactName: "", phone: "", address: "", category: "" };

export function CommerceForm({ initialName, submit }: { initialName: string; submit: (values: Values) => Promise<CustomerResult> }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ ...empty, contactName: initialName });
  const [result, setResult] = useState<CustomerResult | null>(null);
  const [restored, setRestored] = useState(false);
  const [pending, start] = useTransition();
  const set = (key: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  useEffect(() => {
    const draft = takeDraft<Values>(DRAFT_KEY);
    if (draft) {
      setValues(draft);
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
    });
  }

  if (result?.ok) {
    return (
      <div className="flex flex-col gap-5">
        <Alert>Recibimos la solicitud de «{values.businessName}». Te avisaremos por correo cuando la revisemos.</Alert>
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
      <Field label="Nombre del negocio" icon={<Building2 className="size-4" />} value={values.businessName} onChange={set("businessName")} required />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label="Representante" icon={<UserRound className="size-4" />} autoComplete="name" value={values.contactName} onChange={set("contactName")} required />
        <Field label="Teléfono" icon={<Smartphone className="size-4" />} type="tel" autoComplete="tel" value={values.phone} onChange={set("phone")} required />
      </div>
      <Field label="Dirección del negocio" icon={<MapPin className="size-4" />} autoComplete="street-address" value={values.address} onChange={set("address")} required />
      <Field label="Categoría" icon={<Tag className="size-4" />} value={values.category} onChange={set("category")} placeholder="Ferretería, ropa, belleza…" required />
      {result && !result.ok ? <Alert tone="error">{result.error}</Alert> : null}
      <Button variant="primary" type="submit" disabled={pending || Object.values(values).some((value) => !value.trim())} className="self-start">
        {pending ? "Enviando…" : "Enviar solicitud"}
      </Button>
    </form>
  );
}
