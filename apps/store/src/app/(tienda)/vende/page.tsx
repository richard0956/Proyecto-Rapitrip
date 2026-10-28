import { Alert, buttonStyles, Reveal } from "@rapitrip/ui";
import { BadgeCheck, CircleCheck, Clock, IdCard, MailCheck, Phone, Store, XCircle } from "lucide-react";
import Link from "next/link";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { submitCommerceRequest } from "./actions";
import { CommerceForm } from "./commerce-form";

export const metadata = { title: "Vende en Rapitrip", description: "Envía una solicitud para afiliar tu comercio y vender en Rapitrip." };

const fecha = new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "America/Managua" });

const steps = [
  { title: "Envía tu solicitud", text: "Con los datos de tu negocio y tu documento." },
  { title: "Revisamos tus datos", text: "El equipo de Rapitrip valida la información." },
  { title: "Firmamos y activamos", text: "Con el convenio firmado, tu comercio queda en línea." },
];

const requirements = [
  { icon: MailCheck, text: "Cuenta con el correo confirmado" },
  { icon: IdCard, text: "Cédula (vendedor propio) o RUC (empresa)" },
  { icon: Phone, text: "Teléfono y correo de contacto" },
  { icon: Clock, text: "Una solicitud pendiente a la vez" },
];

const card = "rounded-[2rem] bg-superficie p-6 shadow-[0_30px_60px_-44px_rgb(6_54_42/0.45)] ring-1 ring-selva/[0.05] sm:p-8";

/**
 * «Vende en Rapitrip»: panel de marca fijo a la izquierda (qué es, los tres pasos y lo que se necesita) y, a la derecha, el
 * estado de la última solicitud y el formulario. En móvil el panel va arriba y el formulario debajo.
 */
export default async function VendePage() {
  await requireCustomer("/vende");
  const supabase = await serverSupabase();
  const [{ data: profile }, { data: requests }] = await Promise.all([
    supabase.from("my_profile").select("full_name").maybeSingle(),
    supabase.from("my_commerce_requests").select("*").order("created_at", { ascending: false }).limit(1),
  ]);
  const last = requests?.[0];
  const blocking = last?.status === "pendiente" || last?.status === "aprobada";
  const status =
    last?.status === "aprobada"
      ? { label: "Aprobada", icon: BadgeCheck, tone: "bg-menta text-exito" }
      : last?.status === "rechazada"
        ? { label: "Rechazada", icon: XCircle, tone: "bg-rosa text-rojo" }
        : { label: "En revisión", icon: Clock, tone: "bg-calido text-durazno-texto" };

  return (
    <main className="mx-auto grid max-w-[1180px] grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <aside className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(165deg,var(--panel)_0%,#0d5644_60%,#14705a_100%)] p-7 text-white dark:bg-[linear-gradient(165deg,#0b1a2e_0%,#0b2236_60%,#0e2c3a_100%)] sm:p-9 lg:sticky lg:top-28">
        <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-esmeralda/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 -left-16 -z-10 size-72 rounded-full bg-marino/50 blur-3xl dark:bg-marino/15" />
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-esmeralda ring-1 ring-white/15">
            <Store aria-hidden="true" className="size-3.5" /> Para comercios
          </p>
          <h1 className="mt-4 text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-[40px]">Vende en Rapitrip</h1>
          <p className="mt-3 max-w-[42ch] text-[14.5px] leading-relaxed text-nav-texto">
            Lleva tus productos a más clientes. Tú vendes; nosotros coordinamos la entrega hasta la puerta de cada pedido.
          </p>
        </Reveal>

        <Reveal index={1}>
          <ol className="mt-8 flex flex-col">
            {steps.map((step, index) => (
              <li key={step.title} className="relative flex gap-4 pb-5 last:pb-0">
                {index < steps.length - 1 ? <span aria-hidden="true" className="absolute left-[15px] top-9 h-[calc(100%-2.5rem)] w-px bg-white/20" /> : null}
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-esmeralda text-[13px] font-extrabold text-panel">
                  {index + 1}
                </span>
                <div className="pt-0.5">
                  <p className="text-[15px] font-bold">{step.title}</p>
                  <p className="mt-0.5 text-[13px] text-nav-texto/80">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal index={2}>
          <div className="mt-8 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
            <p className="text-[13px] font-bold">Lo que necesitas</p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {requirements.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-[13px] text-nav-texto">
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-esmeralda" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        {last ? (
          <section aria-labelledby="estado" className={card}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-tinta-suave">Tu última solicitud</p>
                <h2 id="estado" className="mt-1 truncate text-[20px] font-bold tracking-tight text-tinta">
                  {last.business_name}
                </h2>
                <p className="mt-0.5 text-[13px] text-tinta-suave">Enviada el {last.created_at ? fecha.format(new Date(last.created_at)) : "—"}</p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold ${status.tone}`}>
                <status.icon aria-hidden="true" className="size-4" />
                {status.label}
              </span>
            </div>
            {last.status === "pendiente" ? <Alert className="mt-5">El equipo de Rapitrip está revisando tu solicitud. Te avisaremos por correo cuando haya una decisión.</Alert> : null}
            {last.status === "aprobada" ? <Alert className="mt-5">Tu comercio fue aprobado. Revisa tu correo: ahí están los pasos para ingresar a la consola de comercio.</Alert> : null}
            {last.status === "rechazada" ? (
              <Alert tone="warning" className="mt-5">
                No pudimos afiliar tu comercio{last.decision_reason ? `: ${last.decision_reason}` : "."} Puedes corregir los datos y enviar una solicitud nueva.
              </Alert>
            ) : null}
            {blocking ? (
              <Link href="/" className={buttonStyles({ variant: "secondary", className: "mt-5" })}>
                Volver al inicio
              </Link>
            ) : null}
          </section>
        ) : null}

        {!blocking ? (
          <section aria-label="Solicitud de afiliación" className={card}>
            <div className="mb-6 flex items-start gap-3 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-hoja" />
              <p className="text-[13px] leading-relaxed text-tinta-suave">
                Para enviar la solicitud tu cuenta necesita el correo confirmado. Solo puedes tener una solicitud pendiente a la vez.
              </p>
            </div>
            <CommerceForm initialName={profile?.full_name ?? ""} submit={submitCommerceRequest} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
