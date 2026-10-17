import { Alert, Card } from "@rapitrip/ui";
import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, label: string) {
  const { count: total, error } = await query;
  if (error) console.error(`[inicio:${label}]`, error.message);
  return error ? null : (total ?? 0);
}

export default async function AdminHome() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const head = { count: "exact", head: true } as const;
  const [requests, invitations, incidents] = await Promise.all([
    count(supabase.from("commerce_requests_list").select("*", head).eq("status", "pendiente"), "solicitudes"),
    count(supabase.from("invitations_list").select("*", head).eq("status", "pendiente"), "invitaciones"),
    count(supabase.from("it_incidents_list").select("*", head).neq("status", "resuelto"), "incidentes"),
  ]);
  const cards = [
    { label: "Solicitudes de comercio pendientes", value: requests, href: "/admin/solicitudes" },
    { label: "Invitaciones abiertas", value: invitations, href: "/admin/usuarios" },
    { label: "Incidentes sin resolver", value: incidents, href: "/admin/incidentes" },
  ];

  return (
    <>
      <PageHeader title="Inicio" description="Lo que necesita tu atención hoy." />
      {cards.some((card) => card.value === null) ? <Alert tone="error" className="mb-6">Algunos indicadores no se pudieron cargar.</Alert> : null}
      <ul className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <Link href={card.href} className="block rounded-tarjeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
              <Card className="h-full hover:border-menta-borde">
                <p className="font-titulo text-4xl text-selva">{card.value ?? "—"}</p>
                <p className="mt-1 text-sm font-bold text-tinta-suave">{card.label}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
