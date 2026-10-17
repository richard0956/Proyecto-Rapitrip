import { Alert, Card, CardHeader, EmptyState, KpiCard } from "@rapitrip/ui";
import { FileText, Mail, ShieldCheck, Store, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AttentionRow } from "@/components/attention-row";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, label: string) {
  const { count: total, error } = await query;
  if (error) console.error(`[inicio:${label}]`, error.message);
  return error ? null : (total ?? 0);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function AdminHome() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const head = { count: "exact", head: true } as const;
  const [profile, requests, invitations, incidents, commerces] = await Promise.all([
    supabase.from("my_profile").select("full_name").maybeSingle(),
    count(supabase.from("commerce_requests_list").select("*", head).eq("status", "pendiente"), "solicitudes"),
    count(supabase.from("invitations_list").select("*", head).eq("status", "pendiente"), "invitaciones"),
    count(supabase.from("it_incidents_list").select("*", head).neq("status", "resuelto"), "incidentes"),
    count(supabase.from("commerces_list").select("*", head).eq("status", "activo"), "comercios"),
  ]);
  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0];
  const failed = [requests, invitations, incidents, commerces].some((value) => value === null);

  const kpis = [
    { href: "/admin/solicitudes", icon: <FileText className="size-[18px]" />, tone: "menta", label: "Solicitudes pendientes", value: requests, hint: "Comercios que esperan respuesta" },
    { href: "/admin/usuarios", icon: <Mail className="size-[18px]" />, tone: "menta", label: "Invitaciones abiertas", value: invitations, hint: "Personas que aún no aceptan" },
    { href: "/admin/comercios", icon: <Store className="size-[18px]" />, tone: "lavanda", label: "Comercios activos", value: commerces, hint: "Afiliados a Rapitrip" },
    { href: "/admin/incidentes", icon: <TriangleAlert className="size-[18px]" />, tone: "durazno", label: "Incidentes sin resolver", value: incidents, hint: "Abiertos o en atención" },
  ] as const;

  const attention = [
    requests ? { href: "/admin/solicitudes", icon: <FileText className="size-[18px]" />, text: `${plural(requests, "solicitud de comercio pendiente", "solicitudes de comercio pendientes")}` } : null,
    incidents ? { href: "/admin/incidentes", icon: <ShieldCheck className="size-[18px]" />, text: `${plural(incidents, "incidente de TI sin resolver", "incidentes de TI sin resolver")}` } : null,
    invitations ? { href: "/admin/usuarios", icon: <Mail className="size-[18px]" />, text: `${plural(invitations, "invitación esperando respuesta", "invitaciones esperando respuesta")}` } : null,
  ].filter((item) => item !== null);

  return (
    <>
      <PageHeader title={firstName ? `Hola, ${firstName}` : "Hola"} description="Lo que necesita tu atención hoy." />
      {failed ? <Alert tone="error" className="mb-5">Algunos indicadores no se pudieron cargar. Recarga la página.</Alert> : null}
      <ul className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <li key={kpi.href}>
            <Link href={kpi.href} className="group block h-full rounded-tarjeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
              <KpiCard icon={kpi.icon} tone={kpi.tone} label={kpi.label} value={kpi.value ?? "—"} hint={kpi.hint} />
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Requiere tu atención" />
          {attention.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {attention.map((item) => (
                <li key={item.href}>
                  <AttentionRow href={item.href} icon={item.icon}>
                    {item.text}
                  </AttentionRow>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Todo al día">No hay solicitudes, incidentes ni invitaciones pendientes.</EmptyState>
          )}
        </Card>
        <Card className="p-5">
          <CardHeader title="Pedidos, ingresos y catálogo" subtitle="Llegan con las siguientes fases" />
          <Alert tone="warning">Los indicadores de pedidos, ingresos, faltantes y catálogo se activan cuando exista la operación de venta. Mientras tanto, esta vista muestra la administración.</Alert>
        </Card>
      </div>
    </>
  );
}
