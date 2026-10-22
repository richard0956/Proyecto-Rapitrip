"use client";

import { PinPicker, type LatLng } from "@rapitrip/maps";
import { Alert, Badge, Button, Card, CardHeader, Field } from "@rapitrip/ui";
import { CalendarOff, Check, Clock, MapPin, Plus, Smartphone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { flattenHours, formatCalendarDate, formatStoreDateTime, storeState, todayInStoreZone, weekdays, type HoursByDay } from "@/lib/stores";

type Store = { id: string; name: string; address: string | null; phone: string | null; status: "activa" | "inactiva"; closed_until: string | null; closed_reason: string | null; open_now: boolean | null; latitude: number | null; longitude: number | null };
type Exception = { on_date: string; closed: boolean; opens: string | null; closes: string | null; note: string | null };

type Actions = {
  updateStore: (id: string, values: unknown) => Promise<ActionResult>;
  setStoreLocation: (id: string, values: unknown) => Promise<ActionResult>;
  setStoreStatus: (id: string, input: { status: "activa" | "inactiva"; reason: string }) => Promise<ActionResult>;
  saveStoreHours: (id: string, hours: unknown) => Promise<ActionResult>;
  closeStoreTemporarily: (id: string, input: unknown) => Promise<ActionResult>;
  reopenStore: (id: string) => Promise<ActionResult>;
  saveStoreException: (id: string, input: unknown) => Promise<ActionResult>;
  deleteStoreException: (id: string, date: string) => Promise<ActionResult>;
};

type Message = { ok: boolean; text: string } | null;

function Feedback({ message }: { message: Message }) {
  return message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null;
}

export function StoreEditor({ store, hours, exceptions, disabled, actions }: { store: Store; hours: HoursByDay; exceptions: Exception[]; disabled: boolean; actions: Actions }) {
  const state = storeState(store);
  const located = store.latitude !== null && store.longitude !== null;
  return (
    <>
      {!located ? (
        <Alert tone="warning" className="mb-5">
          Esta tienda no recibe pedidos hasta que marques su ubicación en el mapa: con ella se calcula el envío de cada pedido por distancia.
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <HoursCard storeId={store.id} initial={hours} disabled={disabled} save={actions.saveStoreHours} />
          <ExceptionsCard storeId={store.id} exceptions={exceptions} save={actions.saveStoreException} remove={actions.deleteStoreException} />
        </div>
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <CardHeader title="Estado" actions={<Badge tone={state.tone}>{state.label}</Badge>} />
            <ClosureControls store={store} close={actions.closeStoreTemporarily} reopen={actions.reopenStore} setStatus={actions.setStoreStatus} />
          </Card>
          <DetailsCard store={store} update={actions.updateStore} />
          <LocationCard store={store} save={actions.setStoreLocation} />
        </div>
      </div>
    </>
  );
}

/** Ubicación de la tienda en el mapa: el pin es lo que vale; la dirección escrita (arriba) es solo apoyo. */
function LocationCard({ store, save }: { store: Store; save: Actions["setStoreLocation"] }) {
  const router = useRouter();
  const saved: LatLng | null = store.latitude !== null && store.longitude !== null ? { lat: store.latitude, lng: store.longitude } : null;
  const [point, setPoint] = useState<LatLng | null>(saved);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  const dirty = (point?.lat ?? null) !== (saved?.lat ?? null) || (point?.lng ?? null) !== (saved?.lng ?? null);

  function submit() {
    setMessage(null);
    start(async () => {
      const result = await save(store.id, { latitude: point?.lat ?? null, longitude: point?.lng ?? null });
      setMessage(result.ok ? { ok: true, text: point ? "Ubicación guardada." : "Ubicación quitada." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Ubicación en el mapa" />
      <div className="flex flex-col gap-3.5">
        <PinPicker
          label="Punto exacto de la tienda"
          hint="Toca el mapa o arrastra el pin hasta la entrada de la tienda. Sirve para calcular rutas de entrega."
          value={point}
          onChange={setPoint}
          disabled={pending}
        />
        <Feedback message={message} />
        <Button variant="primary" disabled={pending || !dirty} onClick={submit} className="self-start">
          <MapPin className="size-4" aria-hidden="true" />
          {pending ? "Guardando…" : "Guardar ubicación"}
        </Button>
      </div>
    </Card>
  );
}

function DetailsCard({ store, update }: { store: Store; update: Actions["updateStore"] }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: store.name, address: store.address ?? "", phone: store.phone ?? "" });
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await update(store.id, values);
      setMessage(result.ok ? { ok: true, text: "Datos guardados." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Datos de la tienda" />
      <form onSubmit={save} className="flex flex-col gap-3.5" noValidate>
        <Field label="Nombre" value={values.name} onChange={set("name")} required />
        <Field label="Dirección" icon={<MapPin className="size-4" />} value={values.address} onChange={set("address")} />
        <Field label="Teléfono de contacto" icon={<Smartphone className="size-4" />} type="tel" value={values.phone} onChange={set("phone")} />
        <Feedback message={message} />
        <Button variant="primary" type="submit" disabled={pending || values.name.trim().length < 2} className="self-start">
          <Check className="size-4" aria-hidden="true" />
          {pending ? "Guardando…" : "Guardar datos"}
        </Button>
      </form>
    </Card>
  );
}

function ClosureControls({ store, close, reopen, setStatus }: { store: Store; close: Actions["closeStoreTemporarily"]; reopen: Actions["reopenStore"]; setStatus: Actions["setStoreStatus"] }) {
  const router = useRouter();
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [statusDialog, setStatusDialog] = useState(false);
  const [pending, start] = useTransition();
  const closed = store.closed_until !== null && new Date(store.closed_until) > new Date();
  const next = store.status === "activa" ? "inactiva" : "activa";

  function run(task: () => Promise<ActionResult>, okText: string) {
    setMessage(null);
    start(async () => {
      const result = await task();
      setMessage(result.ok ? { ok: true, text: okText } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {closed ? (
        <>
          <Alert tone="warning" icon={<CalendarOff className="size-[18px]" />}>
            Cerrada hasta el {formatStoreDateTime(store.closed_until)}.{store.closed_reason ? ` Motivo: ${store.closed_reason}.` : ""}
          </Alert>
          <Button variant="secondary" onClick={() => run(() => reopen(store.id), "La tienda se reabrió.")} disabled={pending} className="self-start">
            Reabrir ahora
          </Button>
        </>
      ) : store.status === "activa" ? (
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            run(() => close(store.id, { until, reason }), "Cierre temporal programado.");
          }}
        >
          <p className="text-[12.5px] text-tinta-suave">Cierre temporal: la tienda no recibe pedidos hasta la fecha que indiques (hora de Nicaragua, máximo 90 días).</p>
          <Field label="Reabre el" type="datetime-local" value={until} min={`${todayInStoreZone()}T00:00`} onChange={(e) => setUntil(e.target.value)} required />
          <Field label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} hint="Opcional" maxLength={200} />
          <Button variant="secondary" type="submit" disabled={pending || !until} className="self-start">
            Cerrar temporalmente
          </Button>
        </form>
      ) : null}
      <Feedback message={message} />
      <hr className="border-borde" />
      <div>
        <p className="mb-2 text-[12.5px] text-tinta-suave">{store.status === "activa" ? "Una tienda inactiva deja de aparecer y de vender; conserva su historial." : "La tienda está inactiva: no aparece ni vende."}</p>
        <Button variant={next === "inactiva" ? "danger" : "secondary"} onClick={() => setStatusDialog(true)} disabled={pending}>
          {next === "inactiva" ? "Desactivar tienda" : "Activar tienda"}
        </Button>
      </div>
      <ReasonDialog
        open={statusDialog}
        onClose={() => setStatusDialog(false)}
        title={next === "inactiva" ? "Desactivar tienda" : "Activar tienda"}
        description={`Se cambiará el estado de «${store.name}» a ${next}.`}
        confirmLabel="Confirmar"
        danger={next === "inactiva"}
        onConfirm={(text) => setStatus(store.id, { status: next, reason: text })}
      />
    </div>
  );
}

type Draft = Record<number, { opens: string; closes: string }[]>;

function HoursCard({ storeId, initial, disabled, save }: { storeId: string; initial: HoursByDay; disabled: boolean; save: Actions["saveStoreHours"] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => structuredClone(initial));
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  const setRange = (day: number, index: number, key: "opens" | "closes", value: string) =>
    setDraft((d) => ({ ...d, [day]: (d[day] ?? []).map((range, i) => (i === index ? { ...range, [key]: value } : range)) }));
  const addRange = (day: number) =>
    setDraft((d) => {
      const last = d[day]?.at(-1);
      const next = last ? { opens: last.closes, closes: last.closes < "23:00" ? "23:00" : last.closes } : { opens: "08:00", closes: "17:00" };
      return { ...d, [day]: [...(d[day] ?? []), next] };
    });
  const removeRange = (day: number, index: number) => setDraft((d) => ({ ...d, [day]: (d[day] ?? []).filter((_, i) => i !== index) }));
  const copyToAll = (day: number) => setDraft((d) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((n) => [n, structuredClone(d[day] ?? [])])));

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await save(storeId, flattenHours(draft));
      setMessage(result.ok ? { ok: true, text: "Horario guardado." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Horario semanal" subtitle="Hora de Nicaragua. Un día puede tener varios tramos; sin tramos, ese día está cerrado." />
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <ul className="flex flex-col divide-y divide-borde">
          {weekdays.map(({ value, label }) => {
            const ranges = draft[value] ?? [];
            return (
              <li key={value} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[110px_minmax(0,1fr)]">
                <div className="flex items-center justify-between gap-2 sm:block">
                  <p className="text-sm font-bold text-tinta">{label}</p>
                  {ranges.length > 0 ? (
                    <button type="button" onClick={() => copyToAll(value)} className="rounded text-[11.5px] font-bold text-hoja underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-hoja">
                      Copiar a todos
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  {ranges.length === 0 ? <p className="py-2 text-[13px] text-tinta-suave">Cerrado</p> : null}
                  {ranges.map((range, index) => (
                    <div key={index} className="flex flex-wrap items-end gap-2">
                      <Field label={`${label}, apertura ${index + 1}`} hideLabel type="time" value={range.opens} onChange={(e) => setRange(value, index, "opens", e.target.value)} />
                      <span aria-hidden="true" className="pb-3 text-tinta-suave">
                        a
                      </span>
                      <Field label={`${label}, cierre ${index + 1}`} hideLabel type="time" value={range.closes} onChange={(e) => setRange(value, index, "closes", e.target.value)} />
                      <Button variant="ghost" onClick={() => removeRange(value, index)} aria-label={`Quitar tramo ${index + 1} del ${label.toLowerCase()}`} className="min-h-11 px-3">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" onClick={() => addRange(value)} className="min-h-9 self-start px-3">
                    <Plus className="size-4" aria-hidden="true" />
                    Agregar tramo
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <Feedback message={message} />
        <Button variant="primary" type="submit" disabled={pending || disabled} className="self-start">
          <Clock className="size-4" aria-hidden="true" />
          {pending ? "Guardando…" : "Guardar horario"}
        </Button>
      </form>
    </Card>
  );
}

function ExceptionsCard({ storeId, exceptions, save, remove }: { storeId: string; exceptions: Exception[]; save: Actions["saveStoreException"]; remove: Actions["deleteStoreException"] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [closed, setClosed] = useState(true);
  const [opens, setOpens] = useState("08:00");
  const [closes, setCloses] = useState("12:00");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  function run(task: () => Promise<ActionResult>, okText: string, after?: () => void) {
    setMessage(null);
    start(async () => {
      const result = await task();
      setMessage(result.ok ? { ok: true, text: okText } : { ok: false, text: result.error });
      if (result.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Excepciones por fecha" subtitle="Feriados o días con horario distinto. Mandan sobre el horario semanal." />
      {exceptions.length === 0 ? (
        <p className="mb-4 text-[13px] text-tinta-suave">No hay excepciones próximas.</p>
      ) : (
        <ul className="mb-4 flex flex-col divide-y divide-borde">
          {exceptions.map((item) => (
            <li key={item.on_date} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-bold capitalize text-tinta">{formatCalendarDate(item.on_date)}</p>
                <p className="text-xs text-tinta-suave">
                  {item.closed ? "Cerrada todo el día" : `Abierta de ${item.opens} a ${item.closes}`}
                  {item.note ? ` · ${item.note}` : ""}
                </p>
              </div>
              <Button variant="ghost" onClick={() => run(() => remove(storeId, item.on_date), "Excepción eliminada.")} disabled={pending} aria-label={`Quitar la excepción del ${formatCalendarDate(item.on_date)}`} className="min-h-10 px-3">
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-3 rounded-panel bg-calido/50 p-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          run(() => save(storeId, { on_date: date, closed, opens: closed ? undefined : opens, closes: closed ? undefined : closes, note }), "Excepción guardada.", () => {
            setDate("");
            setNote("");
          });
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Fecha" type="date" value={date} min={todayInStoreZone()} onChange={(e) => setDate(e.target.value)} required />
          <Field label="Nota" value={note} onChange={(e) => setNote(e.target.value)} hint="Opcional, ej.: feriado" maxLength={120} />
        </div>
        <label className="flex min-h-11 items-center gap-2.5 text-sm font-bold text-tinta">
          <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} className="size-4 accent-[var(--hoja)]" />
          Cerrada todo el día
        </label>
        {!closed ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Apertura" type="time" value={opens} onChange={(e) => setOpens(e.target.value)} />
            <Field label="Cierre" type="time" value={closes} onChange={(e) => setCloses(e.target.value)} />
          </div>
        ) : null}
        <Feedback message={message} />
        <Button variant="secondary" type="submit" disabled={pending || !date} className="self-start">
          <Plus className="size-4" aria-hidden="true" />
          Agregar excepción
        </Button>
      </form>
    </Card>
  );
}
