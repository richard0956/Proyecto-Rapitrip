import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { siteUrl } from "@/lib/site-url";
import { serverSupabase } from "@/lib/supabase";

/** Cierra el intercambio PKCE de Google, de la confirmación de correo, del cambio de correo y de la recuperación de contraseña. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Tras el proxy, nextUrl puede contener 0.0.0.0:3000; el destino debe usar la URL pública configurada.
  const origin = siteUrl();
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await serverSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback]", error.code ?? error.message);
  }
  // Cambio de correo con doble confirmación: el primer enlace no trae código, solo avisa que falta confirmar el otro correo.
  if (!code && searchParams.get("message")) return NextResponse.redirect(`${origin}${next}${next.includes("?") ? "&" : "?"}correo=pendiente`);
  return NextResponse.redirect(`${origin}/ingresar?error=enlace`);
}
