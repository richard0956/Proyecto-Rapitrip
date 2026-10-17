import { getSessionInfo } from "@rapitrip/supabase";
import { signOut } from "@/lib/actions";
import { serverSupabase } from "@/lib/supabase";
import { SiteNav } from "./site-nav";

export async function SiteHeader() {
  const session = await getSessionInfo(await serverSupabase());
  return <SiteNav signedIn={session.signedIn} email={session.email} signOut={signOut} />;
}
