import { notFound } from "next/navigation";
import { z } from "zod";
import { CourierDetail } from "@/components/courier-detail";
import { first, type SearchParams } from "@/lib/filters";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { courierDocumentUrl, inviteCourier, revokeCourierAccount, setCourierStatus, updateCourierById } from "../actions";
import { CourierAccountCard } from "../courier-account-card";
import { CourierEditCard } from "../courier-edit-card";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Repartidor" };

export default async function RepartidorFichaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [{ data }, { data: invitation }] = await Promise.all([
    supabase.from("couriers_list").select("id, full_name, phone, vehicle_type, status, user_id, available").eq("id", id).maybeSingle(),
    supabase.from("courier_invitations").select("expires_at").eq("courier_id", id).eq("status", "pendiente").gt("expires_at", new Date().toISOString()).maybeSingle(),
  ]);
  if (!data?.id) notFound();

  return (
    <CourierDetail
      id={id}
      listPath="/admin/repartidores"
      periodKey={first(query.periodo)}
      manage={
        <div className="flex flex-col gap-5">
          <CourierEditCard id={id} name={data.full_name ?? ""} phone={data.phone ?? ""} vehicle={data.vehicle_type ?? ""} status={data.status === "activo" ? "activo" : "inactivo"} update={updateCourierById} setStatus={setCourierStatus} documentUrl={courierDocumentUrl} />
          <CourierAccountCard
            id={id}
            name={data.full_name ?? ""}
            active={data.status === "activo"}
            hasAccount={data.user_id !== null}
            available={data.available === true}
            pendingUntil={invitation?.expires_at ? formatDateTime(invitation.expires_at) : null}
            invite={inviteCourier}
            revoke={revokeCourierAccount}
          />
        </div>
      }
    />
  );
}
