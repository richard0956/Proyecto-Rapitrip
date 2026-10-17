import { Alert, Badge, buttonStyles, Card } from "@rapitrip/ui";
import Link from "next/link";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { submitCommerceRequest } from "./actions";
import { CommerceForm } from "./commerce-form";

export const metadata = { title: "Vende en Rapitrip", description: "Envía una solicitud para afiliar tu comercio y vender en Rapitrip." };

const fecha = new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "America/Managua" });

export default async function VendePage() {
  await requireCustomer("/vende");
  const supabase = await serverSupabase();
  const [{ data: profile }, { data: requests }] = await Promise.all([
    supabase.from("my_profile").select("full_name").maybeSingle(),
    supabase.from("my_commerce_requests").select("*").order("created_at", { ascending: false }).limit(1),
  ]);
  const last = requests?.[0];
  const blocking = last?.status === "pendiente" || last?.status === "aprobada";

  return (
    <main className="mx-auto max-w-[1176px] px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Vende en Rapitrip</h1>
      <p className="mt-1 max-w-[62ch] text-[13.5px] text-tinta-suave">Cuéntanos de tu negocio. El equipo revisa tu solicitud y, con el convenio firmado, activamos tu comercio.</p>
      {last ? (
        <Card outerClassName="mt-6 max-w-[640px]" className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-tight text-tinta">{last.business_name}</h2>
              <p className="text-xs text-tinta-suave">Solicitud enviada el {last.created_at ? fecha.format(new Date(last.created_at)) : "—"}</p>
            </div>
            <Badge tone={last.status === "aprobada" ? "positive" : last.status === "rechazada" ? "danger" : "warning"}>
              {last.status === "aprobada" ? "Aprobada" : last.status === "rechazada" ? "Rechazada" : "En revisión"}
            </Badge>
          </div>
          {last.status === "pendiente" ? <Alert className="mt-4">El equipo de Rapitrip está revisando tu solicitud. Te avisaremos por correo cuando haya una decisión.</Alert> : null}
          {last.status === "aprobada" ? <Alert className="mt-4">Tu comercio fue aprobado. Revisa tu correo: ahí están los pasos para ingresar a la consola de comercio.</Alert> : null}
          {last.status === "rechazada" ? (
            <Alert tone="warning" className="mt-4">
              No pudimos afiliar tu comercio{last.decision_reason ? `: ${last.decision_reason}` : "."} Puedes corregir los datos y enviar una solicitud nueva.
            </Alert>
          ) : null}
          {blocking ? (
            <Link href="/" className={buttonStyles({ variant: "secondary", className: "mt-5" })}>
              Volver al inicio
            </Link>
          ) : null}
        </Card>
      ) : null}

      {!blocking ? (
        <Card outerClassName="mt-6 max-w-[640px]" className="p-6 sm:p-8">
          <Alert className="mb-4">Para enviar la solicitud tu cuenta necesita el correo confirmado. Solo puedes tener una solicitud pendiente a la vez.</Alert>
          <CommerceForm initialName={profile?.full_name ?? ""} submit={submitCommerceRequest} />
        </Card>
      ) : null}
    </main>
  );
}
