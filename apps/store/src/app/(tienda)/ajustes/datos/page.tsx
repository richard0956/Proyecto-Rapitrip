import { buttonStyles } from "@rapitrip/ui";
import { Download, FileJson, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { SectionCard } from "../section-card";
import { cancelDeletion, requestDeletion } from "./actions";
import { DeletionCard } from "./deletion-card";

export const metadata = { title: "Mis datos" };

/** Mis datos: descargar lo que Rapitrip guarda de la cuenta y pedir que se elimine. */
export default async function DatosPage() {
  await requireCustomer("/ajustes/datos");
  const supabase = await serverSupabase();
  const [{ data: profile }, { data: requests }] = await Promise.all([
    supabase.from("my_profile").select("id").maybeSingle(),
    supabase.from("my_deletion_requests").select("status, created_at, resolution_note").order("created_at", { ascending: false }).limit(1),
  ]);
  if (!profile) redirect(`/ingresar?next=${encodeURIComponent("/ajustes/datos")}&expirada=1`);
  const last = requests?.[0];

  return (
    <div className="flex flex-col gap-5">
      <SectionCard icon={<FileJson className="size-5" />} title="Descargar mis datos" text="Un archivo con tu perfil, direcciones, pedidos y solicitudes." id="descargar">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde">
          <p className="max-w-[52ch] text-[13px] text-tinta-suave">Se descarga al momento en formato JSON. Contiene datos personales: guárdalo en un lugar seguro.</p>
          <a href="/ajustes/datos/descargar" download className={buttonStyles({ variant: "secondary", className: "shrink-0" })}>
            <Download aria-hidden="true" className="size-4" />
            Descargar
          </a>
        </div>
      </SectionCard>

      <SectionCard icon={<Trash2 className="size-5" />} title="Eliminar mi cuenta" text="El equipo de Rapitrip revisa la solicitud y la atiende." id="eliminar">
        <DeletionCard last={last ? { status: last.status ?? "", created_at: last.created_at ?? new Date().toISOString(), resolution_note: last.resolution_note } : null} actions={{ request: requestDeletion, cancel: cancelDeletion }} />
      </SectionCard>
    </div>
  );
}
