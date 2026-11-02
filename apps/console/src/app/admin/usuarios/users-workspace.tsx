"use client";

import { Avatar, Badge, Button, Card, DataTable, EmptyState, Field, KpiCard, cn, type Column } from "@rapitrip/ui";
import { ChevronRight, Search, ShieldCheck, Store, UserRoundX, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { roleStatusText, roleStatusTone } from "@/lib/staff";

export type StaffRow = {
  key: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  scope: string;
  status: "activo" | "suspendido" | "revocado";
  isPersonal: boolean;
  since: string;
  isMe: boolean;
};

type Group = "todos" | "personal" | "comercios";
type StatusFilter = "todos" | "activo" | "suspendido" | "revocado";
const selectClass = "min-h-10 rounded-full border border-borde-campo bg-papel px-3.5 text-[13px] font-bold text-tinta";

/** Cuentas con rol: cifras, búsqueda y filtros arriba, la tabla a todo el ancho; cada fila abre la ficha de la persona. */
export function UsersWorkspace({ rows }: { rows: StaffRow[] }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group>("todos");
  const [role, setRole] = useState("todos");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [query, setQuery] = useState("");

  const roles = useMemo(() => [...new Map(rows.map((row) => [row.role, row.roleLabel])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es")), [rows]);
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (group === "todos" || (group === "personal") === row.isPersonal) &&
        (role === "todos" || row.role === role) &&
        (status === "todos" || row.status === status) &&
        (!text || `${row.name} ${row.email} ${row.scope}`.toLowerCase().includes(text)),
    );
  }, [rows, group, role, status, query]);
  const clear = () => {
    setGroup("todos");
    setRole("todos");
    setStatus("todos");
    setQuery("");
  };

  const counts = {
    personal: rows.filter((row) => row.isPersonal && row.status === "activo").length,
    comercios: rows.filter((row) => !row.isPersonal && row.status === "activo").length,
    suspended: rows.filter((row) => row.status === "suspendido").length,
  };

  const columns: Column<StaffRow>[] = [
    {
      header: "Usuario",
      cell: (row) => (
        <Link href={`/admin/usuarios/${row.userId}`} className="flex items-center gap-2.5 rounded-campo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
          <Avatar name={row.name} size="sm" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-bold underline-offset-2 hover:underline">{row.name}</span>
              {row.isMe ? <span className="rounded-full bg-lavanda px-1.5 py-0.5 text-[10px] font-bold text-marino">Tú</span> : null}
            </span>
            <span className="block truncate text-xs text-tinta-suave">{row.email}</span>
          </span>
        </Link>
      ),
    },
    { header: "Rol", cell: (row) => <span className="whitespace-nowrap">{row.roleLabel}</span> },
    { header: "Alcance", cell: (row) => <span className="line-clamp-2 max-w-[16rem]">{row.scope}</span> },
    { header: "Estado", cell: (row) => <Badge tone={roleStatusTone[row.status]}>{roleStatusText[row.status]}</Badge> },
    { header: "Desde", cell: (row) => <span className="whitespace-nowrap tabular-nums text-tinta-suave">{row.since}</span> },
    { header: "", className: "w-px pr-4", cell: () => <ChevronRight aria-hidden="true" className="size-4 text-tinta-suave" /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li><KpiCard icon={<Users className="size-[18px]" />} label="Cuentas con rol" value={rows.length} hint={`${rows.filter((row) => row.status === "activo").length} activas`} /></li>
        <li><KpiCard icon={<ShieldCheck className="size-[18px]" />} tone="lavanda" label="Equipo Rapitrip" value={counts.personal} hint="Dirección, administración, caja y coordinación" /></li>
        <li><KpiCard icon={<Store className="size-[18px]" />} label="Comercios y reparto" value={counts.comercios} hint="Dueños de comercio y repartidores activos" /></li>
        <li><KpiCard icon={<UserRoundX className="size-[18px]" />} tone="durazno" label="Suspendidas" value={counts.suspended} hint="No pueden usar su rol hasta reactivarlas" /></li>
      </ul>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div className="w-full sm:w-72">
            <Field label="Buscar" hideLabel icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre, correo o comercio" />
          </div>
          <select aria-label="Grupo" value={group} onChange={(e) => setGroup(e.target.value as Group)} className={selectClass}>
            <option value="todos">Todas las cuentas</option>
            <option value="personal">Equipo Rapitrip</option>
            <option value="comercios">Comercios y reparto</option>
          </select>
          <select aria-label="Rol" value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
            <option value="todos">Todos los roles</option>
            {roles.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={selectClass}>
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="suspendido">Suspendidos</option>
            <option value="revocado">Revocados</option>
          </select>
          <p role="status" className={cn("text-[13px] text-tinta-suave sm:ml-auto")}>
            {visible.length} de {rows.length} {rows.length === 1 ? "cuenta" : "cuentas"}
          </p>
        </div>
        {visible.length === 0 ? (
          <EmptyState title="Sin resultados">
            <Button variant="secondary" onClick={clear}>
              Limpiar filtros
            </Button>
          </EmptyState>
        ) : (
          <DataTable caption="Cuentas con rol" columns={columns} rows={visible} rowKey={(row) => row.key} emptyTitle="" onRowClick={(row) => router.push(`/admin/usuarios/${row.userId}`)} />
        )}
      </Card>
    </div>
  );
}
