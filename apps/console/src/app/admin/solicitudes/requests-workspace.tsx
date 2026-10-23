"use client";

import { Alert, Badge, Button, Card, DataTable, pillStyles, TextareaField, type Column } from "@rapitrip/ui";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";
import { normalizeText } from "@/lib/directory";

export type RequestRow = {
  id: string;
  name: string;
  status: "pendiente" | "aprobada" | "rechazada";
  receivedAgo: string;
  receivedAt: string;
  decisionReason: string | null;
  reviewedAt: string | null;
  details: { contactName: string; phone: string; address: string; category: string; kind: "informal" | "empresa"; ruc: string; cedula: string; email: string; description: string };
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

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"todos" | "empresa" | "informal">("todos");
  const inTab = useMemo(() => rows.filter((row) => row.status === tab), [rows, tab]);
  const visible = useMemo(() => {
    const needle = normalizeText(query);
    return inTab.filter((row) => (kindFilter === "todos" || row.details.kind === kindFilter) && (needle === "" || normalizeText(row.name).includes(needle)));
  }, [inTab, kindFilter, query]);
  const selected = visible.find((row) => row.id === selectedId) ?? null;

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

  const columns: Column<RequestRow>[] = [
    { header: "Negocio", cell: (row) => <span className="font-bold text-tinta">{row.name}</span> },
    { header: "Tipo", cell: (row) => <Badge tone={row.details.kind === "empresa" ? "neutral" : "warning"}>{row.details.kind === "empresa" ? "Comercio" : "Vendedor"}</Badge> },
    { header: "Solicitante", cell: (row) => row.details.contactName || "—" },
    { header: "Recibida", cell: (row) => (row.status === "rechazada" && row.decisionReason ? `Rechazada: ${row.decisionReason}` : row.receivedAgo) },
    { header: "Estado", cell: (row) => <Badge tone={statusTone[row.status]}>{statusText[row.status]}</Badge> },
    {
      header: "Acción",
      cell: (row) => (
        <Button variant={row.id === selected?.id ? "primary" : "secondary"} aria-label={`Revisar ${row.name}`} onClick={() => choose(row.id)}>
          {row.id === selected?.id ? "Abierta" : "Revisar"}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Estado de la solicitud" className="flex flex-wrap gap-2">
            {tabs.map(({ key, label }) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={pillStyles(tab === key)}>
                {label} · {rows.filter((r) => r.status === key).length}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Tipo" className="flex flex-wrap gap-2">
            {(
              [
                ["todos", "Todos", inTab.length],
                ["empresa", "Comercios", inTab.filter((row) => row.details.kind === "empresa").length],
                ["informal", "Vendedores", inTab.filter((row) => row.details.kind === "informal").length],
              ] as const
            ).map(([key, label, total]) => (
              <button key={key} type="button" aria-pressed={kindFilter === key} onClick={() => setKindFilter(key)} className={pillStyles(kindFilter === key)}>
                {label} · {total}
              </button>
            ))}
          </div>
          <input type="search" aria-label="Buscar negocio" placeholder="Buscar negocio…" value={query} onChange={(e) => setQuery(e.target.value)} className="ml-auto min-h-10 w-full rounded-full border border-borde-campo bg-papel px-4 text-[13px] text-tinta sm:w-64" />
        </div>
        <DataTable caption="Solicitudes de comercio" columns={columns} rows={visible} rowKey={(row) => row.id} emptyTitle="No hay solicitudes aquí" emptyHint="Cuando un comercio pida vender, aparecerá en «Pendientes»." />
      </Card>

      {selected ? (
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-tinta">{selected.name}</h2>
                <p className="text-xs text-tinta-suave">Solicitud enviada {selected.receivedAgo} · {selected.receivedAt}</p>
              </div>
              <Badge tone={statusTone[selected.status]}>{statusText[selected.status]}</Badge>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-panel border border-borde bg-white p-4 text-cuerpo sm:grid-cols-2">
              {(
                [
                  ["Tipo de vendedor", selected.details.kind === "empresa" ? "Empresa (con RUC)" : "Vendedor propio o informal"],
                  ...(selected.details.kind === "empresa" ? ([["RUC", selected.details.ruc]] as const) : []),
                  ...(selected.details.kind !== "empresa" ? ([["Cédula", selected.details.cedula]] as const) : []),
                  [selected.details.kind === "empresa" ? "Representante" : "Nombre completo", selected.details.contactName],
                  ["Teléfono", selected.details.phone],
                  ["Correo electrónico", selected.details.email],
                  ["Dirección del negocio", selected.details.address],
                  ["Categoría", selected.details.category],
                  ["Descripción y productos", selected.details.description],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
                  <dd className="mt-0.5 font-medium text-tinta">{value || "—"}</dd>
                </div>
              ))}
            </dl>

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
        </Card>
      ) : null}
    </div>
  );
}
