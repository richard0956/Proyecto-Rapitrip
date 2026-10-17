import { Alert, Badge, Button, DataTable, Field, SelectField } from "@rapitrip/ui";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/shell";
import { dayEndExclusive, dayStart, first, optionalCursor, optionalDay, optionalUuid, queryString, type SearchParams } from "@/lib/filters";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { staffNames } from "@/lib/staff-names";
import { serverSupabase } from "@/lib/supabase";

const pageSchema = z.object({
  has_more: z.boolean(),
  rows: z.array(
    z.object({
      id: z.number(),
      user_id: z.string().nullable(),
      occurred_at: z.string(),
      result: z.enum(["exitoso", "fallido"]),
      provider: z.string().nullable(),
      ip_address: z.string().nullable(),
      user_agent: z.string().nullable(),
    }),
  ),
});

export default async function AccesosPage({ searchParams }: { searchParams: SearchParams }) {
  await requireConsoleAccess("admin");
  const raw = await searchParams;
  const filters = {
    cuenta: optionalUuid.parse(first(raw.cuenta)),
    resultado: z.enum(["exitoso", "fallido"]).optional().catch(undefined).parse(first(raw.resultado)),
    desde: optionalDay.parse(first(raw.desde)),
    hasta: optionalDay.parse(first(raw.hasta)),
  };
  const before = optionalCursor.parse(first(raw.antes));

  const supabase = await serverSupabase();
  const [{ data, error }, staff] = await Promise.all([
    supabase.rpc("login_events_page", {
      p_user: filters.cuenta,
      p_result: filters.resultado,
      p_from: dayStart(filters.desde),
      p_to: dayEndExclusive(filters.hasta),
      p_limit: 50,
      p_before: before,
    }),
    staffNames(),
  ]);
  const parsed = pageSchema.safeParse(data);
  const failed = Boolean(error) || !parsed.success;
  if (failed) console.error("[accesos]", error?.message ?? "formato inesperado");
  const page = parsed.success ? parsed.data : { rows: [], has_more: false };
  const lastId = page.rows.at(-1)?.id;

  return (
    <>
      <PageHeader title="Inicios de sesión" description="Intentos de ingreso exitosos y fallidos. Incluyen la dirección IP, por eso cada consulta queda registrada." />
      <form method="get" className="mb-6 grid gap-4 rounded-tarjeta border border-borde bg-papel p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label="Cuenta del equipo" name="cuenta" defaultValue={filters.cuenta ?? ""}>
          <option value="">Todas</option>
          {staff.people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Resultado" name="resultado" defaultValue={filters.resultado ?? ""}>
          <option value="">Todos</option>
          <option value="exitoso">Exitoso</option>
          <option value="fallido">Fallido</option>
        </SelectField>
        <Field label="Desde" name="desde" type="date" defaultValue={filters.desde} />
        <Field label="Hasta" name="hasta" type="date" defaultValue={filters.hasta} />
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button variant="secondary" type="submit">
            Filtrar
          </Button>
          <Link href="/admin/accesos" className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-hoja underline">
            Limpiar filtros
          </Link>
        </div>
      </form>

      {failed ? <Alert tone="error" className="mb-6">No pudimos cargar los inicios de sesión. Recarga la página.</Alert> : null}
      <DataTable
        caption="Inicios de sesión"
        rows={page.rows}
        rowKey={(row) => row.id}
        emptyTitle="No hay inicios de sesión con esos filtros"
        columns={[
          { header: "Fecha", cell: (row) => formatDateTime(row.occurred_at) },
          { header: "Cuenta", cell: (row) => staff.label(row.user_id) },
          { header: "Resultado", cell: (row) => <Badge tone={row.result === "exitoso" ? "positive" : "alert"}>{row.result}</Badge> },
          { header: "Método", cell: (row) => row.provider ?? "—" },
          { header: "IP", cell: (row) => row.ip_address ?? "—" },
          { header: "Navegador", cell: (row) => <span className="line-clamp-1 max-w-xs" title={row.user_agent ?? undefined}>{row.user_agent ?? "—"}</span> },
        ]}
      />
      <nav aria-label="Paginación" className="mt-4 flex gap-4 text-sm font-bold">
        {before ? (
          <Link href={`/admin/accesos${queryString({ ...filters })}`} className="text-hoja underline">
            Volver a los más recientes
          </Link>
        ) : null}
        {page.has_more && lastId ? (
          <Link href={`/admin/accesos${queryString({ ...filters, antes: lastId })}`} className="text-hoja underline">
            Ver más antiguos
          </Link>
        ) : null}
      </nav>
    </>
  );
}
