import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { quoteCartAction } from "../carrito/actions";
import { placeOrder } from "./actions";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Confirmar pedido", robots: { index: false } };

export default async function CheckoutPage() {
  await requireCustomer("/checkout");
  const supabase = await serverSupabase();
  const { data: profile } = await supabase.from("my_profile").select("phone").maybeSingle();
  // La vista solo responde con una sesión de menos de un día: si viene vacía, hay que ingresar de nuevo.
  if (!profile) redirect(`/ingresar?next=${encodeURIComponent("/checkout")}&expirada=1`);
  const { data } = await supabase.from("my_addresses").select("id, label, address, phone, is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false });
  const addresses = (data ?? []).map((row) => ({ id: row.id as string, label: row.label as string, address: row.address as string, phone: row.phone, is_default: !!row.is_default }));

  return (
    <main className="mx-auto max-w-[1176px] px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tinta">Confirmar pedido</h1>
      <p className="mb-6 mt-1 text-[14px] text-tinta-suave">Revisa tu dirección y elige cómo pagar.</p>
      <CheckoutForm addresses={addresses} profilePhone={profile.phone ?? ""} quoteAction={quoteCartAction} placeOrder={placeOrder} />
    </main>
  );
}
