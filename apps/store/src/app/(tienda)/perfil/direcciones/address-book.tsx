"use client";

import { PinPicker } from "@rapitrip/maps";
import { Alert, Badge, Button, Card, Dialog, Field, TextareaField } from "@rapitrip/ui";
import { departmentName } from "@rapitrip/validation";
import { Home, MapPin, MapPinned, Pencil, Plus, Smartphone, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveDraft, takeDraft } from "@/lib/draft";
import type { CustomerResult } from "@/lib/result";

export type SavedAddress = {
  id: string;
  label: string;
  address: string;
  reference: string | null;
  phone: string | null;
  is_default: boolean;
  latitude?: number | null;
  longitude?: number | null;
  department?: string | null;
};

type Draft = { id: string | null; label: string; address: string; reference: string; phone: string; make_default: boolean; latitude: number | null; longitude: number | null };
const DRAFT_KEY = "rapitrip:direccion";
const blank: Draft = { id: null, label: "", address: "", reference: "", phone: "", make_default: false, latitude: null, longitude: null };

type Actions = {
  save: (input: unknown) => Promise<CustomerResult>;
  setDefault: (id: string) => Promise<CustomerResult>;
  remove: (id: string) => Promise<CustomerResult>;
};

/** Un borrador guardado antes de existir el mapa o el departamento no trae esos datos. */
const normalize = (draft: Draft | null): Draft | null => (draft ? { ...draft, latitude: draft.latitude ?? null, longitude: draft.longitude ?? null } : null);

export function AddressBook({ addresses, actions }: { addresses: SavedAddress[]; actions: Actions }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(() => (typeof window === "undefined" ? null : normalize(takeDraft<Draft>(DRAFT_KEY))));
  const [toDelete, setToDelete] = useState<SavedAddress | null>(null);
  const [result, setResult] = useState<CustomerResult | null>(null);
  const [pending, start] = useTransition();
  const full = addresses.length >= 10;

  function run(task: () => Promise<CustomerResult>, draft?: Draft) {
    setResult(null);
    start(async () => {
      const outcome = await task();
      if (!outcome.ok && outcome.expired) {
        if (draft) saveDraft(DRAFT_KEY, draft);
        router.replace(`/ingresar?next=${encodeURIComponent("/perfil/direcciones")}&expirada=1`);
        return;
      }
      setResult(outcome);
      if (outcome.ok) {
        setEditing(null);
        setToDelete(null);
        router.refresh();
      }
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (editing.latitude === null || editing.longitude === null) {
      setResult({ ok: false, error: "Marca el punto exacto de entrega en el mapa." });
      return;
    }
    run(() => actions.save({ ...editing, reference: editing.reference, phone: editing.phone }), editing);
  }

  return (
    <div className="flex flex-col gap-4">
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? (result.message ?? "Listo.") : result.error}</Alert> : null}

      {addresses.length === 0 && !editing ? (
        <Card className="p-6 text-center">
          <p className="text-base font-extrabold text-tinta">Aún no tienes direcciones guardadas</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-tinta-suave">Guarda tu casa u oficina y elígelas con un toque al hacer tus pedidos.</p>
        </Card>
      ) : null}

      <ul className="flex flex-col gap-3">
        {addresses.map((item) => (
          <li key={item.id}>
            <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Home aria-hidden="true" className="size-4 text-hoja" />
                  <h2 className="text-[15px] font-extrabold text-tinta">{item.label}</h2>
                  {item.is_default ? <Badge tone="positive">Predeterminada</Badge> : null}
                </div>
                <p className="mt-1 flex items-start gap-2 text-[13.5px] text-tinta">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tinta-suave" />
                  {item.address}
                </p>
                {item.department ? <p className="mt-1 text-[13px] text-tinta-suave">Departamento: {departmentName(item.department)}</p> : null}
                {item.reference ? <p className="mt-1 text-[13px] text-tinta-suave">Referencia: {item.reference}</p> : null}
                {item.latitude != null && item.longitude != null ? (
                  <p className="mt-1 flex items-center gap-2 text-[13px] text-hoja">
                    <MapPinned aria-hidden="true" className="size-4" />
                    Con punto marcado en el mapa
                  </p>
                ) : null}
                {item.phone ? (
                  <p className="mt-1 flex items-center gap-2 text-[13px] text-tinta-suave">
                    <Smartphone aria-hidden="true" className="size-4" />
                    {item.phone}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {!item.is_default ? (
                  <Button variant="ghost" disabled={pending} onClick={() => run(() => actions.setDefault(item.id))}>
                    <Star aria-hidden="true" className="size-4" />
                    Predeterminar
                  </Button>
                ) : null}
                <Button variant="secondary" disabled={pending} onClick={() => { setResult(null); setEditing({ id: item.id, label: item.label, address: item.address, reference: item.reference ?? "", phone: item.phone ?? "", make_default: item.is_default, latitude: item.latitude ?? null, longitude: item.longitude ?? null }); }}>
                  <Pencil aria-hidden="true" className="size-4" />
                  Editar
                </Button>
                <Button variant="danger" disabled={pending} onClick={() => setToDelete(item)}>
                  <Trash2 aria-hidden="true" className="size-4" />
                  Eliminar
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {editing ? (
        <Card className="p-6">
          <h2 className="text-base font-bold text-tinta">{editing.id ? "Editar dirección" : "Nueva dirección"}</h2>
          <form onSubmit={submit} noValidate className="mt-4 flex max-w-xl flex-col gap-3.5">
            <Field label="Nombre" hint="Por ejemplo: Casa, Oficina." maxLength={40} value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} required />
            <TextareaField label="Dirección de entrega" rows={3} maxLength={240} value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} required />
            <Field label="Referencia" hint="Opcional. Un punto conocido o cómo reconocer la casa." maxLength={240} value={editing.reference} onChange={(e) => setEditing({ ...editing, reference: e.target.value })} />
            <Field label="Teléfono de contacto" hint="Opcional. Si lo dejas vacío usamos el de tu perfil." type="tel" autoComplete="tel" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />

            <PinPicker
              label="Ubicación en el mapa"
              hint="Obligatoria: marca el punto exacto de entrega. Con él sabemos el departamento y si tu pedido llega en horas (express) o en días (programado); la dirección escrita sigue siendo la referencia."
              value={editing.latitude !== null && editing.longitude !== null ? { lat: editing.latitude, lng: editing.longitude } : null}
              onChange={(point) => setEditing({ ...editing, latitude: point?.lat ?? null, longitude: point?.lng ?? null })}
              onUseAddress={(text) => setEditing({ ...editing, address: text })}
              disabled={pending}
            />

            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13.5px] font-bold text-tinta">
              <input type="checkbox" checked={editing.make_default} onChange={(e) => setEditing({ ...editing, make_default: e.target.checked })} className="size-5 accent-[var(--hoja)]" />
              Usar como dirección predeterminada
            </label>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar dirección"}
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div>
          <Button variant="primary" disabled={full || pending} onClick={() => { setResult(null); setEditing(blank); }}>
            <Plus aria-hidden="true" className="size-4" />
            Agregar dirección
          </Button>
          {full ? <p className="mt-2 text-xs text-tinta-suave">Llegaste al máximo de 10 direcciones. Elimina alguna para agregar otra.</p> : null}
        </div>
      )}

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} title="¿Eliminar esta dirección?">
        <p className="text-sm text-tinta-suave">
          Se eliminará «{toDelete?.label}». Tus pedidos anteriores conservan su dirección.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="danger" disabled={pending} onClick={() => toDelete && run(() => actions.remove(toDelete.id))}>
            {pending ? "Eliminando…" : "Eliminar"}
          </Button>
          <Button variant="secondary" onClick={() => setToDelete(null)}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
