"use client";

import { Alert, Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, HBarList, KpiCard, LineChart, pillStyles } from "@rapitrip/ui";
import { Boxes, ImageIcon, PackageCheck, Plus, Search, Trophy, Banknote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { catalogCounts, filterCatalog, type CatalogFilters, type ShopProduct } from "@/lib/shop-catalog";
import { compactMoney } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import type { CreateProductResult, ProductFlowResult } from "./actions";

export type MasterOption = { id: string; kind: "categoria" | "marca" | "tipo_producto"; name: string };
export type ProductRow = ShopProduct;
type Store = { id: string; name: string; active: boolean };

const statusLabel = { borrador: "Borrador", publicado: "Publicado", archivado: "Archivado" } as const;
const statusTone = { borrador: "neutral", publicado: "positive", archivado: "warning" } as const;
const selectClass = "min-h-10 rounded-full border border-borde-campo bg-papel px-3.5 text-[13px] font-bold text-tinta";
const initialFilters: CatalogFilters = { query: "", status: "activos", categoryId: "", noSales: false, sort: "nombre" };

type Props = {
  stores: Store[];
  rows: ShopProduct[];
  options: MasterOption[];
  categories: { id: string; name: string }[];
  selectedStore: string | null;
  create: (storeId: string, input: { name: string }) => Promise<CreateProductResult>;
  /** Texto del periodo de las ventas: «este mes», «7 días»… */
  periodLabel: string;
  loadFlow: (productId: string) => Promise<ProductFlowResult>;
};

export function CatalogWorkspace({ stores, rows, categories, selectedStore, create, periodLabel, loadFlow }: Props) {
  const initial = stores.find((store) => store.id === selectedStore)?.id ?? stores[0]?.id ?? null;
  const [storeId, setStoreId] = useState<string | null>(initial);
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
  const [creating, setCreating] = useState(false);
  const [flowOf, setFlowOf] = useState<ShopProduct | null>(null);
  const set = (patch: Partial<CatalogFilters>) => setFilters((current) => ({ ...current, ...patch }));

  const storeRows = useMemo(() => rows.filter((row) => row.storeId === storeId), [rows, storeId]);
  const counts = useMemo(() => catalogCounts(storeRows), [storeRows]);
  const visible = useMemo(() => filterCatalog(storeRows, filters), [storeRows, filters]);

  if (stores.length === 0) {
    return (
      <Card>
        <EmptyState title="Primero crea una tienda">
          El catálogo es por tienda.{" "}
          <Link href="/comercio/tiendas" className="font-bold text-hoja underline underline-offset-2">
            Ir a Mis tiendas
          </Link>
        </EmptyState>
      </Card>
    );
  }

  const store = stores.find((item) => item.id === storeId);
  const live = storeRows.filter((row) => row.status !== "archivado");
  const bestSellers = live.filter((row) => row.sold > 0).sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name, "es"));
  const best = bestSellers[0];
  const unitsSold = live.reduce((total, row) => total + row.sold, 0);
  const revenue = live.reduce((total, row) => total + row.revenue, 0);
  const reserved = live.reduce((total, row) => total + row.reserved, 0);
  const statusChips = [
    { key: "activos", label: "Activos", count: counts.activos },
    { key: "publicado", label: "Publicados", count: counts.publicado },
    { key: "borrador", label: "Borradores", count: counts.borrador },
    { key: "archivado", label: "Archivados", count: counts.archivado },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      {stores.length > 1 ? (
        <div role="tablist" aria-label="Tienda activa" className="flex flex-wrap gap-2">
          {stores.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={storeId === item.id} onClick={() => { setStoreId(item.id); setFilters(initialFilters); }} className={pillStyles(storeId === item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-tinta-suave">
          Tienda: <span className="font-bold text-tinta">{store?.name}</span>
        </p>
      )}
      {store && !store.active ? <Alert tone="warning">Esta tienda está inactiva: sus productos no se muestran a los clientes.</Alert> : null}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li><KpiCard icon={<Boxes className="size-[18px]" />} label="Productos" value={counts.activos} hint={`${counts.publicado} publicados · ${counts.borrador} borradores`} /></li>
        <li><KpiCard icon={<Trophy className="size-[18px]" />} tone="lavanda" label={`Más vendido (${periodLabel})`} value={best ? best.name : "—"} hint={best ? `${best.sold} u. · ${formatMoney(best.revenue)}` : "Sin ventas en el periodo"} /></li>
        <li><KpiCard icon={<Banknote className="size-[18px]" />} label={`Unidades vendidas (${periodLabel})`} value={unitsSold} hint={`${formatMoney(revenue)} en productos`} /></li>
        <li><KpiCard icon={<PackageCheck className="size-[18px]" />} tone="durazno" label="Unidades apartadas" value={reserved} hint="En pedidos que aún no se entregan" /></li>
      </ul>

      {bestSellers.length > 0 ? (
        <Card className="p-5">
          <CardHeader title="Productos más vendidos" subtitle={`Unidades, ${periodLabel}`} />
          <HBarList items={bestSellers.slice(0, 6).map((row) => ({ label: row.name, value: row.sold, tone: "hoja" as const }))} formatValue={(n) => `${n} u.`} />
        </Card>
      ) : null}

      <Card>
        <div className="mb-3.5 flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1 sm:max-w-xs">
            <Field type="search" label="Buscar producto" hideLabel icon={<Search className="size-4" />} placeholder="Buscar producto" value={filters.query} onChange={(event) => set({ query: event.target.value })} />
          </div>
          <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
            {statusChips.map((chip) => (
              <button key={chip.key} type="button" aria-pressed={filters.status === chip.key} onClick={() => set({ status: chip.key })} className={pillStyles(filters.status === chip.key)}>
                {chip.label} · {chip.count}
              </button>
            ))}
            <button type="button" aria-pressed={filters.noSales} onClick={() => set({ noSales: !filters.noSales })} className={pillStyles(filters.noSales)}>
              Sin ventas · {counts.sinVentas}
            </button>
          </div>
          <label className="sr-only" htmlFor="catalogo-categoria">
            Categoría
          </label>
          <select id="catalogo-categoria" value={filters.categoryId} onChange={(event) => set({ categoryId: event.target.value })} className={selectClass}>
            <option value="">Todas las categorías</option>
            <option value="none">Sin categoría</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="catalogo-orden">
            Ordenar por
          </label>
          <select id="catalogo-orden" value={filters.sort} onChange={(event) => set({ sort: event.target.value as CatalogFilters["sort"] })} className={selectClass}>
            <option value="nombre">Ordenar: nombre</option>
            <option value="vendidos">Ordenar: más vendidos</option>
            <option value="apartados">Ordenar: más apartados</option>
          </select>
          <Button variant="primary" className="ml-auto" onClick={() => setCreating(true)} disabled={!storeId}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo producto
          </Button>
        </div>

        {visible.length === 0 ? (
          <EmptyState title={storeRows.length > 0 ? "Ningún producto coincide" : "Esta tienda aún no tiene productos"}>
            {storeRows.length > 0 ? (
              <Button variant="secondary" onClick={() => setFilters(initialFilters)}>
                Limpiar filtros
              </Button>
            ) : (
              "Crea el primero con «Nuevo producto»."
            )}
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((row) => (
              <li key={row.id} className="flex flex-col gap-2">
                <Link href={`/comercio/catalogo/${row.id}`} className="group flex h-full gap-3.5 rounded-panel bg-calido/50 p-3 ring-1 ring-borde transition-[background-color,transform] duration-500 ease-fluido hover:bg-menta/50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                  <span className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-papel text-tinta-suave ring-1 ring-borde">
                    {row.cover ? <img src={row.cover} alt="" className="size-full object-cover" loading="lazy" /> : <ImageIcon className="size-6" aria-hidden="true" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-bold text-tinta">{row.name}</span>
                    <span className="truncate text-xs text-tinta-suave">{row.category ?? "Sin categoría"}</span>
                    <span className="truncate text-xs text-tinta-suave">
                      {row.sold} vendidas · {row.orders} {row.orders === 1 ? "pedido" : "pedidos"}
                      {row.reserved > 0 ? ` · ${row.reserved} apartadas` : ""}
                    </span>
                    <span className="mt-auto flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold tabular-nums text-tinta">{row.minPrice === null ? "Sin precio" : `${row.activeVariants > 1 ? "Desde " : ""}${formatMoney(row.minPrice)}`}</span>
                      <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>
                    </span>
                  </span>
                </Link>
                <Button variant="secondary" aria-label={`Ver flujo de ${row.name}`} onClick={() => setFlowOf(row)}>
                  Ver flujo
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {storeId ? <NewProduct open={creating} onClose={() => setCreating(false)} storeId={storeId} create={create} /> : null}
      <Dialog open={flowOf !== null} onClose={() => setFlowOf(null)} title={flowOf ? `Flujo de ${flowOf.name}` : "Flujo del producto"} wide>
        {flowOf ? <ProductFlow key={flowOf.id} product={flowOf} periodLabel={periodLabel} loadFlow={loadFlow} onClose={() => setFlowOf(null)} /> : null}
      </Dialog>
    </div>
  );
}

/** Cómo se ha movido un producto: unidades y pedidos por día, y cuánto está vendido, apartado o cancelado. */
function ProductFlow({ product, periodLabel, loadFlow, onClose }: { product: ShopProduct; periodLabel: string; loadFlow: Props["loadFlow"]; onClose: () => void }) {
  const [flow, setFlow] = useState<ProductFlowResult | null>(null);
  useEffect(() => {
    let alive = true;
    loadFlow(product.id).then((result) => {
      if (alive) setFlow(result);
    });
    return () => {
      alive = false;
    };
  }, [product.id, loadFlow]);

  const facts = [
    ["Vendidas", `${product.sold} u.`],
    ["Pedidos", String(product.orders)],
    ["Apartadas", `${product.reserved} u.`],
    ["Canceladas", `${product.cancelled} u.`],
  ] as const;
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-campo bg-crema px-3 py-2">
            <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
            <dd className="text-base font-extrabold tabular-nums text-tinta">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-tinta-suave">
        Vendidas y pedidos cuentan {periodLabel}. «Apartadas» son las unidades que hoy están en pedidos sin entregar; «canceladas», las de pedidos cancelados o rechazados.
      </p>
      {flow === null ? (
        <p className="py-6 text-center text-sm text-tinta-suave">Cargando el flujo…</p>
      ) : !flow.ok ? (
        <Alert tone="error">{flow.error}</Alert>
      ) : (
        <LineChart
          ariaLabel={`Unidades vendidas por día, ${periodLabel}`}
          labels={flow.labels}
          formatValue={(n) => (n >= 1000 ? compactMoney(n).replace("C$ ", "") : String(n))}
          series={[
            { name: "Unidades", tone: "hoja", values: flow.units },
            { name: "Pedidos", tone: "marino", values: flow.orders },
          ]}
        />
      )}
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

function NewProduct({ open, onClose, storeId, create }: { open: boolean; onClose: () => void; storeId: string; create: Props["create"] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close() {
    setName("");
    setError(null);
    onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await create(storeId, { name });
      if (!result.ok) return setError(result.error);
      close();
      router.push(`/comercio/catalogo/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onClose={close} title="Nuevo producto">
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <Field label="Nombre del producto" value={name} onChange={(e) => setName(e.target.value)} placeholder="Café molido" maxLength={120} required />
        <p className="text-xs text-tinta-suave">Se crea como borrador. Después agregas variantes, imágenes y lo publicas.</p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={pending || name.trim().length < 2}>
            {pending ? "Creando…" : "Crear producto"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
