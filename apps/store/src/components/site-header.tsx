import { getSessionInfo } from "@rapitrip/supabase";
import { setDefaultAddress } from "@/app/(tienda)/ajustes/direcciones/actions";
import { signOut } from "@/lib/actions";
import { avatarUrl } from "@/lib/avatar";
import { serverSupabase } from "@/lib/supabase";
import type { HeaderAddress } from "./address-picker";
import { SiteNav } from "./site-nav";

export async function SiteHeader() {
  const supabase = await serverSupabase();
  const session = await getSessionInfo(supabase);
  let addresses: HeaderAddress[] = [];
  let photo: string | null = null;
  if (session.signedIn) {
    const { data: profile } = await supabase.from("my_profile").select("avatar_path").maybeSingle();
    photo = await avatarUrl(supabase, profile?.avatar_path);
    // Si la lectura falla, el encabezado invita a agregar una dirección en vez de romper la página.
    const { data } = await supabase.from("my_addresses").select("id, label, address, is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false });
    addresses = (data ?? []).map((row) => ({ id: row.id as string, label: row.label as string, address: row.address as string, is_default: !!row.is_default }));
  }
  return <SiteNav signedIn={session.signedIn} email={session.email} photo={photo} addresses={addresses} setDefault={setDefaultAddress} signOut={signOut} />;
}
