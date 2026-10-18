import { createHmac } from "node:crypto";

/** Los flujos de pago reales necesitan claves de Stripe en MODO PRUEBA, las Edge Functions sirviéndose (`supabase functions serve`) y el secreto interno. */
export const stripeKey = process.env.STRIPE_SECRET_KEY;
export const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
export const internalSecret = process.env.OUTBOX_SECRET;
export const hasStripe = Boolean(stripeKey?.startsWith("sk_test_") && webhookSecret && internalSecret && process.env.SUPABASE_URL);
export const stripeHint =
  "Requiere STRIPE_SECRET_KEY (sk_test_...), STRIPE_WEBHOOK_SECRET y OUTBOX_SECRET (los de supabase/functions/.env), Supabase local y `supabase functions serve`.";

export const functionsUrl = () => `${process.env.SUPABASE_URL}/functions/v1`;

/** Firma un cuerpo igual que Stripe, para entregar al webhook local eventos construidos con datos reales de Stripe. */
export function signedHeader(payload: string, secret = webhookSecret!, at = Math.floor(Date.now() / 1000)) {
  return `t=${at},v1=${createHmac("sha256", secret).update(`${at}.${payload}`).digest("hex")}`;
}

export async function stripeGet<T = Record<string, any>>(path: string): Promise<T> {
  const response = await fetch(`https://api.stripe.com${path}`, { headers: { Authorization: `Bearer ${stripeKey}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(`Stripe ${path}: ${data?.error?.message}`);
  return data as T;
}

/** Evento `checkout.session.completed` armado con la sesión real (ya pagada) recuperada de Stripe. */
export async function completedEventFor(sessionId: string, eventId: string) {
  const session = await stripeGet(`/v1/checkout/sessions/${sessionId}`);
  return JSON.stringify({ id: eventId, object: "event", type: "checkout.session.completed", data: { object: session } });
}

export async function postWebhook(body: string, signature: string) {
  const response = await fetch(`${functionsUrl()}/stripe-webhook`, { method: "POST", headers: { "stripe-signature": signature, "content-type": "application/json" }, body });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, any> };
}
