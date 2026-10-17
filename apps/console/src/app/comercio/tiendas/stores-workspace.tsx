"use client";

import { Alert, Badge, Button, Card, Dialog, EmptyState, Field } from "@rapitrip/ui";
import { MapPin, Plus, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { storeState } from "@/lib/stores";
import type { CreateStoreResult } from "./actions";

export type StoreRow = { id: string; name: string; address: string | null; status: string | null; closed_until: string | null; open_now: boolean | null; hour_ranges: number };

export function StoresWorkspace({ rows, create }: { rows: StoreRow[]; create: (values: { name: string; address: string; phone: string }) => Promise<CreateStoreResult> }) {
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
                  {row.status === "activa" && row.hour_ranges === 0 ? <p className="mt-2 text-xs font-bold text-durazno-texto">Define su horario para que pueda abrir.</p> : null}
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

function NewStore({ open, onClose, create }: { open: boolean; onClose: () => void; create: (values: { name: string; address: string; phone: string }) => Promise<CreateStoreResult> }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", address: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function close() {
    setValues({ name: "", address: "", phone: "" });
    setError(null);
    onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await create(values);
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
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={pending || values.name.trim().length < 2}>
            {pending ? "Creando…" : "Crear tienda"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

