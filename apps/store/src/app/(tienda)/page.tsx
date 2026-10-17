import { Alert, buttonStyles, ButtonIsland, Card, Eyebrow, Reveal } from "@rapitrip/ui";
import { Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { HeroVisual } from "@/components/hero-visual";
import { Steps } from "@/components/steps";

const guarantees = ["Confirmamos tu correo antes de activar la cuenta", "Ingresas con tu correo o con tu cuenta de Google", "Cada persona ve solo lo que su rol permite"];

export default function Home() {
  return (
    <main className="mx-auto max-w-[1040px] px-4 sm:px-8">
      <section aria-labelledby="titulo" className="grid grid-cols-1 items-center gap-10 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12 lg:py-6">
        <div>
          <Reveal>
            <Eyebrow>Tu tienda cerca de ti</Eyebrow>
          </Reveal>
          <Reveal index={1}>
            <h1 id="titulo" className="mt-5 text-[36px] font-bold leading-[1.06] tracking-tight text-selva sm:text-[44px] lg:text-[48px]">
              Compra en comercios afiliados y <span className="text-hoja">recibe en tu puerta</span>
            </h1>
          </Reveal>
          <Reveal index={2}>
            <p className="mt-4 max-w-[46ch] text-[15.5px] leading-relaxed text-tinta-suave">Crea tu cuenta para guardar tus datos y hacer tus pedidos cuando el catálogo esté listo.</p>
          </Reveal>
          <Reveal index={3} className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/registro" className={buttonStyles({ variant: "primary", className: "min-h-11 pr-5" })}>
              Crear cuenta
              <ButtonIsland />
            </Link>
            <Link href="/ingresar" className={buttonStyles({ variant: "secondary", className: "min-h-11" })}>
              Ya tengo cuenta
            </Link>
          </Reveal>
        </div>
        <Reveal index={2}>
          <HeroVisual />
        </Reveal>
      </section>

      <section aria-labelledby="vende" className="grid grid-cols-1 gap-5 py-10 lg:grid-cols-12 lg:py-16">
        <Reveal className="lg:col-span-7">
          <Card outerClassName="h-full" className="p-6 sm:p-8">
            <Eyebrow>Para comercios</Eyebrow>
            <h2 id="vende" className="mt-4 text-[26px] font-bold leading-tight tracking-tight text-selva sm:text-[32px]">
              ¿Tienes un negocio?
            </h2>
            <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-tinta-suave">Afilia tu comercio y vende en Rapitrip. Con la misma cuenta de cliente envías tu solicitud.</p>
            <div className="mt-6">
              <Steps
                items={[
                  { title: "Envía tu solicitud", text: "Cuéntanos quién eres y qué vendes. Necesitas una cuenta con el correo confirmado." },
                  { title: "Revisamos tus datos", text: "El equipo de Rapitrip revisa la información antes de afiliarte." },
                  { title: "Firmamos el convenio", text: "Con el convenio firmado activamos tu comercio y tu cuenta de comercio." },
                ]}
              />
            </div>
            <Link href="/vende" className={buttonStyles({ variant: "primary", className: "mt-7 min-h-11 pr-5" })}>
              Vende en Rapitrip
              <ButtonIsland />
            </Link>
          </Card>
        </Reveal>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <Reveal index={1} className="flex-1">
            <div className="h-full rounded-concha bg-selva/[0.05] p-1.5 shadow-suave ring-1 ring-selva/10">
              <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(1.75rem-0.375rem)] bg-selva p-6 text-white sm:p-7">
                <div aria-hidden="true" className="absolute -right-16 -top-16 size-56 rounded-full bg-esmeralda/20" />
                <span aria-hidden="true" className="relative flex size-11 items-center justify-center rounded-full bg-esmeralda text-selva">
                  <ShieldCheck className="size-5" />
                </span>
                <h2 className="relative mt-4 text-[22px] font-bold leading-tight tracking-tight">Tu cuenta, protegida</h2>
                <ul className="relative mt-5 flex flex-col gap-3.5">
                  {guarantees.map((text) => (
                    <li key={text} className="flex items-start gap-3 text-[14px] text-nav-texto">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-esmeralda" strokeWidth={2.5} />
                      {text}
                    </li>
                  ))}
                </ul>
                <div className="min-h-8 flex-1" />
                <Link href="/registro" className={buttonStyles({ variant: "soft", className: "relative mt-auto self-start bg-papel pr-5 text-selva hover:bg-menta" })}>
                  Crear cuenta
                  <ButtonIsland variant="soft" />
                </Link>
              </div>
            </div>
          </Reveal>
          <Reveal index={2}>
            <Alert tone="warning">El catálogo de productos llega pronto. Mientras tanto puedes crear tu cuenta o afiliar tu negocio.</Alert>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
