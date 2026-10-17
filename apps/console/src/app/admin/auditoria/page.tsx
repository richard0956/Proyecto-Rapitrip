import { Alert, Badge, Button, DataTable, Field, SelectField } from "@rapitrip/ui";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/shell";
import { dayEndExclusive, dayStart, first, optionalCursor, optionalDay, optionalText, optionalUuid, queryString, type SearchParams } from "@/lib/filters";
import { formatDateTime, roleLabel } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { staffNames } from "@/lib/staff-names";
import { serverSupabase } from "@/lib/supabase";

const pageSchema = z.object({
  has_more: z.boolean(),
  rows: z.array(
    z.object({
      id: z.number(),
      occurred_at: z.string(),
      actor_id: z.string().nullable(),
      actor_role: z.string().nullable(),
      action: z.string(),
      target_type: z.string().nullable(),
      target_id: z.string().nullable(),
      reason: z.string().nullable(),
      metadata: z.record(z.unknown()).nullable(),
    }),
  ),
});

export default async function AuditoriaPage({ searchParams }: { searchParams: SearchParams }) {
  await requireConsoleAccess("admin");
  const raw = await searchParams;
  const filters = {
    accion: optionalText().parse(first(raw.accion)),
    actor: optionalUuid.parse(first(raw.actor)),
    objeto: optionalText().parse(first(raw.objeto)),
    desde: optionalDay.parse(first(raw.desde)),
    hasta: optionalDay.parse(first(raw.hasta)),
  };
  const before = optionalCursor.parse(first(raw.antes));

  const supabase = await serverSupabase();
  const [{ data, error }, staff] = await Promise.all([
    supabase.rpc("audit_events_page", {
      p_action: filters.accion,
      p_actor: filters.actor,
      p_target_type: filters.objeto,
      p_from: dayStart(filters.desde),
      p_to: dayEndExclusive(filters.hasta),
      p_limit: 50,
      p_before: before,
    }),
    staffNames(),
  ]);
  const parsed = pageSchema.safeParse(data);
  const failed = Boolean(error) || !parsed.success;
  if (failed) console.error("[auditoria]", error?.message ?? "formato inesperado");
  const page = parsed.success ? parsed.data : { rows: [], has_more: false };
  const lastId = page.rows.at(-1)?.id;

  return (
    <>
      <PageHeader title="Auditoría" description="Registro de las acciones del sistema. Consultarlo también queda registrado." />
      <form method="get" className="mb-6 grid gap-4 rounded-tarjeta border border-borde bg-papel p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Acción" name="accion" defaultValue={filters.accion} placeholder="role.suspended" />
        <SelectField label="Persona" name="actor" defaultValue={filters.actor ?? ""}>
          <option value="">Todas</option>
          {staff.people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </SelectField>
        <Field label="Objeto" name="objeto" defaultValue={filters.objeto} placeholder="profile" />
        <Field label="Desde" name="desde" type="date" defaultValue={filters.desde} />
        <Field label="Hasta" name="hasta" type="date" defaultValue={filters.hasta} />
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button variant="secondary" type="submit">
            Filtrar
          </Button>
          <Link href="/admin/auditoria" className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-hoja underline">
            Limpiar filtros
          </Link>
        </div>
      </form>

      {failed ? <Alert tone="error" className="mb-6">No pudimos cargar la auditoría. Recarga la página.</Alert> : null}
      <DataTable
        caption="Eventos de auditoría"
        rows={page.rows}
        rowKey={(row) => row.id}
        emptyTitle="No hay eventos con esos filtros"
        columns={[
          { header: "Fecha", cell: (row) => formatDateTime(row.occurred_at) },
          {
            header: "Persona",
            cell: (row) => (
              <span>
                {staff.label(row.actor_id)}
                {row.actor_role ? <span className="block text-xs text-tinta-suave">{roleLabel[row.actor_role] ?? row.actor_role}</span> : null}
              </span>
            ),
          },
          { header: "Acción", cell: (row) => <Badge>{row.action}</Badge> },
          { header: "Objeto", cell: (row) => (row.target_type ? `${row.target_type}${row.target_id ? ` · ${row.target_id.slice(0, 8)}` : ""}` : "—") },
          {
            header: "Detalle",
            cell: (row) => (
              <details>
                <summary className="cursor-pointer font-bold text-hoja">{row.reason ? row.reason.slice(0, 40) : "Ver"}</summary>
                {row.reason ? <p className="mt-1 max-w-sm">{row.reason}</p> : null}
                <pre className="mt-1 max-w-sm overflow-x-auto text-xs">{JSON.stringify(row.metadata ?? {}, null, 1)}</pre>
              </details>
            ),
          },
        ]}
      />
      <nav aria-label="Paginación" className="mt-4 flex gap-4 text-sm font-bold">
        {before ? (
          <Link href={`/admin/auditoria${queryString({ ...filters })}`} className="text-hoja underline">
            Volver a los más recientes
          </Link>
        ) : null}
        {page.has_more && lastId ? (
          <Link href={`/admin/auditoria${queryString({ ...filters, antes: lastId })}`} className="text-hoja underline">
            Ver más antiguos
          </Link>
        ) : null}
      </nav>
    </>
  );
}
