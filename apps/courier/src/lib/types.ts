import type { Database } from "@rapitrip/db-types";

type Fn<K extends keyof Database["public"]["Functions"]> = Database["public"]["Functions"][K]["Returns"];
type Row<T> = T extends (infer R)[] ? R : never;

export type CourierOrder = Row<Fn<"courier_orders">>;
export type CourierOrderDetail = Row<Fn<"courier_order">>;
export type CourierOffer = Row<Fn<"courier_offers">>;
export type CourierHistoryRow = Row<Fn<"courier_history">>;
export type OrderEvidence = Row<Fn<"courier_order_evidence">>;
export type OrderIssue = Row<Fn<"courier_order_issues">>;
export type CourierMe = NonNullable<Database["public"]["Views"]["courier_me"]["Row"]>;

export type OrderItem = { name: string; variant: string; quantity: number };

export function parseItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const e = entry as { name?: unknown; variant?: unknown; quantity?: unknown } | null;
    return e && typeof e.name === "string" && typeof e.quantity === "number"
      ? [{ name: e.name, variant: typeof e.variant === "string" ? e.variant : "", quantity: e.quantity }]
      : [];
  });
}
