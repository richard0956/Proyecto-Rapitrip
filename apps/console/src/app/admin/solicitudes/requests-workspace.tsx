"use client";

import { Alert, Badge, Button, Card, CardHeader, EmptyState, pillStyles, TextareaField } from "@rapitrip/ui";
import { Check, Store, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";

export type RequestRow = {
  id: string;
  name: string;
  status: "pendiente" | "aprobada" | "rechazada";
  receivedAgo: string;
  receivedAt: string;
  decisionReason: string | null;
  reviewedAt: string | null;
};

type Props = {
  rows: RequestRow[];
  approve: (input: { id: string; convenio: boolean }) => Promise<ActionResult>;
  reject: (input: { id: string; reason: string }) => Promise<ActionResult>;
};

const tabs = [
  { key: "pendiente", label: "Pendientes" },
  { key: "aprobada", label: "Aprobadas" },
  { key: "rechazada", label: "Rechazadas" },
] as const;
const statusTone = { pendiente: "warning", aprobada: "positive", rechazada: "danger" } as const;
const statusText = { pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada" } as const;

export function RequestsWorkspace({ rows, approve, reject }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<RequestRow["status"]>(rows.some((r) => r.status === "pendiente") ? "pendiente" : "aprobada");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [convenio, setConvenio] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const visible = useMemo(() => rows.filter((row) => row.status === tab), [rows, tab]);
  const selected = visible.find((row) => row.id === selectedId) ?? visible[0] ?? null;

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) return setError(result.error);
      setConvenio(false);
      setReason("");
      router.refresh();
    });
  }

  function choose(id: string) {
    setSelectedId(id);
    setConvenio(false);
    setReason("");
    setError(null);
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
      <Card>
        <div role="tablist" aria-label="Estado de la solicitud" className="mb-3.5 flex flex-wrap gap-2">
          {tabs.map(({ key, label }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={pillStyles(tab === key)}>
              {label} · {rows.filter((r) => r.status === key).length}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <EmptyState title="No hay solicitudes aquí">Cuando un comercio pida vender, aparecerá en «Pendientes».</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visible.map((row) => {
              const active = row.id === selected?.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => choose(row.id)}
                    className={`flex w-full items-center gap-3 rounded-boton border px-3.5 py-3 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja ${active ? "border-hoja bg-menta/60" : "border-borde bg-white hover:border-menta-borde"}`}
                  >
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-campo bg-durazno text-durazno-texto">
                      <Store className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-tinta">{row.name}</span>
                      <span className="block truncate text-xs text-tinta-suave">{row.status === "rechazada" && row.decisionReason ? `Rechazada: ${row.decisionReason}` : row.receivedAgo}</span>
                    </span>
                    <Badge tone={statusTone[row.status]}>{statusText[row.status]}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        {selected ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-tinta">{selected.name}</h2>
                <p className="text-xs text-tinta-suave">Solicitud enviada {selected.receivedAgo} · {selected.receivedAt}</p>
              </div>
              <Badge tone={statusTone[selected.status]}>{statusText[selected.status]}</Badge>
            </div>

            <Alert tone="warning">El contacto y los documentos de quien solicita aparecerán aquí cuando el backend los exponga a la consola.</Alert>

            {selected.status === "pendiente" ? (
              <>
                <TextareaField label="Motivo (si rechazas)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Escribe el motivo del rechazo (mínimo 10 caracteres)" />
                <label className="flex items-start gap-3 text-[13px] font-bold text-tinta">
                  <input type="checkbox" checked={convenio} onChange={(e) => setConvenio(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-hoja" />
                  Confirmo que el convenio de afiliación está firmado.
                </label>
                {error ? <Alert tone="error">{error}</Alert> : null}
                <div className="flex flex-wrap gap-2.5">
                  <Button variant="danger" disabled={pending || reason.trim().length < 10} onClick={() => run(() => reject({ id: selected.id, reason: reason.trim() }))}>
                    <X className="size-4" aria-hidden="true" />
                    Rechazar con motivo
                  </Button>
                  <Button variant="primary" disabled={pending || !convenio} onClick={() => run(() => approve({ id: selected.id, convenio }))}>
                    <Check className="size-4" aria-hidden="true" />
                    {pending ? "Guardando…" : "Aprobar y crear comercio"}
                  </Button>
                </div>
                <Alert>Al aprobar se crean el comercio y su cuenta con el rol Comercio. La aprobación exige el convenio firmado.</Alert>
              </>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-cuerpo">
                <dt className="font-bold text-tinta-suave">Decisión</dt>
                <dd>{statusText[selected.status]}</dd>
                <dt className="font-bold text-tinta-suave">Resuelta</dt>
                <dd>{selected.reviewedAt ?? "—"}</dd>
                {selected.decisionReason ? (
                  <>
                    <dt className="font-bold text-tinta-suave">Motivo</dt>
                    <dd>{selected.decisionReason}</dd>
                  </>
                ) : null}
              </dl>
            )}
          </div>
        ) : (
          <>
            <CardHeader title="Detalle de la solicitud" />
            <EmptyState title="Nada seleccionado">Elige una solicitud de la lista.</EmptyState>
          </>
        )}
      </Card>
    </div>
  );
}
