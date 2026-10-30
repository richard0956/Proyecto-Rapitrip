import { getSessionInfo } from "@rapitrip/supabase";
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase";

/**
 * «Descargar mis datos»: un JSON con lo que Rapitrip guarda de la cuenta (perfil, direcciones, pedidos, solicitudes de comercio
 * y de eliminación). Se arma con las vistas `my_*`, que solo devuelven lo del propio cliente con su sesión vigente.
 */
export async function GET() {
  const supabase = await serverSupabase();
  const session = await getSessionInfo(supabase);
  if (!session.signedIn) return NextResponse.redirect(new URL("/ingresar?next=%2Fajustes%2Fdatos", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));

  const [profile, addresses, orders, commerceRequests, deletionRequests] = await Promise.all([
    supabase.from("my_profile").select("full_name, email, phone, created_at, last_sign_in_at, notify_order_email").maybeSingle(),
    supabase.from("my_addresses").select("label, address, reference, phone, is_default, department, latitude, longitude, created_at"),
    supabase.from("my_order_units").select("*"),
    supabase.from("my_commerce_requests").select("*"),
    supabase.from("my_deletion_requests").select("status, created_at, resolved_at"),
  ]);
  // La vista del perfil responde vacía si la sesión de un día venció: se pide ingresar de nuevo antes de entregar un archivo incompleto.
  if (!profile.data) return NextResponse.json({ error: "Tu sesión venció. Ingresa de nuevo para descargar tus datos." }, { status: 401 });

  const body = {
    generado: new Date().toISOString(),
    nota: "Datos de tu cuenta en Rapitrip. Guarda este archivo en un lugar seguro: contiene información personal.",
    perfil: profile.data,
    direcciones: addresses.data ?? [],
    pedidos: orders.data ?? [],
    solicitudes_de_comercio: commerceRequests.data ?? [],
    solicitudes_de_eliminacion: deletionRequests.data ?? [],
  };
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapitrip-mis-datos-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
