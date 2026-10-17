"use client";

import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, pillStyles } from "@rapitrip/ui";
import { ImageIcon, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { formatMoney } from "@/lib/money";
import type { CreateProductResult } from "./actions";

export type MasterOption = { id: string; kind: "categoria" | "marca" | "tipo_producto"; name: string };
export type ProductRow = { id: string; storeId: string; name: string; status: "borrador" | "publicado" | "archivado"; activeVariants: number; minPrice: number | null; cover: string | null; category: string | null };
type Store = { id: string; name: string; active: boolean };

const statusLabel = { borrador: "Borrador", publicado: "Publicado", archivado: "Archivado" } as const;
const statusTone = { borrador: "neutral", publicado: "positive", archivado: "warning" } as const;

type Props = {
  stores: Store[];
  rows: ProductRow[];
  options: MasterOption[];
  selectedStore: string | null;
  create: (storeId: string, input: { name: string }) => Promise<CreateProductResult>;
};

export function CatalogWorkspace({ stores, rows, selectedStore, create }: Props) {
  const initial = stores.find((store) => store.id === selectedStore)?.id ?? stores[0]?.id ?? null;
  const [storeId, setStoreId] = useState<string | null>(initial);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => row.storeId === storeId && (showArchived || row.status !== "archivado") && (!text || row.name.toLowerCase().includes(text)));
  }, [rows, storeId, query, showArchived]);

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

  return (
    <Card>
      {stores.length > 1 ? (
        <div role="tablist" aria-label="Tienda activa" className="mb-4 flex flex-wrap gap-2">
          {stores.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={storeId === item.id} onClick={() => setStoreId(item.id)} className={pillStyles(storeId === item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-[13px] text-tinta-suave">
          Tienda: <span className="font-bold text-tinta">{store?.name}</span>
        </p>
      )}
      {store && !store.active ? <Alert tone="warning" className="mb-4">Esta tienda está inactiva: sus productos no se muestran a los clientes.</Alert> : null}

      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Field label="Buscar" hideLabel icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto" />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-[13px] font-bold text-tinta">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-[var(--hoja)]" />
          Ver archivados
        </label>
        <Button variant="primary" onClick={() => setCreating(true)} disabled={!storeId}>
          <Plus className="size-4" aria-hidden="true" />
          Nuevo producto
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={rows.some((row) => row.storeId === storeId) ? "Sin resultados" : "Esta tienda aún no tiene productos"}>
          {rows.some((row) => row.storeId === storeId) ? "Prueba con otra búsqueda." : "Crea el primero con «Nuevo producto»."}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => (
            <li key={row.id}>
              <Link href={`/comercio/catalogo/${row.id}`} className="group flex h-full gap-3.5 rounded-panel bg-calido/50 p-3 ring-1 ring-borde transition-[background-color,transform] duration-500 ease-fluido hover:bg-menta/50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                <span className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-papel text-tinta-suave ring-1 ring-borde">
                  {row.cover ? <img src={row.cover} alt="" className="size-full object-cover" loading="lazy" /> : <ImageIcon className="size-6" aria-hidden="true" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-bold text-tinta">{row.name}</span>
                  <span className="truncate text-xs text-tinta-suave">{row.category ?? "Sin categoría"}</span>
                  <span className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold tabular-nums text-tinta">{row.minPrice === null ? "Sin precio" : `${row.activeVariants > 1 ? "Desde " : ""}${formatMoney(row.minPrice)}`}</span>
                    <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {storeId ? <NewProduct open={creating} onClose={() => setCreating(false)} storeId={storeId} create={create} /> : null}
    </Card>
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
