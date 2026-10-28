"use client";

import { Alert, Button, buttonStyles, Field, TextareaField } from "@rapitrip/ui";
import { Building2, Check, CheckCircle2, FileText, IdCard, Mail, MapPin, Smartphone, Store, Tag, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Steps } from "@/components/steps";
import { saveDraft, takeDraft } from "@/lib/draft";
import type { CustomerResult } from "@/lib/result";

const DRAFT_KEY = "rapitrip:vende";
type Kind = "informal" | "empresa";
type Values = { businessKind: Kind; ruc: string; cedula: string; businessName: string; contactName: string; phone: string; email: string; address: string; category: string; description: string };
const empty: Values = { businessKind: "informal", ruc: "", cedula: "", businessName: "", contactName: "", phone: "", email: "", address: "", category: "", description: "" };

const kinds: { value: Kind; title: string; text: string; icon: LucideIcon }[] = [
  { value: "informal", title: "Vendedor propio", text: "Vendes por tu cuenta. Te pedimos tu cédula.", icon: Store },
  { value: "empresa", title: "Empresa", text: "Negocio formal. Te pedimos el número RUC.", icon: Building2 },
];

/** Grupo numerado del formulario: número en un círculo, título, una línea de ayuda y sus campos. */
function Group({ number, title, text, children }: { number: number; title: string; text: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-borde pt-6 first:border-t-0 first:pt-0">
      <legend className="contents">
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-menta text-[12px] font-extrabold text-hoja">
            {number}
          </span>
          <span className="text-[16px] font-bold tracking-tight text-tinta">{title}</span>
        </span>
      </legend>
      <p className="-mt-2 pl-10 text-[13px] text-tinta-suave">{text}</p>
      {children}
    </fieldset>
  );
}

/**
 * Formulario de afiliación en cuatro grupos (tipo de vendedor, negocio, contacto y descripción) con una barra de avance de los
 * campos obligatorios. El tipo se elige con dos tarjetas: el vendedor propio pide cédula y la empresa, RUC.
 */
export function CommerceForm({ initialName, submit }: { initialName: string; submit: (values: Values) => Promise<CustomerResult> }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ ...empty, contactName: initialName });
  const [result, setResult] = useState<CustomerResult | null>(null);
  const [restored, setRestored] = useState(false);
  const [pending, start] = useTransition();
  const set = (key: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const empresa = values.businessKind === "empresa";
  // El RUC solo se pide a las empresas; la cédula, solo al vendedor propio.
  const required = (Object.keys(values) as (keyof Values)[]).filter((key) => key !== "businessKind" && (key === "ruc" ? empresa : key === "cedula" ? !empresa : true));
  const done = required.filter((key) => values[key].trim()).length;
  const missing = done < required.length;

  useEffect(() => {
    const draft = takeDraft<Values>(DRAFT_KEY);
    if (draft) {
    // Leer el borrador de sessionStorage solo es posible tras hidratar: es sincronizar con un sistema externo del navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues({ ...empty, ...draft });
      setRestored(true);
    }
  }, []);

  function chooseKind(kind: Kind) {
    setValues((v) => ({ ...v, businessKind: kind, ruc: kind === "empresa" ? v.ruc : "", cedula: kind === "empresa" ? "" : v.cedula }));
  }

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
      <div className="flex flex-col gap-6">
        <div role="status" className="flex items-start gap-4 rounded-2xl bg-menta/60 p-5 ring-1 ring-menta-borde">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-hoja text-sobre-acento">
            <CheckCircle2 className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold text-tinta">Solicitud enviada</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-tinta-suave">
              Recibimos la solicitud de «{values.businessName}» ({empresa ? "empresa con RUC" : "vendedor propio"}). Te avisaremos a {values.email} cuando la revisemos.
            </p>
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
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {/* Avance de los campos obligatorios: anima el formulario sin bloquear nada. */}
      <div>
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="font-semibold text-tinta">Tu solicitud</span>
          <span className="text-tinta-suave" aria-live="polite">
            {done} de {required.length} campos
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-crema" aria-hidden="true">
          <div className="h-full rounded-full bg-hoja transition-[width] duration-500 ease-fluido" style={{ width: `${(done / required.length) * 100}%` }} />
        </div>
      </div>

      {restored ? <Alert>Recuperamos lo que escribiste. Revisa y envía la solicitud.</Alert> : null}

      <Group number={1} title="Tipo de vendedor" text="Elige cómo vendes; de eso depende el documento que te pedimos.">
        <div role="radiogroup" aria-label="Tipo de vendedor" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kinds.map((kind) => {
            const checked = values.businessKind === kind.value;
            return (
              <label
                key={kind.value}
                className={`relative flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 transition-[background-color,box-shadow] duration-300 ease-fluido has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-hoja ${
                  checked ? "bg-menta/60 ring-2 ring-hoja" : "bg-crema/60 ring-borde hover:ring-borde-campo"
                }`}
              >
                <input type="radio" name="businessKind" value={kind.value} checked={checked} onChange={() => chooseKind(kind.value)} className="sr-only" />
                <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${checked ? "bg-hoja text-sobre-acento" : "bg-superficie text-hoja"}`}>
                  {createElement(kind.icon, { className: "size-5" })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold text-tinta">{kind.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-tinta-suave">{kind.text}</span>
                </span>
                <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors ${checked ? "bg-hoja text-sobre-acento" : "ring-1 ring-borde-campo"}`}>
                  {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
              </label>
            );
          })}
        </div>
      </Group>

      <Group number={2} title="Tu negocio" text="Así aparecerá tu comercio en Rapitrip.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {empresa ? (
            <Field label="Número RUC" icon={<FileText className="size-4" />} value={values.ruc} onChange={set("ruc")} autoComplete="off" placeholder="J0310000000000" hint="Entre 8 y 20 letras o números, sin espacios." required />
          ) : (
            <Field label="Número de cédula" icon={<IdCard className="size-4" />} value={values.cedula} onChange={set("cedula")} autoComplete="off" placeholder="001-010190-0000A" hint="Entre 8 y 20 letras o números." required />
          )}
          <Field label="Nombre del negocio" icon={<Building2 className="size-4" />} value={values.businessName} onChange={set("businessName")} required />
          <Field label="Categoría" icon={<Tag className="size-4" />} value={values.category} onChange={set("category")} placeholder="Tecnología, muebles, ropa…" required />
          <Field label="Dirección del negocio" icon={<MapPin className="size-4" />} autoComplete="street-address" value={values.address} onChange={set("address")} required />
        </div>
      </Group>

      <Group number={3} title="Contacto" text="Te escribimos aquí para avisarte de la revisión.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={empresa ? "Representante" : "Nombre completo"} icon={<UserRound className="size-4" />} autoComplete="name" value={values.contactName} onChange={set("contactName")} required />
          <Field label="Teléfono" icon={<Smartphone className="size-4" />} type="tel" autoComplete="tel" value={values.phone} onChange={set("phone")} required />
          <div className="sm:col-span-2">
            <Field label="Correo electrónico" icon={<Mail className="size-4" />} type="email" autoComplete="email" value={values.email} onChange={set("email")} required />
          </div>
        </div>
      </Group>

      <Group number={4} title="Cuéntanos más" text="Qué vendes y cómo trabajas; ayuda al equipo a revisarte más rápido.">
        <TextareaField
          label="Describe tu negocio y los productos que ofreces"
          maxLength={500}
          value={values.description}
          onChange={set("description")}
          placeholder={empresa ? "Tipo de empresa, giro y productos que ofertan" : "Qué vendes, cómo trabajas y qué productos ofreces"}
          required
        />
        <p className="-mt-2 text-right text-[12px] text-tinta-suave">{values.description.length} de 500 caracteres</p>
      </Group>

      {result && !result.ok ? <Alert tone="error">{result.error}</Alert> : null}
      <div className="flex flex-col gap-3 border-t border-borde pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-tinta-suave">{missing ? "Completa todos los campos para enviar." : "Todo listo: revisa tus datos y envía."}</p>
        <Button variant="primary" type="submit" disabled={pending || missing} arrow className="sm:min-w-[200px]">
          {pending ? "Enviando…" : "Enviar solicitud"}
        </Button>
      </div>
    </form>
  );
}
