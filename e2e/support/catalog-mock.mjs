// Supabase mínimo para las pruebas del catálogo sin backend: responde solo las funciones públicas `catalog_*` y `quote_cart`
// con una tienda, una categoría y un producto fijos. Lo levanta `playwright.config.ts` cuando no hay Supabase local.
import { createServer } from "node:http";
import { CATEGORY_ID, PRODUCT_ID, STORE_ID, VARIANT_ID } from "./catalog-ids.mjs";

const store = { id: STORE_ID, name: "Café de pruebas", address: "Barrio Central", delivery_fee: 30, open_now: true, closed_until: null, closed_reason: null };
const hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "00:00", closes: "23:59" }));

const handlers = {
  catalog_stores: () => [{ ...store, product_count: 1 }],
  catalog_store: () => ({ ...store, hours }),
  catalog_categories: () => [{ id: CATEGORY_ID, name: "Café", product_count: 1 }],
  catalog_products: () => [
    { id: PRODUCT_ID, store_id: STORE_ID, store_name: store.name, name: "Café molido", category_id: CATEGORY_ID, category_name: "Café", min_price: 150, cover_path: null },
  ],
  catalog_product: () => ({
    id: PRODUCT_ID,
    name: "Café molido",
    description: "Tostado medio, molido para filtro.",
    category_id: CATEGORY_ID,
    category_name: "Café",
    store: { id: STORE_ID, name: store.name, delivery_fee: 30, open_now: true, closed_until: null, closed_reason: null },
    images: [],
    variants: [{ id: VARIANT_ID, name: "500 g", price: 150, available: true, max_per_order: 5 }],
  }),
  quote_cart: (body) => {
    const items = Array.isArray(body.p_items) ? body.p_items : [];
    const lines = items
      .filter((i) => i.variant_id === VARIANT_ID)
      .map((i) => ({
        variant_id: VARIANT_ID,
        product_id: PRODUCT_ID,
        product_name: "Café molido",
        variant_name: "500 g",
        cover_path: null,
        unit_price: 150,
        quantity: i.quantity,
        line_total: 150 * i.quantity,
        available: true,
        max_per_order: 5,
      }));
    const subtotal = lines.reduce((sum, l) => sum + l.line_total, 0);
    return { store: { id: STORE_ID, name: store.name, open_now: true }, lines, subtotal, delivery_fee: 30, total: subtotal + 30, problems: [] };
  },
};

const port = Number(process.env.MOCK_PORT ?? 54321);

createServer((req, res) => {
  const match = /^\/rest\/v1\/rpc\/(\w+)/.exec(req.url ?? "");
  if (req.url === "/health") {
    res.writeHead(200).end("ok");
    return;
  }
  const handler = match && handlers[match[1]];
  if (!handler) {
    res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ message: "no existe" }));
    return;
  }
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(handler(body)));
  });
}).listen(port, "127.0.0.1");
