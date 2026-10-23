"use client";

import { Alert, Avatar, Badge, Button, Card, DataTable, Dialog, EmptyState, Field, pillStyles, SelectField, TextareaField, type Column } from "@rapitrip/ui";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";
import { filterProducts, productCounts, type ProductFilters, type ProductRow, type ProductStatus } from "@/lib/catalog-products";
import { formatMoney } from "@/lib/money";

type Option = { id: string; name: string };

type Props = {
  rows: ProductRow[];
  categories: Option[];
  brands: Option[];
  types: Option[];
  /** Texto del periodo de las ventas: «este mes», «7 días»… */
  periodLabel: string;
  update: (id: string, input: { name: string; description: string; category_id: string | null; brand_id: string | null; product_type_id: string | null }) => Promise<ActionResult>;
  setStatus: (id: string, input: { status: "borrador" | "archivado"; reason: string }) => Promise<ActionResult>;
};

const statusChips: { key: ProductFilters["status"]; label: string; count: "todos" | ProductStatus }[] = [
  { key: "todos", label: "Todos", count: "todos" },
  { key: "publicado", label: "Publicados", count: "publicado" },
  { key: "borrador", label: "Borradores", count: "borrador" },
  { key: "archivado", label: "Archivados", count: "archivado" },
];
const statusLabel: Record<ProductStatus, string> = { publicado: "Publicado", borrador: "Borrador", archivado: "Archivado" };
const statusTone: Record<ProductStatus, "positive" | "warning" | "neutral"> = { publicado: "positive", borrador: "warning", archivado: "neutral" };
const selectClass = "min-h-10 rounded-full border border-borde-campo bg-papel px-3.5 text-[13px] font-bold text-tinta";
const empty: ProductFilters = { query: "", status: "todos", categoryId: "", storeId: "", reorderOnly: false };

/** Productos de todos los comercios, con barra de filtros y edición de clasificación y estado (el precio y el stock son del comercio). */
export function ProductsTable({ rows, categories, brands, types, periodLabel, update, setStatus }: Props) {
  const [filters, setFilters] = useState<ProductFilters>(empty);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const counts = useMemo(() => productCounts(rows), [rows]);
  const visible = useMemo(() => filterProducts(rows, filters), [rows, filters]);
  const stores = useMemo(() => [...new Map(rows.map((row) => [row.storeId, row.storeName] as const)).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const categoryName = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const set = (patch: Partial<ProductFilters>) => setFilters((current) => ({ ...current, ...patch }));

  const columns: Column<ProductRow>[] = [
    {
      header: "Producto",
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={row.name} size="sm" />
          <span className="font-bold">{row.name}</span>
        </span>
      ),
    },
    {
      header: "Comercio · tienda",
      cell: (row) => (
        <span>
          {row.commerceName}
          <span className="block text-xs text-tinta-suave">{row.storeName}</span>
        </span>
      ),
    },
    { header: "Categoría", cell: (row) => (row.categoryId ? (categoryName.get(row.categoryId) ?? "—") : "Sin categoría") },
    { header: "Estado", cell: (row) => <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge> },
    { header: "Desde", cell: (row) => <span className="tabular-nums">{row.minPrice === null ? "—" : formatMoney(row.minPrice)}</span> },
    { header: `Vendidos (${periodLabel})`, cell: (row) => <span className="tabular-nums">{row.sold}</span> },
    { header: "Stock", cell: (row) => (row.outOfStock > 0 ? <Badge tone="danger">Agotado</Badge> : row.reorder > 0 ? <Badge tone="warning">Reorden</Badge> : "—") },
    {
      header: "Acción",
      cell: (row) => (
        <Button variant="secondary" aria-label={`${row.status === "archivado" ? "Ver" : "Editar"} ${row.name}`} onClick={() => setEditing(row)}>
          {row.status === "archivado" ? "Ver" : "Editar"}
        </Button>
      ),
    },
  ];

  return (
    <Card className="p-5">
      {rows.length === 0 ? (
        <EmptyState title="Todavía no hay productos">Aparecen aquí cuando un comercio crea productos en sus tiendas.</EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="w-full sm:max-w-xs">
              <Field type="search" label="Buscar producto" hideLabel icon={<Search className="size-4" />} placeholder="Producto, tienda o comercio…" value={filters.query} onChange={(event) => set({ query: event.target.value })} />
            </div>
            <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
              {statusChips.map((chip) => (
                <button key={chip.key} type="button" aria-pressed={filters.status === chip.key} onClick={() => set({ status: chip.key })} className={pillStyles(filters.status === chip.key)}>
                  {chip.label} · {counts[chip.count]}
                </button>
              ))}
              <button type="button" aria-pressed={filters.reorderOnly} onClick={() => set({ reorderOnly: !filters.reorderOnly })} className={pillStyles(filters.reorderOnly)}>
                En reorden · {counts.reorder}
              </button>
            </div>
            <label className="sr-only" htmlFor="filtro-categoria">
              Categoría
            </label>
            <select id="filtro-categoria" value={filters.categoryId} onChange={(event) => set({ categoryId: event.target.value })} className={selectClass}>
              <option value="">Todas las categorías</option>
              <option value="none">Sin categoría</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="filtro-tienda">
              Tienda
            </label>
            <select id="filtro-tienda" value={filters.storeId} onChange={(event) => set({ storeId: event.target.value })} className={selectClass}>
              <option value="">Todas las tiendas</option>
              {stores.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <p role="status" className="ml-auto text-[13px] text-tinta-suave">
              {visible.length} de {rows.length} {rows.length === 1 ? "producto" : "productos"}
            </p>
          </div>
          {visible.length === 0 ? (
            <EmptyState title="Ningún producto coincide">
              <Button variant="secondary" onClick={() => setFilters(empty)}>
                Limpiar filtros
              </Button>
            </EmptyState>
          ) : (
            <DataTable caption="Productos de los comercios" columns={columns} rows={visible} rowKey={(row) => row.id} emptyTitle="" />
          )}
        </>
      )}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.status === "archivado" ? "Producto archivado" : "Editar producto"}>
        {editing ? <EditForm key={editing.id} product={editing} categories={categories} brands={brands} types={types} update={update} setStatus={setStatus} onDone={() => setEditing(null)} /> : null}
      </Dialog>
    </Card>
  );
}

function EditForm({ product, categories, brands, types, update, setStatus, onDone }: { product: ProductRow; categories: Option[]; brands: Option[]; types: Option[]; update: Props["update"]; setStatus: Props["setStatus"]; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [category, setCategory] = useState(product.categoryId ?? "");
  const [brand, setBrand] = useState(product.brandId ?? "");
  const [type, setType] = useState(product.typeId ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) return setError(result.error);
      router.refresh();
      onDone();
    });
  }

  const context = (
    <p className="text-xs text-tinta-suave">
      {product.commerceName} · {product.storeName}. El precio y el stock los gestiona el comercio.
    </p>
  );
  if (product.status === "archivado") {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-bold text-tinta">{product.name}</p>
        {context}
        <Alert>Un producto archivado no se edita.</Alert>
        <Button variant="secondary" onClick={onDone}>
          Cerrar
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => update(product.id, { name, description, category_id: category || null, brand_id: brand || null, product_type_id: type || null }));
      }}
    >
      {context}
      <Field label="Nombre" value={name} onChange={(event) => setName(event.target.value)} />
      <TextareaField label="Descripción" value={description} onChange={(event) => setDescription(event.target.value)} />
      <SelectField label="Categoría" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Sin categoría</option>
        {categories.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Marca" value={brand} onChange={(event) => setBrand(event.target.value)}>
        <option value="">Sin marca</option>
        {brands.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Tipo de producto" value={type} onChange={(event) => setType(event.target.value)}>
        <option value="">Sin tipo</option>
        {types.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </SelectField>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
      <hr className="border-borde" />
      <p className="text-xs text-tinta-suave">Para ocultar o archivar el producto escribe el motivo (mínimo 5 caracteres). Queda en la auditoría.</p>
      <TextareaField label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} />
      <div className="flex flex-wrap gap-2.5">
        {product.status === "publicado" ? (
          <Button type="button" variant="secondary" disabled={pending || reason.trim().length < 5} onClick={() => run(() => setStatus(product.id, { status: "borrador", reason: reason.trim() }))}>
            Ocultar producto
          </Button>
        ) : null}
        <Button type="button" variant="danger" disabled={pending || reason.trim().length < 5} onClick={() => run(() => setStatus(product.id, { status: "archivado", reason: reason.trim() }))}>
          Archivar producto
        </Button>
      </div>
    </form>
  );
}
