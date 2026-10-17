"use client";

import { Alert, Avatar, Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, Table, Td, Th, THead, Tr } from "@rapitrip/ui";
import { Check, FileText, Plus, Search, Smartphone, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

export type CourierRow = { id: string; name: string; phone: string; vehicle: string; status: "activo" | "inactivo"; since: string };
type Values = { full_name: string; phone: string; vehicle_type: string };

type Props = {
  rows: CourierRow[];
  create: (values: Values) => Promise<ActionResult>;
  update: (id: string, values: Values) => Promise<ActionResult>;
  setStatus: (input: { id: string; status: "activo" | "inactivo"; reason: string }) => Promise<ActionResult>;
  documentUrl: (input: { id: string }) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
};

export function CouriersWorkspace({ rows, create, update, setStatus, documentUrl }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => !text || `${row.name} ${row.phone}`.toLowerCase().includes(text));
  }, [rows, query]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <div className="mb-3.5 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Field label="Buscar" hideLabel icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o teléfono" />
          </div>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo repartidor
          </Button>
        </div>
        {visible.length === 0 ? (
          <EmptyState title={rows.length === 0 ? "Todavía no hay repartidores" : "Sin resultados"}>{rows.length === 0 ? "Crea el primero con «Nuevo repartidor»." : "Prueba con otra búsqueda."}</EmptyState>
        ) : (
          <Table caption="Repartidores">
            <THead>
              <tr>
                <Th>Repartidor</Th>
                <Th>Vehículo</Th>
                <Th>Estado</Th>
                <Th>Alta</Th>
              </tr>
            </THead>
            <tbody>
              {visible.map((row) => {
                const active = row.id === selectedId;
                return (
                  <Tr key={row.id} className={active ? "bg-menta/50" : "hover:bg-calido/60"}>
                    <Td>
                      <button type="button" aria-pressed={active} onClick={() => setSelectedId(active ? null : row.id)} className="flex w-full items-center gap-2.5 rounded-campo text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                        <Avatar name={row.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{row.name}</span>
                          <span className="block truncate text-xs text-tinta-suave">{row.phone}</span>
                        </span>
                      </button>
                    </Td>
                    <Td>{row.vehicle}</Td>
                    <Td>
                      <Badge tone={row.status === "activo" ? "positive" : "warning"}>{row.status === "activo" ? "Activo" : "Inactivo"}</Badge>
                    </Td>
                    <Td>{row.since}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Alert tone="warning" className="mt-3.5" icon={<Truck className="size-[18px]" />}>
          Etapa 1: el encargado anota en el pedido quién entrega. Disponibilidad, turnos y saldo llegan con la aplicación del repartidor.
        </Alert>
      </Card>

      {selected ? <CourierDetail key={selected.id} row={selected} update={update} setStatus={setStatus} documentUrl={documentUrl} /> : <Card><CardHeader title="Ficha del repartidor" /><EmptyState title="Ninguno elegido">Selecciona a alguien para editar sus datos.</EmptyState></Card>}

      <NewCourier open={creating} onClose={() => setCreating(false)} create={create} />
    </div>
  );
}

function CourierDetail({ row, update, setStatus, documentUrl }: { row: CourierRow; update: Props["update"]; setStatus: Props["setStatus"]; documentUrl: Props["documentUrl"] }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ full_name: row.name, phone: row.phone, vehicle_type: row.vehicle });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [statusDialog, setStatusDialog] = useState(false);
  const [pending, start] = useTransition();
  const next = row.status === "activo" ? "inactivo" : "activo";
  const set = (key: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await update(row.id, values);
      setMessage(result.ok ? { ok: true, text: "Datos guardados." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  function openDocument() {
    setMessage(null);
    start(async () => {
      const result = await documentUrl({ id: row.id });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <Card className="p-5 xl:sticky xl:top-6">
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={row.name} />
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-tinta">{row.name}</h2>
          <p className="text-xs text-tinta-suave">Prestador de servicio · desde {row.since}</p>
        </div>
      </div>
      <form onSubmit={save} className="flex flex-col gap-3.5" noValidate>
        <Field label="Nombre completo" value={values.full_name} onChange={set("full_name")} required />
        <Field label="Teléfono" icon={<Smartphone className="size-4" />} type="tel" value={values.phone} onChange={set("phone")} required />
        <Field label="Vehículo" value={values.vehicle_type} onChange={set("vehicle_type")} placeholder="Moto, bicicleta, carro…" required />
        {message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null}
        <div className="flex flex-wrap gap-2.5">
          <Button variant="primary" type="submit" disabled={pending}>
            <Check className="size-4" aria-hidden="true" />
            {pending ? "Guardando…" : "Guardar"}
          </Button>
          <Button variant={next === "inactivo" ? "danger" : "secondary"} onClick={() => setStatusDialog(true)} disabled={pending}>
            {next === "inactivo" ? "Desactivar" : "Activar"}
          </Button>
          <Button variant="ghost" onClick={openDocument} disabled={pending}>
            <FileText className="size-4" aria-hidden="true" />
            Ver documento
          </Button>
        </div>
      </form>
      <Alert tone="warning" className="mt-4">
        Un repartidor desactivado no recibe asignaciones. El documento se abre con un enlace temporal y cada lectura queda auditada.
      </Alert>
      <ReasonDialog
        open={statusDialog}
        onClose={() => setStatusDialog(false)}
        title={next === "inactivo" ? "Desactivar repartidor" : "Activar repartidor"}
        description={`Se cambiará el estado de ${row.name} a «${next}».`}
        confirmLabel="Confirmar"
        danger={next === "inactivo"}
        onConfirm={(reason) => setStatus({ id: row.id, status: next, reason })}
      />
    </Card>
  );
}

function NewCourier({ open, onClose, create }: { open: boolean; onClose: () => void; create: Props["create"] }) {
  const router = useRouter();
  const empty: Values = { full_name: "", phone: "", vehicle_type: "" };
  const [values, setValues] = useState<Values>(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function close() {
    setValues(empty);
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
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onClose={close} title="Nuevo repartidor">
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <Field label="Nombre completo" value={values.full_name} onChange={set("full_name")} required />
        <Field label="Teléfono" icon={<Smartphone className="size-4" />} type="tel" value={values.phone} onChange={set("phone")} required />
        <Field label="Vehículo" value={values.vehicle_type} onChange={set("vehicle_type")} placeholder="Moto, bicicleta, carro…" required />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={pending || !values.full_name || !values.phone || !values.vehicle_type}>
            {pending ? "Guardando…" : "Crear repartidor"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
