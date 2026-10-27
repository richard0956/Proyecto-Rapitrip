import { getSessionInfo } from "@rapitrip/supabase";
import { setDefaultAddress } from "@/app/(tienda)/perfil/direcciones/actions";
import { signOut } from "@/lib/actions";
import { serverSupabase } from "@/lib/supabase";
import type { HeaderAddress } from "./address-picker";
import { SiteNav } from "./site-nav";

export async function SiteHeader() {
  const supabase = await serverSupabase();
  const session = await getSessionInfo(supabase);
  let addresses: HeaderAddress[] = [];
  if (session.signedIn) {
    // Si la lectura falla, el encabezado invita a agregar una dirección en vez de romper la página.
    const { data } = await supabase.from("my_addresses").select("id, label, address, is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false });
    addresses = (data ?? []).map((row) => ({ id: row.id as string, label: row.label as string, address: row.address as string, is_default: !!row.is_default }));
  }
  return <SiteNav signedIn={session.signedIn} email={session.email} addresses={addresses} setDefault={setDefaultAddress} signOut={signOut} />;
}
