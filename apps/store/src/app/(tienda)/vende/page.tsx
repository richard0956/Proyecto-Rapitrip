import { Alert, Card } from "@rapitrip/ui";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { submitCommerceRequest } from "./actions";
import { CommerceForm } from "./commerce-form";

export const metadata = { title: "Vende en Rapitrip", description: "Envía una solicitud para afiliar tu comercio y vender en Rapitrip." };

export default async function VendePage() {
  await requireCustomer("/vende");
  const supabase = await serverSupabase();
  const { data: profile } = await supabase.from("my_profile").select("full_name").maybeSingle();

  return (
    <main className="mx-auto max-w-[1176px] px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-[26px] font-extrabold leading-tight text-tinta">Vende en Rapitrip</h1>
      <p className="mt-1 max-w-[62ch] text-[13.5px] text-tinta-suave">Cuéntanos de tu negocio. El equipo revisa tu solicitud y, con el convenio firmado, activamos tu comercio.</p>
      <Card className="mt-6 max-w-[640px] p-6">
        <Alert className="mb-4">Para enviar la solicitud tu cuenta necesita el correo confirmado. Solo puedes tener una solicitud pendiente a la vez.</Alert>
        <CommerceForm initialName={profile?.full_name ?? ""} submit={submitCommerceRequest} />
      </Card>
    </main>
  );
}
