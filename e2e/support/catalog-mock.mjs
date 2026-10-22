// Supabase mínimo para las pruebas del catálogo sin backend: responde solo las funciones públicas (`catalog_*`, `catalog_search_*`
// y `quote_cart`) con dos tiendas (una de vendedor propio y una empresa) y un puñado de productos. Lo levanta
// `playwright.config.ts` cuando no hay Supabase local.
import { createServer } from "node:http";
import { CATEGORY2_ID, CATEGORY_ID, PRODUCT_ID, STORE2_ID, STORE_ID, VARIANT_ID } from "./catalog-ids.mjs";

const hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "00:00", closes: "23:59" }));
const stores = [
  { id: STORE_ID, name: "Café de pruebas", address: "Barrio Central", delivery_fee: 30, open_now: true, closed_until: null, closed_reason: null, commerce_kind: "informal" },
  { id: STORE2_ID, name: "Distribuidora Norte", address: "Carretera Norte km 5", delivery_fee: 50, open_now: true, closed_until: null, closed_reason: null, commerce_kind: "empresa" },
];
const categories = [
  { id: CATEGORY_ID, name: "Café" },
  { id: CATEGORY2_ID, name: "Abarrotes" },
];
const uuid = (n) => `77777777-7777-4777-8777-${String(n).padStart(12, "0")}`;
// [id, tienda, categoría, nombre, descripción, [[variante, precio, máximo]], marca, fecha de alta]
const products = [
  [PRODUCT_ID, STORE_ID, CATEGORY_ID, "Café molido", "Tostado medio, molido para filtro.", [["500 g", 150, 5]], null, "2026-10-01"],
  [uuid(1), STORE_ID, CATEGORY_ID, "Café en grano", "Grano entero de altura.", [["250 g", 120, null], ["1 kg", 410, null]], "Cafetalera del Norte", "2026-10-05"],
  [uuid(2), STORE_ID, CATEGORY_ID, "Capuchino", "Espresso con leche espumada.", [["12 oz", 45, null]], null, "2026-10-10"],
  [uuid(3), STORE2_ID, CATEGORY2_ID, "Arroz blanco", "Arroz de grano largo.", [["Libra", 14, null], ["Quintal", 1250, null]], null, "2026-10-03"],
  [uuid(4), STORE2_ID, CATEGORY2_ID, "Frijoles rojos", "Frijol rojo de seda.", [["Libra", 30, null]], null, "2026-10-12"],
  [uuid(5), STORE2_ID, CATEGORY2_ID, "Aceite vegetal", "Aceite para cocinar.", [["1 litro", 66, null]], null, "2026-10-08"],
  [uuid(6), STORE2_ID, CATEGORY2_ID, "Azúcar", "Azúcar blanca.", [["Libra", 22, null]], null, "2026-10-15"],
  [uuid(7), STORE2_ID, CATEGORY_ID, "Café instantáneo", "Frasco de café soluble.", [["200 g", 180, null]], null, "2026-10-14"],
].map(([id, store, category, name, description, variants, brand, created]) => ({
  id, store, category, name, description, brand, created,
  variants: variants.map(([vname, price, max], i) => ({ id: id === PRODUCT_ID && i === 0 ? VARIANT_ID : `${id.slice(0, -2)}${String(i).padStart(2, "9")}`, name: vname, price, available: true, max_per_order: max })),
}));

const storeOf = (id) => stores.find((s) => s.id === id);
const categoryOf = (id) => categories.find((c) => c.id === id);
const norm = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function searchProducts(a) {
  const q = a.p_query ? norm(a.p_query) : null;
  let rows = products.filter((p) => {
    const store = storeOf(p.store);
    const price = Math.min(...p.variants.map((v) => v.price));
    return (!a.p_store || p.store === a.p_store) && (!a.p_category || p.category === a.p_category) && (!a.p_kind || store.commerce_kind === a.p_kind) &&
      (!q || norm(p.name).includes(q)) && (a.p_min_price == null || price >= a.p_min_price) && (a.p_max_price == null || price <= a.p_max_price) &&
      (!a.p_open_only || store.open_now);
  });
  const price = (p) => Math.min(...p.variants.map((v) => v.price));
  const sorters = {
    precio_asc: (x, y) => price(x) - price(y),
    precio_desc: (x, y) => price(y) - price(x),
    recientes: (x, y) => y.created.localeCompare(x.created),
  };
  rows = rows.sort(sorters[a.p_sort] ?? ((x, y) => x.name.localeCompare(y.name, "es")));
  const total = rows.length;
  const offset = a.p_offset ?? 0;
  return rows.slice(offset, offset + (a.p_limit ?? 24)).map((p) => {
    const quick = [...p.variants].sort((x, y) => x.price - y.price)[0];
    return {
      id: p.id, store_id: p.store, store_name: storeOf(p.store).name, name: p.name, category_id: p.category, category_name: categoryOf(p.category).name,
      min_price: quick.price, cover_path: null, variant_count: p.variants.length, quick_variant_id: quick.id, quick_variant_name: quick.name,
      quick_max: quick.max_per_order, commerce_kind: storeOf(p.store).commerce_kind, store_open: true, created_at: `${p.created}T12:00:00Z`, brand_name: p.brand, total_count: total,
    };
  });
}

const handlers = {
  catalog_stores: () => stores.map((s) => ({ ...s, product_count: products.filter((p) => p.store === s.id).length })),
  catalog_search_stores: (a) =>
    stores
      .filter((s) => (!a.p_kind || s.commerce_kind === a.p_kind) && (!a.p_query || norm(s.name).includes(norm(a.p_query))) && (!a.p_category || products.some((p) => p.store === s.id && p.category === a.p_category)))
      .map((s) => ({ ...s, product_count: products.filter((p) => p.store === s.id).length, categories: [...new Set(products.filter((p) => p.store === s.id).map((p) => categoryOf(p.category).name))] })),
  catalog_store: (a) => {
    const s = storeOf(a.p_store);
    return s ? { ...s, hours } : null;
  },
  catalog_categories: (a) =>
    categories
      .map((c) => ({ id: c.id, name: c.name, product_count: products.filter((p) => p.category === c.id && (!a.p_store || p.store === a.p_store)).length }))
      .filter((c) => c.product_count > 0),
  catalog_products: (a) => searchProducts(a).map(({ total_count: _t, ...rest }) => rest),
  catalog_search_products: searchProducts,
  catalog_product: (a) => {
    const p = products.find((x) => x.id === a.p_product);
    if (!p) return null;
    const s = storeOf(p.store);
    return {
      id: p.id, name: p.name, description: p.description, category_id: p.category, category_name: categoryOf(p.category).name, brand_name: p.brand,
      store: { id: s.id, name: s.name, delivery_fee: s.delivery_fee, open_now: true, commerce_kind: s.commerce_kind, closed_until: null, closed_reason: null },
      images: [], variants: p.variants,
    };
  },
  quote_cart: (body) => {
    const items = Array.isArray(body.p_items) ? body.p_items : [];
    const all = products.flatMap((p) => p.variants.map((v) => ({ p, v })));
    const lines = items
      .map((i) => ({ i, hit: all.find((x) => x.v.id === i.variant_id && x.p.store === body.p_store) }))
      .filter((x) => x.hit)
      .map(({ i, hit }) => ({
        variant_id: hit.v.id, product_id: hit.p.id, product_name: hit.p.name, variant_name: hit.v.name, cover_path: null, unit_price: hit.v.price,
        quantity: i.quantity, line_total: hit.v.price * i.quantity, available: true, max_per_order: hit.v.max_per_order ?? 5,
      }));
    const store = storeOf(body.p_store) ?? stores[0];
    const subtotal = lines.reduce((sum, l) => sum + l.line_total, 0);
    return { store: { id: store.id, name: store.name, open_now: true }, lines, subtotal, delivery_fee: store.delivery_fee, total: subtotal + store.delivery_fee, problems: [] };
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
