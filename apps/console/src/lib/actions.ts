"use server";

import { redirect } from "next/navigation";
import { serverSupabase } from "./supabase";

export async function signOut() {
  const supabase = await serverSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
