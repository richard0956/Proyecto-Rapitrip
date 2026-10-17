"use client";

import { Alert, Badge, Button, Card, EmptyState, Field, pillStyles } from "@rapitrip/ui";
import { Check, CornerDownRight, Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

type Kind = "categoria" | "marca" | "tipo_producto" | "atributo";
export type MasterRow = { id: string; kind: Kind; name: string; parentId: string | null; status: "activo" | "inactivo" };

const kinds: { key: Kind; label: string; singular: string; hint: string }[] = [
  { key: "categoria", label: "Categorías", singular: "categoría", hint: "Agrupan productos (admiten un nivel de subcategorías)." },
  { key: "marca", label: "Marcas", singular: "marca", hint: "Fabricantes o marcas comerciales." },
  { key: "tipo_producto", label: "Tipos de producto", singular: "tipo de producto", hint: "Por ejemplo: bebida, abarrote, servicio." },
  { key: "atributo", label: "Atributos", singular: "atributo", hint: "Características que varían: talla, sabor, color." },
];

type Props = {
  rows: MasterRow[];
  create: (input: { kind: Kind; name: string; parent_id?: string | null }) => Promise<ActionResult>;
  rename: (id: string, name: string) => Promise<ActionResult>;
  setStatus: (id: string, input: { status: "activo" | "inactivo"; reason: string }) => Promise<ActionResult>;
};

export function MasterCatalog({ rows, create, rename, setStatus }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("categoria");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const current = kinds.find((item) => item.key === kind)!;

  const items = useMemo(() => rows.filter((row) => row.kind === kind), [rows, kind]);
  const roots = items.filter((row) => !row.parentId);
  const children = (id: string) => items.filter((row) => row.parentId === id);
  const topCategories = rows.filter((row) => row.kind === "categoria" && !row.parentId && row.status === "activo");

  function add(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await create({ kind, name, parent_id: kind === "categoria" && parentId ? parentId : null });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setName("");
      setMessage({ ok: true, text: "Elemento agregado." });
      router.refresh();
    });
  }

  return (
    <Card>
      <div role="tablist" aria-label="Clase de elemento" className="mb-4 flex flex-wrap gap-2">
        {kinds.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={kind === item.key} onClick={() => { setKind(item.key); setMessage(null); setParentId(""); }} className={pillStyles(kind === item.key)}>
            {item.label}
            <span className="tabular-nums opacity-80">{rows.filter((row) => row.kind === item.key).length}</span>
          </button>
        ))}
      </div>
      <p className="mb-3 text-[13px] text-tinta-suave">{current.hint}</p>

      <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-3 rounded-panel bg-calido/50 p-4" noValidate>
        <div className="min-w-[200px] flex-1">
          <Field label={`Nueva ${current.singular}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        {kind === "categoria" ? (
          <div className="flex min-w-[200px] flex-col gap-1.5">
            <label htmlFor="parent" className="text-xs font-bold text-tinta-suave">Dentro de</label>
            <select id="parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className="min-h-11 rounded-campo border border-borde-campo bg-white px-3 text-sm text-tinta focus-visible:outline-2 focus-visible:outline-hoja">
              <option value="">Categoría principal</option>
              {topCategories.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        <Button variant="primary" type="submit" disabled={pending || name.trim().length < 2}>
          <Plus className="size-4" aria-hidden="true" />
          Agregar
        </Button>
      </form>
      {message ? <Alert tone={message.ok ? "info" : "error"} className="mb-4">{message.text}</Alert> : null}

      {items.length === 0 ? (
        <EmptyState title={`Sin ${current.label.toLowerCase()}`}>Agrega la primera arriba.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {roots.map((root) => (
            <li key={root.id}>
              <ItemRow row={root} rename={rename} setStatus={setStatus} />
              {children(root.id).length > 0 ? (
                <ul className="mb-2 ml-5 flex flex-col border-l-2 border-menta-borde pl-3">
                  {children(root.id).map((child) => (
                    <li key={child.id}>
                      <ItemRow row={child} rename={rename} setStatus={setStatus} nested />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ItemRow({ row, rename, setStatus, nested }: { row: MasterRow; rename: Props["rename"]; setStatus: Props["setStatus"]; nested?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [pending, start] = useTransition();
  const next = row.status === "activo" ? "inactivo" : "activo";

  function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await rename(row.id, name);
      if (!result.ok) return setError(result.error);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <form onSubmit={save} className="flex flex-1 flex-wrap items-end gap-2" noValidate>
            <div className="min-w-[180px] flex-1">
              <Field label={`Nombre de ${row.name}`} hideLabel value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
            </div>
            <Button variant="primary" type="submit" disabled={pending || name.trim().length < 2} aria-label="Guardar nombre" className="min-h-11 px-3">
              <Check className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setName(row.name); setError(null); }} aria-label="Cancelar edición" className="min-h-11 px-3">
              <X className="size-4" aria-hidden="true" />
            </Button>
          </form>
        ) : (
          <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-tinta">
            {nested ? <CornerDownRight className="size-4 shrink-0 text-tinta-suave" aria-hidden="true" /> : null}
            <span className="truncate">{row.name}</span>
            <Badge tone={row.status === "activo" ? "positive" : "warning"}>{row.status === "activo" ? "Activo" : "Inactivo"}</Badge>
          </p>
        )}
        {!editing ? (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" onClick={() => setEditing(true)} aria-label={`Renombrar ${row.name}`} className="min-h-10 px-3">
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button variant={next === "inactivo" ? "ghost" : "secondary"} onClick={() => setDialog(true)} className="min-h-10 px-3">
              {next === "inactivo" ? "Desactivar" : "Activar"}
            </Button>
          </div>
        ) : null}
      </div>
      {error ? <Alert tone="error" className="mt-2">{error}</Alert> : null}
      <ReasonDialog
        open={dialog}
        onClose={() => setDialog(false)}
        title={next === "inactivo" ? "Desactivar elemento" : "Activar elemento"}
        description={next === "inactivo" && !row.parentId && row.kind === "categoria" ? `«${row.name}» y sus subcategorías dejarán de estar disponibles para los comercios.` : `Se cambiará «${row.name}» a ${next}.`}
        confirmLabel="Confirmar"
        danger={next === "inactivo"}
        onConfirm={(reason) => setStatus(row.id, { status: next, reason })}
      />
    </div>
  );
}
