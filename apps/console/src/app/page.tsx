import { getSessionInfo, homePathForRole } from "@rapitrip/supabase";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase";

export default async function Home() {
  const session = await getSessionInfo(await serverSupabase());
  redirect(session.signedIn ? homePathForRole(session.role) : "/login");
}
