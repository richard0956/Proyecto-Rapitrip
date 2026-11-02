import type { CoordTab } from "@/lib/orders";

/** Pestañas de la lista de coordinación, en el orden de trabajo: lo que hay que despachar primero. */
export const dispatchTabs: { key: CoordTab; label: string; empty: string }[] = [
  { key: "listos", label: "Para despachar", empty: "No hay pedidos listos esperando repartidor." },
  { key: "camino", label: "En camino", empty: "No hay entregas en camino." },
  { key: "preparacion", label: "En preparación", empty: "Ningún comercio está preparando pedidos." },
  { key: "espera", label: "Por confirmar", empty: "No hay pedidos esperando respuesta o pago." },
  { key: "terminados", label: "Terminados", empty: "Todavía no hay pedidos terminados." },
];

export const tabKeys = dispatchTabs.map((tab) => tab.key);
