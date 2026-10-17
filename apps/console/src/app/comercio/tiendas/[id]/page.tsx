import { Alert, buttonStyles } from "@rapitrip/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { groupHours, todayInStoreZone } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import { closeStoreTemporarily, deleteStoreException, reopenStore, saveStoreException, saveStoreHours, setStoreStatus, updateStore } from "../actions";
import { StoreEditor } from "./store-editor";

export default async function TiendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const [store, hours, exceptions] = await Promise.all([
    supabase.from("stores_list").select("*").eq("id", id).maybeSingle(),
    supabase.from("store_hours_list").select("weekday, opens, closes").eq("store_id", id),
    supabase.from("store_exceptions_list").select("on_date, closed, opens, closes, note").eq("store_id", id).gte("on_date", todayInStoreZone()).order("on_date"),
  ]);
  if (!store.data || !store.data.id || !store.data.name) notFound();
  const failed = hours.error || exceptions.error;
  if (failed) console.error("[tienda]", hours.error?.message, exceptions.error?.message);

  return (
    <>
      <PageHeader
        title={store.data.name}
        description="Datos, horario y cierres de esta tienda."
        actions={
          <Link href="/comercio/tiendas" className={buttonStyles({ variant: "ghost" })}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Mis tiendas
          </Link>
        }
      />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar el horario completo. Recarga la página antes de editar.</Alert> : null}
      <StoreEditor
        store={{
          id: store.data.id,
          name: store.data.name,
          address: store.data.address,
          phone: store.data.contact_phone,
          status: store.data.status === "inactiva" ? "inactiva" : "activa",
          closed_until: store.data.closed_until,
          closed_reason: store.data.closed_reason,
          open_now: store.data.open_now,
        }}
        hours={groupHours(hours.data ?? [])}
        exceptions={(exceptions.data ?? []).flatMap((row) => (row.on_date ? [{ on_date: row.on_date, closed: Boolean(row.closed), opens: row.opens, closes: row.closes, note: row.note }] : []))}
        disabled={Boolean(failed)}
        actions={{ updateStore, setStoreStatus, saveStoreHours, closeStoreTemporarily, reopenStore, saveStoreException, deleteStoreException }}
      />
    </>
  );
}
