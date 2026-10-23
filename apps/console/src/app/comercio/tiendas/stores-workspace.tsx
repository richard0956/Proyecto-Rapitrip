"use client";

import { PinPicker, type LatLng } from "@rapitrip/maps";
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field } from "@rapitrip/ui";
import { MapPin, Plus, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { formatMoney } from "@/lib/money";
import { storeState } from "@/lib/stores";
import type { CreateStoreResult } from "./actions";

export type StoreMetrics = { sales: number; orders: number; topProducts: { name: string; units: number }[] };
export type StoreRow = { id: string; name: string; address: string | null; status: string | null; closed_until: string | null; open_now: boolean | null; hour_ranges: number; located: boolean; metrics?: StoreMetrics };

type NewStoreValues = { name: string; address: string; phone: string; latitude: number; longitude: number };

export function StoresWorkspace({ rows, create, periodLabel = "este mes" }: { rows: StoreRow[]; create: (values: NewStoreValues) => Promise<CreateStoreResult>; periodLabel?: string }) {
  const [creating, setCreating] = useState(false);
  return (
    <Card>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <p className="text-[13px] text-tinta-suave">{rows.length === 0 ? "Aún no hay tiendas." : `${rows.length} ${rows.length === 1 ? "tienda" : "tiendas"}`}</p>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nueva tienda
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Todavía no tienes tiendas">Crea la primera con «Nueva tienda». Después define su horario.</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((row) => {
            const state = storeState(row);
            return (
              <li key={row.id}>
                <Link href={`/comercio/tiendas/${row.id}`} className="group block rounded-panel bg-calido/50 p-4 ring-1 ring-borde transition-[background-color,transform] duration-500 ease-fluido hover:bg-menta/50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="truncate text-base font-bold text-tinta">{row.name}</h2>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-tinta-suave">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    {row.address ?? "Sin dirección"}
                  </p>
                  {!row.located ? <p className="mt-2 text-xs font-bold text-durazno-texto">Marca su ubicación en el mapa: sin ella no recibe pedidos.</p> : null}
                  {row.status === "activa" && row.hour_ranges === 0 ? <p className="mt-2 text-xs font-bold text-durazno-texto">Define su horario para que pueda abrir.</p> : null}
                  {row.metrics ? <StoreMetricsBlock metrics={row.metrics} periodLabel={periodLabel} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <NewStore open={creating} onClose={() => setCreating(false)} create={create} />
    </Card>
  );
}

/** Ventas de la tienda en el periodo y sus productos estrella. */
function StoreMetricsBlock({ metrics, periodLabel }: { metrics: StoreMetrics; periodLabel: string }) {
  if (metrics.orders === 0) return <p className="mt-3 rounded-campo bg-papel px-3 py-2 text-xs text-tinta-suave ring-1 ring-borde">Sin ventas {periodLabel}</p>;
  return (
    <div className="mt-3 rounded-campo bg-papel p-3 ring-1 ring-borde">
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-tinta-suave">Ventas</dt>
          <dd className="text-sm font-extrabold tabular-nums text-tinta">{formatMoney(metrics.sales)}</dd>
        </div>
        <div>
          <dt className="text-tinta-suave">Pedidos</dt>
          <dd className="text-sm font-extrabold tabular-nums text-tinta">{metrics.orders} {metrics.orders === 1 ? "pedido" : "pedidos"}</dd>
        </div>
        <div>
          <dt className="text-tinta-suave">Ticket promedio</dt>
          <dd className="text-sm font-extrabold tabular-nums text-tinta">{formatMoney(metrics.sales / metrics.orders)}</dd>
        </div>
      </dl>
      {metrics.topProducts.length > 0 ? (
        <>
          <p className="mb-1 mt-3 text-micro font-bold uppercase text-tinta-suave">Productos estrella</p>
          <ul className="flex flex-col gap-1 text-xs">
            {metrics.topProducts.map((product) => (
              <li key={product.name} className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold text-tinta">{product.name}</span>
                <span className="tabular-nums text-tinta-suave">{product.units} u.</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function NewStore({ open, onClose, create }: { open: boolean; onClose: () => void; create: (values: NewStoreValues) => Promise<CreateStoreResult> }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", address: "", phone: "" });
  const [point, setPoint] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function close() {
    setValues({ name: "", address: "", phone: "" });
    setPoint(null);
    setError(null);
    onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!point) return setError("Marca la ubicación de la tienda en el mapa.");
    start(async () => {
      const result = await create({ ...values, latitude: point.lat, longitude: point.lng });
      if (!result.ok) return setError(result.error);
      close();
      router.push(`/comercio/tiendas/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onClose={close} title="Nueva tienda">
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <Field label="Nombre de la tienda" value={values.name} onChange={set("name")} placeholder="Sucursal Centro" required />
        <Field label="Dirección" icon={<MapPin className="size-4" />} value={values.address} onChange={set("address")} hint="Opcional" />
        <Field label="Teléfono de contacto" icon={<Smartphone className="size-4" />} type="tel" value={values.phone} onChange={set("phone")} hint="Opcional" />
        <PinPicker
          label="Ubicación de la tienda en el mapa"
          hint="Obligatoria: marca la entrada de la tienda. Con ella se calcula el envío de cada pedido por distancia."
          value={point}
          onChange={setPoint}
          onUseAddress={(text) => setValues((v) => ({ ...v, address: text }))}
          disabled={pending}
        />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={pending || values.name.trim().length < 2 || !point}>
            {pending ? "Creando…" : "Crear tienda"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

