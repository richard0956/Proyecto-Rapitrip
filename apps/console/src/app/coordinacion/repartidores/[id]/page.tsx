import { notFound } from "next/navigation";
import { z } from "zod";
import { CourierDetail } from "@/components/courier-detail";
import { first, type SearchParams } from "@/lib/filters";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Repartidor" };

export default async function RepartidorFichaCoordinacionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { data } = await supabase.from("couriers_list").select("id").eq("id", id).maybeSingle();
  if (!data?.id) notFound();
  return <CourierDetail id={id} listPath="/coordinacion/repartidores" periodKey={first(query.periodo)} />;
}
