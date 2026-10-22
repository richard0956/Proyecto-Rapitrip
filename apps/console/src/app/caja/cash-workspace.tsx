"use client";

import { Alert, Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, pillStyles } from "@rapitrip/ui";
import { Minus, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { formatMoney } from "@/lib/money";
import type { CashIncident, CloseResult } from "./actions";

export type CatalogRow = { storeId: string; storeName: string; variantId: string; product: string; variant: string; sku: string; price: number; quantity: number | null };
export type Sale = { id: string; number: number; store: string; voided: boolean; method: "efectivo" | "tarjeta"; total: number; at: string };
export type Shift = { id: string; openedAt: string; opening: number; closed: boolean; difference: number | null; note: string | null; salesCount: number; salesTotal: number; cashExpected: number };
export type CashReturn = { requestId: string; orderNumber: number; store: string; total: number; decidedAt: string };
export type PendingCash = { orderId: string; orderNumber: number; store: string; total: number; code: string; deliveredAt: string };

type Actions = {
  openCashSession: (opening: number) => Promise<ActionResult>;
  closeCashSession: (input: { counted: number; note?: string }) => Promise<CloseResult>;
  createCounterSale: (input: { store: string; method: "efectivo" | "tarjeta"; reference?: string; items: { variant_id: string; quantity: number }[] }) => Promise<ActionResult>;
  voidCounterSale: (id: string, reason: string) => Promise<ActionResult>;
  receiveCourierCash: (orderId: string) => Promise<ActionResult>;
  returnCashToCustomer: (requestId: string) => Promise<ActionResult>;
  loadCashIncidents: (sessionId: string) => Promise<{ ok: true; incidents: CashIncident[] } | { ok: false; error: string }>;
};

type Message = { ok: boolean; text: string } | null;
const Feedback = ({ message }: { message: Message }) => (message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null);

export function CashWorkspace({ shift, history, catalog, sales, pendingCash, pendingReturns, actions }: { shift: Shift | null; history: Shift[]; catalog: CatalogRow[]; sales: Sale[]; pendingCash: PendingCash[]; pendingReturns: CashReturn[]; actions: Actions }) {
  const [lastClosed, setLastClosed] = useState<CashIncident[] | null>(null);
  return shift ? (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <SalePanel catalog={catalog} create={actions.createCounterSale} />
      <div className="flex flex-col gap-5">
        <CourierCashCard pending={pendingCash} receive={actions.receiveCourierCash} />
        <CashReturnsCard pending={pendingReturns} giveBack={actions.returnCashToCustomer} />
        <ShiftCard shift={shift} close={actions.closeCashSession} loadIncidents={actions.loadCashIncidents} onClosed={setLastClosed} />
        <SalesCard sales={sales} voidSale={actions.voidCounterSale} />
      </div>
    </div>
  ) : (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <OpenCard open={actions.openCashSession} />
      <div className="flex flex-col gap-5">
        {lastClosed ? <IncidentsCard incidents={lastClosed} /> : null}
        <HistoryCard history={history} />
      </div>
    </div>
  );
}

function CourierCashCard({ pending, receive }: { pending: PendingCash[]; receive: Actions["receiveCourierCash"] }) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function accept(orderId: string) {
    setBusy(orderId);
    setMessage(null);
    const result = await receive(orderId);
    setBusy(null);
    if (!result.ok) return setMessage({ ok: false, text: result.error });
    router.refresh();
  }

  return (
    <Card className="p-5">
      <CardHeader title="Efectivo de repartidores" subtitle="Recibe el efectivo físico que entregó cada repartidor." />
      {pending.length === 0 ? (
        <p className="text-[13px] text-tinta-suave">No hay efectivo pendiente de recibir.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {pending.map((item) => (
            <li key={item.orderId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-tinta">Pedido {item.orderNumber} · {formatMoney(item.total)}</span>
                <span className="block truncate text-xs text-tinta-suave">{item.store} · código {item.code} · entregado {item.deliveredAt}</span>
              </span>
              <Button variant="secondary" onClick={() => accept(item.orderId)} disabled={busy !== null} className="min-h-9 px-3">
                {busy === item.orderId ? "Recibiendo…" : "Recibir"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3.5">
        <Feedback message={message} />
      </div>
    </Card>
  );
}

function CashReturnsCard({ pending, giveBack }: { pending: CashReturn[]; giveBack: Actions["returnCashToCustomer"] }) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function accept(requestId: string) {
    setBusy(requestId);
    setMessage(null);
    const result = await giveBack(requestId);
    setBusy(null);
    if (!result.ok) return setMessage({ ok: false, text: result.error });
    router.refresh();
  }

  return (
    <Card className="p-5">
      <CardHeader title="Devoluciones en efectivo" subtitle="Administración aprobó estas devoluciones. Entrega el dinero al cliente y confírmalo aquí." />
      {pending.length === 0 ? (
        <p className="text-[13px] text-tinta-suave">No hay efectivo pendiente de devolver.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {pending.map((item) => (
            <li key={item.requestId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-tinta">Pedido {item.orderNumber} · {formatMoney(item.total)}</span>
                <span className="block truncate text-xs text-tinta-suave">{item.store} · aprobada {item.decidedAt}</span>
              </span>
              <Button variant="secondary" onClick={() => accept(item.requestId)} disabled={busy !== null} className="min-h-9 px-3">
                {busy === item.requestId ? "Devolviendo…" : "Devolver efectivo"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3.5">
        <Feedback message={message} />
      </div>
    </Card>
  );
}

function IncidentsCard({ incidents }: { incidents: CashIncident[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, CashIncident[]>();
    for (const item of incidents) {
      const key = item.commerceName ?? "Sin comercio";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [incidents]);

  return (
    <Card className="p-5">
      <CardHeader title="Incidencias del último cierre" subtitle="Avisa a cada comercio de sus ventas con diferencia." />
      {groups.length === 0 ? (
        <p className="text-[13px] text-tinta-suave">El cierre no tuvo incidencias.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([commerce, items]) => (
            <div key={commerce}>
              <p className="mb-1.5 text-sm font-bold text-tinta">{commerce}</p>
              <ul className="flex flex-col divide-y divide-borde">
                {items.map((item, index) => (
                  <li key={item.kind + "-" + index} className="py-2 text-sm">
                    <span className="block text-tinta">{item.detail}</span>
                    <span className="block text-xs text-tinta-suave">{item.kind.split("_").join(" ")}{item.orderNumber !== null ? " · pedido " + item.orderNumber : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function OpenCard({ open }: { open: Actions["openCashSession"] }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await open(Number(amount));
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Abrir caja" subtitle="No hay un turno abierto. Cuenta el efectivo con el que empiezas." />
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <Field label="Efectivo inicial en caja" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Feedback message={message} />
        <Button variant="primary" type="submit" disabled={pending || amount === ""} className="self-start">
          {pending ? "Abriendo…" : "Abrir caja"}
        </Button>
      </form>
    </Card>
  );
}

function HistoryCard({ history }: { history: Shift[] }) {
  return (
    <Card className="p-5">
      <CardHeader title="Turnos anteriores" />
      {history.length === 0 ? (
        <EmptyState title="Sin turnos cerrados">Aquí verás tus últimos cierres de caja.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {history.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-tinta">{item.openedAt}</span>
                <span className="block text-xs text-tinta-suave">
                  {item.salesCount} {item.salesCount === 1 ? "venta" : "ventas"} · {formatMoney(item.salesTotal)}
                </span>
              </span>
              {item.difference === 0 ? <Badge tone="positive">Cuadró</Badge> : <Badge tone="warning">Diferencia {formatMoney(item.difference)}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SalePanel({ catalog, create }: { catalog: CatalogRow[]; create: Actions["createCounterSale"] }) {
  const router = useRouter();
  const stores = useMemo(() => [...new Map(catalog.map((row) => [row.storeId, row.storeName])).entries()].map(([id, name]) => ({ id, name })), [catalog]);
  const [storeId, setStoreId] = useState<string | null>(stores[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"efectivo" | "tarjeta">("efectivo");
  const [voucher, setVoucher] = useState("");
  const [received, setReceived] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  const products = useMemo(() => {
    const text = query.trim().toLowerCase();
    return catalog.filter((row) => row.storeId === storeId && (!text || `${row.product} ${row.variant} ${row.sku}`.toLowerCase().includes(text)));
  }, [catalog, storeId, query]);
  const lines = catalog.filter((row) => cart[row.variantId]).map((row) => ({ row, quantity: cart[row.variantId]! }));
  const total = lines.reduce((sum, line) => sum + line.row.price * line.quantity, 0);
  const change = method === "efectivo" && received !== "" ? Number(received) - total : null;

  const setQuantity = (row: CatalogRow, quantity: number) =>
    setCart((current) => {
      const next = { ...current };
      const max = row.quantity ?? 99;
      const value = Math.min(Math.max(quantity, 0), Math.min(max, 99));
      if (value === 0) delete next[row.variantId];
      else next[row.variantId] = value;
      return next;
    });

  function charge() {
    if (!storeId) return;
    setMessage(null);
    start(async () => {
      const result = await create({ store: storeId, method, reference: method === "tarjeta" ? voucher : undefined, items: lines.map((line) => ({ variant_id: line.row.variantId, quantity: line.quantity })) });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setMessage({ ok: true, text: `Venta registrada por ${formatMoney(total)}.` });
      setCart({});
      setReceived("");
      setVoucher("");
      router.refresh();
    });
  }

  if (catalog.length === 0) {
    return (
      <Card>
        <CardHeader title="Nueva venta" />
        <EmptyState title="No hay productos para vender">Los comercios aún no tienen productos publicados con existencias.</EmptyState>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <CardHeader title="Nueva venta" subtitle="Elige la tienda, agrega los productos y cobra." />
      {stores.length > 1 ? (
        <div role="tablist" aria-label="Tienda" className="mb-3.5 flex flex-wrap gap-2">
          {stores.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={storeId === item.id} onClick={() => { setStoreId(item.id); setCart({}); setMessage(null); }} className={pillStyles(storeId === item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      <Field label="Buscar producto" hideLabel icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o SKU" />
      <ul className="mb-4 mt-3 flex max-h-[320px] flex-col divide-y divide-borde overflow-y-auto rounded-panel border border-borde bg-white px-3">
        {products.length === 0 ? <li className="py-3 text-[13px] text-tinta-suave">Sin resultados.</li> : null}
        {products.map((row) => (
          <li key={row.variantId} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-tinta">{row.product} <span className="font-medium text-tinta-suave">· {row.variant}</span></span>
              <span className="block text-xs text-tinta-suave">{formatMoney(row.price)}{row.quantity !== null ? ` · quedan ${row.quantity}` : ""}</span>
            </span>
            <Button variant="secondary" onClick={() => setQuantity(row, (cart[row.variantId] ?? 0) + 1)} aria-label={`Agregar ${row.product}, ${row.variant}`} className="min-h-10 px-3">
              <Plus className="size-4" aria-hidden="true" />
              Agregar
            </Button>
          </li>
        ))}
      </ul>

      <div className="rounded-panel bg-calido/50 p-4">
        <p className="mb-2 text-sm font-bold text-tinta">Venta actual</p>
        {lines.length === 0 ? (
          <p className="text-[13px] text-tinta-suave">Agrega productos para empezar.</p>
        ) : (
          <ul className="mb-3 flex flex-col divide-y divide-borde">
            {lines.map(({ row, quantity }) => (
              <li key={row.variantId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{row.product} · {row.variant}</span>
                <span className="flex items-center gap-1.5">
                  <Button variant="ghost" onClick={() => setQuantity(row, quantity - 1)} aria-label={`Quitar una unidad de ${row.product}, ${row.variant}`} className="min-h-9 px-2">
                    <Minus className="size-4" aria-hidden="true" />
                  </Button>
                  <span className="w-6 text-center font-bold tabular-nums" aria-label={`Cantidad de ${row.product}, ${row.variant}`}>{quantity}</span>
                  <Button variant="ghost" onClick={() => setQuantity(row, quantity + 1)} aria-label={`Sumar una unidad de ${row.product}, ${row.variant}`} className="min-h-9 px-2">
                    <Plus className="size-4" aria-hidden="true" />
                  </Button>
                  <span className="w-24 text-right tabular-nums text-tinta">{formatMoney(row.price * quantity)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div role="tablist" aria-label="Forma de pago" className="mb-3 flex gap-2">
          {(["efectivo", "tarjeta"] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={method === item} onClick={() => setMethod(item)} className={pillStyles(method === item)}>
              {item === "efectivo" ? "Efectivo" : "Tarjeta (terminal)"}
            </button>
          ))}
        </div>
        {method === "efectivo" ? (
          <div className="mb-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <Field label="Efectivo recibido" type="number" inputMode="decimal" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} hint="Opcional, para calcular el vuelto" />
            <p className="pb-2 text-sm text-tinta">{change === null ? "" : change >= 0 ? `Vuelto: ${formatMoney(change)}` : `Faltan ${formatMoney(-change)}`}</p>
          </div>
        ) : (
          <Field label="Voucher del terminal" value={voucher} onChange={(e) => setVoucher(e.target.value)} maxLength={20} hint="Entre 4 y 20 caracteres, el que imprime el terminal" className="mb-3" />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-bold tabular-nums text-tinta">Total {formatMoney(total)}</p>
          <Button variant="primary" onClick={charge} disabled={pending || lines.length === 0 || (change !== null && change < 0) || (method === "tarjeta" && voucher.trim().length < 4)}>
            {pending ? "Cobrando…" : "Cobrar"}
          </Button>
        </div>
      </div>
      <div className="mt-3.5">
        <Feedback message={message} />
      </div>
    </Card>
  );
}

function ShiftCard({ shift, close, loadIncidents, onClosed }: { shift: Shift; close: Actions["closeCashSession"]; loadIncidents: Actions["loadCashIncidents"]; onClosed: (incidents: CashIncident[]) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  function dismiss() {
    setOpen(false);
    setCounted("");
    setNote("");
    setMessage(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await close({ counted: Number(counted), note });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      if (result.incidentsCount > 0) {
        const detail = await loadIncidents(shift.id);
        if (detail.ok) onClosed(detail.incidents);
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Turno abierto" subtitle={`Desde ${shift.openedAt}`} actions={<Badge tone="positive">Abierto</Badge>} />
      <dl className="mb-4 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-tinta-suave">Efectivo inicial</dt>
        <dd className="tabular-nums">{formatMoney(shift.opening)}</dd>
        <dt className="text-tinta-suave">Ventas ({shift.salesCount})</dt>
        <dd className="tabular-nums">{formatMoney(shift.salesTotal)}</dd>
        <dt className="font-bold text-tinta">Efectivo esperado</dt>
        <dd className="font-bold tabular-nums text-tinta">{formatMoney(shift.cashExpected)}</dd>
      </dl>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Cerrar caja
      </Button>
      <Dialog open={open} onClose={dismiss} title="Cerrar caja">
        <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
          <p className="text-sm text-tinta-suave">Cuenta el efectivo que hay en caja. Se espera {formatMoney(shift.cashExpected)}.</p>
          <Field label="Efectivo contado" type="number" inputMode="decimal" min="0" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} />
          <Field label="Nota" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} hint="Obligatoria si hay diferencia o incidencias" />
          <Feedback message={message} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={dismiss} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={pending || counted === ""}>
              {pending ? "Cerrando…" : "Cerrar caja"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

function SalesCard({ sales, voidSale }: { sales: Sale[]; voidSale: Actions["voidCounterSale"] }) {
  const router = useRouter();
  const [target, setTarget] = useState<Sale | null>(null);
  return (
    <Card className="p-5">
      <CardHeader title="Ventas del turno" />
      {sales.length === 0 ? (
        <p className="text-[13px] text-tinta-suave">Todavía no hay ventas en este turno.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {sales.map((sale) => (
            <li key={sale.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-tinta">Venta {sale.number}</span>
                <span className="block truncate text-xs text-tinta-suave">{sale.store} · {sale.method === "efectivo" ? "Efectivo" : "Tarjeta"} · {sale.at}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`tabular-nums ${sale.voided ? "text-tinta-suave line-through" : "text-tinta"}`}>{formatMoney(sale.total)}</span>
                {sale.voided ? (
                  <Badge tone="danger">Anulada</Badge>
                ) : (
                  <Button variant="ghost" onClick={() => setTarget(sale)} aria-label={`Anular la venta ${sale.number}`} className="min-h-9 px-3">
                    Anular
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {target ? (
        <ReasonDialog
          open
          onClose={() => setTarget(null)}
          title={`Anular la venta ${target.number}`}
          description="Se devuelve el stock y el efectivo deja de contarse en el turno."
          confirmLabel="Anular venta"
          danger
          onConfirm={async (reason) => {
            const result = await voidSale(target.id, reason);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
    </Card>
  );
}
