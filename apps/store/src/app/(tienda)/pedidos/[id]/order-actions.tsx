"use client";

import { Alert, Button, Dialog, TextareaField } from "@rapitrip/ui";
import { CreditCard, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addToCart, emptyCart, type Cart } from "@/lib/cart";
import { setCart } from "@/lib/cart-store";
import { saveDraft, takeDraft } from "@/lib/draft";
import type { CustomerResult } from "@/lib/result";

type Props = {
  orderId: string;
  canCancel: boolean;
  /** Pendiente de pago con tarjeta y todavía vigente. */
  canPay: boolean;
  /** Líneas del pedido para «Repetir pedido». */
  repeat: { storeId: string; storeName: string; items: { variantId: string; quantity: number }[] } | null;
  cancel: (orderId: string, reason: string) => Promise<CustomerResult>;
  pay: (orderId: string) => Promise<{ ok: true; url: string } | { ok: false; error: string; expired?: boolean }>;
};

const DRAFT_KEY = "rapitrip:cancelar";

export function OrderActions({ orderId, canCancel, canPay, repeat, cancel, pay }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const busy = useRef(false);

  useEffect(() => {
    const draft = takeDraft<string>(DRAFT_KEY);
    if (draft) {
      // Recuperar el motivo escrito antes de que venciera la sesión solo es posible tras hidratar (sessionStorage).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason(draft);
      setOpen(true);
    }
  }, []);

  function goExpired(draft?: string) {
    if (draft) saveDraft(DRAFT_KEY, draft);
    router.replace(`/ingresar?next=${encodeURIComponent(`/pedidos/${orderId}`)}&expirada=1`);
  }

  function doCancel() {
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      try {
        const result = await cancel(orderId, reason);
        if (!result.ok && result.expired) return goExpired(reason);
        if (!result.ok) return setMessage({ tone: "error", text: result.error });
        setOpen(false);
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  function doPay() {
    if (busy.current) return;
    busy.current = true;
    setMessage(null);
    start(async () => {
      try {
        const result = await pay(orderId);
        if (!result.ok && result.expired) return goExpired();
        if (!result.ok) return setMessage({ tone: "error", text: result.error });
        // Navegación (no formulario): la CSP bloquea enviar formularios fuera del sitio.
        window.location.assign(result.url);
      } finally {
        busy.current = false;
      }
    });
  }

  function doRepeat() {
    if (!repeat) return;
    let cart: Cart = emptyCart;
    for (const item of repeat.items) cart = addToCart(cart, { storeId: repeat.storeId, storeName: repeat.storeName, variantId: item.variantId, quantity: item.quantity }, { replaceOtherStore: true }).cart;
    setCart(cart);
    router.push("/carrito");
  }

  return (
    <div className="flex flex-col gap-3">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        {canPay ? (
          <Button variant="primary" disabled={pending} onClick={doPay}>
            <CreditCard aria-hidden="true" className="size-4" />
            {pending ? "Abriendo el pago…" : "Pagar con tarjeta"}
          </Button>
        ) : null}
        {canCancel ? (
          <Button variant="danger" disabled={pending} onClick={() => { setMessage(null); setOpen(true); }}>
            <XCircle aria-hidden="true" className="size-4" />
            Cancelar pedido
          </Button>
        ) : null}
        {repeat && repeat.items.length > 0 ? (
          <Button variant="secondary" disabled={pending} onClick={doRepeat}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Repetir pedido
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="¿Cancelar tu pedido?">
        <p className="text-sm text-tinta-suave">Devolveremos los productos al inventario. Si ya pagaste con tarjeta, te reembolsamos automáticamente.</p>
        <div className="mt-4">
          <TextareaField label="Motivo de la cancelación" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {message?.tone === "error" ? <Alert tone="error" className="mt-3">{message.text}</Alert> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="danger" disabled={pending || reason.trim().length < 5} onClick={doCancel}>
            {pending ? "Cancelando…" : "Sí, cancelar"}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Volver
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
