"use client";

import { Alert, Avatar, Badge, Button, Card, DataTable, EmptyState, Field, HBarList, KpiCard, pillStyles, type Column } from "@rapitrip/ui";
import { Banknote, Bike, CheckCheck, Plus, Route, Search, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ActionResult } from "@/lib/action-error";
import { courierCounts, courierTotals, filterCouriers, formatKm, formatMinutes, rankCouriers, type CourierFilters, type CourierStat } from "@/lib/couriers";
import { formatMoney } from "@/lib/money";
import { NewCourierDialog, type CourierValues } from "./new-courier-dialog";

type Props = {
  rows: CourierStat[];
  /** Ruta de la lista: la ficha de cada repartidor está en `${basePath}/${id}`. */
  basePath: string;
  periodLabel: string;
  /** Solo el administrador crea repartidores: sin esta función no aparece el botón. */
  create?: (values: CourierValues) => Promise<ActionResult>;
};

const statusChips: { key: CourierFilters["status"]; label: string; count: "todos" | "activo" | "inactivo" }[] = [
  { key: "todos", label: "Todos", count: "todos" },
  { key: "activo", label: "Activos", count: "activo" },
  { key: "inactivo", label: "Inactivos", count: "inactivo" },
];

/** Flota de repartidores: cifras del periodo, los mejores en cada métrica y una tabla con búsqueda y filtro de estado. */
export function CouriersBoard({ rows, basePath, periodLabel, create }: Props) {
  const [filters, setFilters] = useState<CourierFilters>({ query: "", status: "todos" });
  const [creating, setCreating] = useState(false);
  const totals = useMemo(() => courierTotals(rows), [rows]);
  const counts = useMemo(() => courierCounts(rows), [rows]);
  const visible = useMemo(() => filterCouriers(rows, filters), [rows, filters]);

  const columns: Column<CourierStat>[] = [
    {
      header: "Repartidor",
      cell: (row) => (
        <Link href={`${basePath}/${row.id}`} className="flex items-center gap-2.5 rounded-campo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
          <Avatar name={row.name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-bold underline-offset-2 hover:underline">{row.name}</span>
            <span className="block truncate text-xs text-tinta-suave">{row.vehicle} · {row.phone}</span>
          </span>
        </Link>
      ),
    },
    { header: "Estado", cell: (row) => <Badge tone={row.status === "activo" ? "positive" : "warning"}>{row.status === "activo" ? "Activo" : "Inactivo"}</Badge> },
    { header: `Entregas (${periodLabel})`, cell: (row) => <span className="tabular-nums">{row.deliveries}</span> },
    { header: "Kilómetros", cell: (row) => <span className="tabular-nums">{formatKm(row.km)}</span> },
    { header: "Tiempo promedio", cell: (row) => <span className="tabular-nums">{formatMinutes(row.avgMinutes)}</span> },
    { header: "En curso", cell: (row) => <span className="tabular-nums">{row.activeOrders}</span> },
    { header: "Efectivo por rendir", cell: (row) => <span className="tabular-nums">{row.cashPending > 0 ? formatMoney(row.cashPending) : "—"}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li><KpiCard icon={<Bike className="size-[18px]" />} label="Repartidores activos" value={totals.couriers} hint={`${counts.inactivo} inactivos`} /></li>
        <li><KpiCard icon={<CheckCheck className="size-[18px]" />} tone="lavanda" label={`Entregas (${periodLabel})`} value={totals.deliveries} hint={`${totals.active} pedidos en curso ahora`} /></li>
        <li><KpiCard icon={<Route className="size-[18px]" />} label={`Kilómetros (${periodLabel})`} value={formatKm(totals.km)} hint="Ruta tienda → cliente de lo entregado" /></li>
        <li><KpiCard icon={<Banknote className="size-[18px]" />} tone="durazno" label="Efectivo por rendir" value={formatMoney(totals.cashPending)} hint="Cobrado al entregar, sin recibir en caja" /></li>
      </ul>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <RankCard title="Más entregas" empty="Sin entregas en el periodo" items={rankCouriers(rows, "entregas", 5).map((row) => ({ label: row.name, value: row.deliveries }))} format={(n) => `${n}`} />
        <RankCard title="Más kilómetros" empty="Sin kilómetros en el periodo" items={rankCouriers(rows, "km", 5).map((row) => ({ label: row.name, value: row.km }))} format={formatKm} />
        <RankCard title="Más rápidos" empty="Sin tiempos medidos en el periodo" tone="marino" items={rankCouriers(rows, "rapidez", 5).map((row) => ({ label: row.name, value: row.avgMinutes ?? 0 }))} format={(n) => formatMinutes(n)} />
      </div>

      <Card className="p-5">
        {rows.length === 0 ? (
          <EmptyState title="Todavía no hay repartidores">{create ? "Crea el primero con «Nuevo repartidor»." : "El administrador los da de alta."}</EmptyState>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="w-full sm:max-w-xs">
                <Field type="search" label="Buscar repartidor" hideLabel icon={<Search className="size-4" />} placeholder="Nombre, teléfono o vehículo…" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} />
              </div>
              <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
                {statusChips.map((chip) => (
                  <button key={chip.key} type="button" aria-pressed={filters.status === chip.key} onClick={() => setFilters((current) => ({ ...current, status: chip.key }))} className={pillStyles(filters.status === chip.key)}>
                    {chip.label} · {counts[chip.count]}
                  </button>
                ))}
              </div>
              {create ? (
                <Button variant="primary" className="ml-auto" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Nuevo repartidor
                </Button>
              ) : null}
            </div>
            {visible.length === 0 ? (
              <EmptyState title="Ningún repartidor coincide">
                <Button variant="secondary" onClick={() => setFilters({ query: "", status: "todos" })}>
                  Limpiar filtros
                </Button>
              </EmptyState>
            ) : (
              <DataTable caption="Repartidores" columns={columns} rows={visible} rowKey={(row) => row.id} emptyTitle="" />
            )}
          </>
        )}
        {rows.length === 0 && create ? (
          <div className="mt-3">
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Nuevo repartidor
            </Button>
          </div>
        ) : null}
        <Alert tone="warning" className="mt-4" icon={<Truck className="size-[18px]" />}>
          Etapa 1: la coordinación anota en cada pedido quién entrega. Los kilómetros son los de la ruta tienda → cliente de cada pedido entregado, no el recorrido real.
        </Alert>
      </Card>
      {create ? <NewCourierDialog open={creating} onClose={() => setCreating(false)} create={create} /> : null}
    </div>
  );
}

function RankCard({ title, items, format, empty, tone = "hoja" }: { title: string; items: { label: string; value: number }[]; format: (n: number) => string; empty: string; tone?: "hoja" | "marino" }) {
  return (
    <section aria-label={title}>
      <Card className="h-full p-5">
        <h3 className="mb-3 text-base font-extrabold text-tinta">{title}</h3>
        {items.length === 0 ? <p className="py-4 text-sm text-tinta-suave">{empty}</p> : <HBarList items={items.map((item) => ({ ...item, tone }))} formatValue={format} />}
      </Card>
    </section>
  );
}
