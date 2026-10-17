import { Alert, buttonStyles, Card } from "@rapitrip/ui";
import { Store } from "lucide-react";
import Link from "next/link";
import { Steps } from "@/components/steps";

export default function Home() {
  return (
    <main className="mx-auto max-w-[1176px] px-4 py-6 sm:px-8 sm:py-10">
      <section aria-labelledby="titulo" className="relative overflow-hidden rounded-tarjeta bg-hoja px-6 py-12 text-white sm:px-12 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-24 size-72 rounded-full bg-white/10" />
        <div className="relative max-w-xl">
          <h1 id="titulo" className="text-[34px] font-extrabold leading-[1.15] tracking-tight sm:text-[44px]">
            Compra en comercios afiliados y recibe en tu puerta
          </h1>
          <p className="mt-4 text-base text-menta sm:text-lg">Crea tu cuenta para guardar tus datos y hacer tus pedidos cuando el catálogo esté listo.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/registro" className={buttonStyles({ variant: "soft", className: "bg-white text-selva hover:bg-menta" })}>
              Crear cuenta
            </Link>
            <Link href="/ingresar" className={buttonStyles({ variant: "ghost", className: "text-white hover:bg-white/10" })}>
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      <Alert tone="warning" className="mt-5">
        El catálogo de productos llega pronto. Mientras tanto puedes crear tu cuenta o afiliar tu negocio.
      </Alert>

      <section aria-labelledby="vende" className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <div>
          <span aria-hidden="true" className="mb-3 flex size-11 items-center justify-center rounded-boton bg-lavanda text-tinta">
            <Store className="size-5" />
          </span>
          <h2 id="vende" className="text-[26px] font-extrabold leading-tight text-tinta">
            ¿Tienes un negocio?
          </h2>
          <p className="mt-2 max-w-[48ch] text-[13.5px] text-tinta-suave">Afilia tu comercio y vende en Rapitrip. Con la misma cuenta de cliente envías tu solicitud.</p>
          <Link href="/vende" className={buttonStyles({ variant: "primary", className: "mt-5" })}>
            Vende en Rapitrip
          </Link>
        </div>
        <Card className="p-6">
          <h3 className="mb-4 text-base font-bold text-tinta">Cómo afiliar tu comercio</h3>
          <Steps
            items={[
              { title: "Envía tu solicitud", text: "Cuéntanos quién eres y qué vendes. Necesitas una cuenta con el correo confirmado." },
              { title: "Revisamos tus datos", text: "El equipo de Rapitrip revisa la información antes de afiliarte." },
              { title: "Firmamos el convenio", text: "Con el convenio firmado activamos tu comercio y tu cuenta de comercio." },
            ]}
          />
        </Card>
      </section>
    </main>
  );
}
