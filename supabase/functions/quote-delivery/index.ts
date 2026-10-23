import { createClient } from "npm:@supabase/supabase-js@2";
import { json, corsHeaders } from "../_shared/http.ts";
import { isCoordinate, isUuid, roadDistanceKm } from "../_shared/mapbox.ts";

type StorePoint = { latitude: number | string | null; longitude: number | string | null };

/**
 * Cotiza el envío de una tienda a un punto con la distancia por calle de Mapbox y la deja guardada en la base de datos.
 * El navegador solo envía tienda y punto; la zona y el monto los decide la base de datos (`record_delivery_quote`), que además es
 * la única que acepta esta cotización al crear el pedido. Si Mapbox no está disponible, la cotización se calcula por línea recta.
 * Se llama desde el servidor de la tienda con el JWT del cliente.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "no autenticado" }, 401);
  const body = await req.json().catch(() => null);
  const storeId = body?.store_id;
  const latitude = body?.latitude;
  const longitude = body?.longitude;
  if (!isUuid(storeId) || !isCoordinate(latitude, 90) || !isCoordinate(longitude, 180)) {
    return json({ error: "marca el punto exacto de entrega en el mapa" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData } = await asCaller.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return json({ error: "no autenticado" }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: points, error: pointError } = await admin.rpc("delivery_store_point", { p_store: storeId });
  if (pointError) {
    console.error("[quote-delivery] punto de la tienda", pointError.message);
    return json({ error: "no pudimos calcular el envío" }, 500);
  }
  const store = (points as StorePoint[] | null)?.[0];
  if (!store) return json({ error: "tienda no disponible" }, 404);
  if (store.latitude === null || store.longitude === null) {
    return json({ error: "esta tienda aún no tiene su ubicación en el mapa y no puede recibir pedidos a domicilio" }, 422);
  }

  // Sin token o sin respuesta de Mapbox la distancia queda en null y la base de datos usa la línea recta.
  const roadKm = await roadDistanceKm(
    { lat: Number(store.latitude), lng: Number(store.longitude) },
    { lat: latitude, lng: longitude },
    Deno.env.get("MAPBOX_TOKEN") ?? "",
  );

  const { data, error } = await admin.rpc("record_delivery_quote", {
    p_client: userId,
    p_store: storeId,
    p_latitude: latitude,
    p_longitude: longitude,
    ...(roadKm === null ? {} : { p_road_km: roadKm }),
  });
  if (error) {
    // 22023 son reglas de negocio con mensaje para el cliente (fuera de cobertura, punto fuera de Nicaragua...).
    if (error.code === "22023") return json({ error: error.message }, 422);
    console.error("[quote-delivery] guardar cotización", error.message);
    return json({ error: "no pudimos calcular el envío" }, 500);
  }
  return json(data);
});
