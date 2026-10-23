import { notFound } from "next/navigation";
import { z } from "zod";
import { CourierDetail } from "@/components/courier-detail";
import { first, type SearchParams } from "@/lib/filters";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { courierDocumentUrl, setCourierStatus, updateCourierById } from "../actions";
import { CourierEditCard } from "../courier-edit-card";

export const metadata = { title: "Repartidor" };

export default async function RepartidorFichaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data } = await supabase.from("couriers_list").select("id, full_name, phone, vehicle_type, status").eq("id", id).maybeSingle();
  if (!data?.id) notFound();

  return (
    <CourierDetail
      id={id}
      listPath="/admin/repartidores"
      periodKey={first(query.periodo)}
      manage={<CourierEditCard id={id} name={data.full_name ?? ""} phone={data.phone ?? ""} vehicle={data.vehicle_type ?? ""} status={data.status === "activo" ? "activo" : "inactivo"} update={updateCourierById} setStatus={setCourierStatus} documentUrl={courierDocumentUrl} />}
    />
  );
}
