"use client";

import { Alert, Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, pillStyles } from "@rapitrip/ui";
import { Minus, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { formatMoney } from "@/lib/money";
import type { CloseResult } from "./actions";

export type CatalogRow = { storeId: string; storeName: string; variantId: string; product: string; variant: string; sku: string; price: number; quantity: number | null };
export type Sale = { id: string; number: number; store: string; voided: boolean; method: "efectivo" | "tarjeta"; total: number; at: string };
export type Shift = { id: string; openedAt: string; opening: number; closed: boolean; difference: number | null; note: string | null; salesCount: number; salesTotal: number; cashExpected: number };

type Actions = {
  openCashSession: (opening: number) => Promise<ActionResult>;
  closeCashSession: (input: { counted: number; note?: string }) => Promise<CloseResult>;
  createCounterSale: (input: { store: string; method: "efectivo" | "tarjeta"; items: { variant_id: string; quantity: number }[] }) => Promise<ActionResult>;
  voidCounterSale: (id: string, reason: string) => Promise<ActionResult>;
};

type Message = { ok: boolean; text: string } | null;
const Feedback = ({ message }: { message: Message }) => (message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null);

export function CashWorkspace({ shift, history, catalog, sales, actions }: { shift: Shift | null; history: Shift[]; catalog: CatalogRow[]; sales: Sale[]; actions: Actions }) {
  return shift ? (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <SalePanel catalog={catalog} create={actions.createCounterSale} />
      <div className="flex flex-col gap-5">
        <ShiftCard shift={shift} close={actions.closeCashSession} />
        <SalesCard sales={sales} voidSale={actions.voidCounterSale} />
      </div>
    </div>
  ) : (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <OpenCard open={actions.openCashSession} />
      <HistoryCard history={history} />
    </div>
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
      const result = await create({ store: storeId, method, items: lines.map((line) => ({ variant_id: line.row.variantId, quantity: line.quantity })) });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setMessage({ ok: true, text: `Venta registrada por ${formatMoney(total)}.` });
      setCart({});
      setReceived("");
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
          <p className="mb-3 text-xs text-tinta-suave">Cobra en el terminal de tarjeta y registra aquí la venta.</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-bold tabular-nums text-tinta">Total {formatMoney(total)}</p>
          <Button variant="primary" onClick={charge} disabled={pending || lines.length === 0 || (change !== null && change < 0)}>
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

function ShiftCard({ shift, close }: { shift: Shift; close: Actions["closeCashSession"] }) {
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
          <Field label="Nota" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} hint="Obligatoria si hay diferencia" />
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
