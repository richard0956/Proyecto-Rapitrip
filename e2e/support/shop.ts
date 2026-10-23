import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { consoleSession, createCommerceAccount, createUser, PASSWORD, uniqueEmail } from "./backend";

const anon = process.env.SUPABASE_ANON_KEY!;
const url = process.env.SUPABASE_URL!;

const must = <T>(result: { data: T; error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

/** Comercio con una tienda abierta todo el día y una variante de 150.00 con 10 unidades controladas, lista para recibir pedidos. */
export async function openShop(label = "Café de pruebas", names: { store?: string; product?: string } = {}) {
  const account = await createCommerceAccount(`${label} ${Date.now()}`);
  const { client: owner, secret } = await consoleSession(account.email, account.password);
  const { data: role } = await owner.from("my_roles").select("commerce_id").eq("role", "comercio").single();
  const storeId = must(await owner.rpc("create_store", { p_commerce: role!.commerce_id!, p_name: names.store ?? "Tienda de pruebas" })) as string;
  // El pin de la tienda es obligatorio para recibir pedidos: centro de Managua.
  must(await owner.rpc("set_store_location", { p_store: storeId, p_latitude: 12.1364, p_longitude: -86.2514 }));
  must(await owner.rpc("set_store_hours", { p_store: storeId, p_hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "00:00", closes: "23:59" })) }));
  const productId = must(await owner.rpc("create_product", { p_store: storeId, p_name: names.product ?? "Café molido" })) as string;
  const variantId = must(await owner.rpc("create_variant", { p_product: productId, p_name: "500 g", p_sku: "CAFE-500", p_price: 150 })) as string;
  must(await owner.rpc("set_product_status", { p_product: productId, p_status: "publicado" }));
  must(await owner.rpc("set_stock_tracking", { p_variant: variantId, p_track: true, p_threshold: 2 }));
  must(await owner.rpc("count_stock", { p_variant: variantId, p_quantity: 10, p_reason: "conteo inicial" }));
  return { account, owner, ownerSecret: secret, storeId, variantId };
}

export async function signedInClient(): Promise<SupabaseClient> {
  const email = uniqueEmail("cliente");
  await createUser(email, { fullName: "Cliente de Pruebas" });
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

export async function placeOrder(client: SupabaseClient, storeId: string, variantId: string, quantity: number, method: "tarjeta" | "efectivo" = "tarjeta") {
  const { data, error } = await client.rpc("create_order", {
    p_store: storeId,
    p_items: [{ variant_id: variantId, quantity }],
    p_payment_method: method,
    p_address: "Barrio Central, casa 4",
    p_phone: "88881111",
    // Pin del destino (obligatorio): el mismo centro de Managua, zona 1 (envío de 50).
    p_latitude: 12.1364,
    p_longitude: -86.2514,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function orderState(client: SupabaseClient, id: string) {
  const { data } = await client.from("orders_list").select("status, payment_status").eq("id", id).single();
  return `${data!.status}/${data!.payment_status}`;
}

export async function stockOf(owner: SupabaseClient, variantId: string) {
  const { data } = await owner.from("inventory_list").select("quantity").eq("variant_id", variantId).single();
  return data!.quantity as number;
}
