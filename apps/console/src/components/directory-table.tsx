"use client";

import { Avatar, Badge, Button, Card, DataTable, EmptyState, Field, pillStyles, type Column } from "@rapitrip/ui";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { filterDirectory, statusCounts, type DirectoryRow, type StatusFilter } from "@/lib/directory";

const chips: { key: StatusFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "activo", label: "Activos" },
  { key: "suspendido", label: "Suspendidos" },
];

type Props = {
  rows: DirectoryRow[];
  /** «empresa» muestra el RUC; «informal» (vendedor propio) no tiene. */
  kind: "empresa" | "informal";
  noun: { one: string; many: string };
  /** Los enlaces de cada fila van a `${detailBase}/${id}`. */
  detailBase: string;
};

/** Directorio con barra de filtros: búsqueda instantánea (sin acentos, por nombre o RUC) y filtro por estado. */
export function DirectoryTable({ rows, kind, noun, detailBase }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const counts = useMemo(() => statusCounts(rows), [rows]);
  const visible = useMemo(() => filterDirectory(rows, { query, status }), [rows, query, status]);

  const columns: Column<DirectoryRow>[] = [
    {
      header: kind === "empresa" ? "Comercio" : "Vendedor",
      cell: (row) => (
        <Link href={`${detailBase}/${row.id}`} className="flex items-center gap-2.5 rounded-campo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
          <Avatar name={row.name} size="sm" />
          <span className="font-bold underline-offset-2 hover:underline">{row.name}</span>
        </Link>
      ),
    },
    ...(kind === "empresa" ? [{ header: "RUC", cell: (row: DirectoryRow) => <span className="whitespace-nowrap tabular-nums">{row.ruc ?? "—"}</span> }] : []),
    { header: "Estado", cell: (row) => <Badge tone={row.status === "activo" ? "positive" : "danger"}>{row.status === "activo" ? "Activo" : "Suspendido"}</Badge> },
    { header: "Tiendas activas", cell: (row) => <span className="tabular-nums">{row.stores}</span> },
    { header: "Cuentas activas", cell: (row) => <span className="tabular-nums">{row.accounts}</span> },
    { header: "Alta", cell: (row) => row.createdAt },
  ];

  return (
    <Card className="p-5">
      {rows.length === 0 ? (
        <EmptyState title={`Todavía no hay ${noun.many}`}>Aparecen aquí cuando apruebas una solicitud de afiliación de este tipo.</EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-full sm:max-w-sm">
              <Field type="search" label={`Buscar ${noun.one}`} hideLabel icon={<Search className="size-4" />} placeholder={kind === "empresa" ? "Buscar por nombre o RUC…" : "Buscar por nombre…"} value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button key={chip.key} type="button" aria-pressed={status === chip.key} onClick={() => setStatus(chip.key)} className={pillStyles(status === chip.key)}>
                  {chip.label} · {counts[chip.key]}
                </button>
              ))}
            </div>
            <p role="status" className="ml-auto text-[13px] text-tinta-suave">
              {visible.length} de {rows.length} {rows.length === 1 ? noun.one : noun.many}
            </p>
          </div>
          {visible.length === 0 ? (
            <EmptyState title={`Ningún ${noun.one} coincide`}>
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setStatus("todos");
                }}
              >
                Limpiar filtros
              </Button>
            </EmptyState>
          ) : (
            <DataTable caption={kind === "empresa" ? "Comercios" : "Vendedores"} columns={columns} rows={visible} rowKey={(row) => row.id} emptyTitle="" />
          )}
        </>
      )}
    </Card>
  );
}
