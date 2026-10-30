import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { deleteAddress, saveAddress, setDefaultAddress } from "./actions";
import { SectionCard } from "../section-card";
import { AddressBook } from "./address-book";

export const metadata: Metadata = { title: "Direcciones" };

export default async function DireccionesPage() {
  await requireCustomer("/ajustes/direcciones");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("my_addresses").select("id, label, address, reference, phone, is_default, latitude, longitude, department").order("is_default", { ascending: false }).order("created_at", { ascending: false });
  // La vista responde vacía (no con error) si la sesión de un día venció: confirmarlo con el perfil evita tomarlo por «sin direcciones».
  const { data: profile } = await supabase.from("my_profile").select("id").maybeSingle();
  if (!profile) redirect(`/ingresar?next=${encodeURIComponent("/ajustes/direcciones")}&expirada=1`);
  if (error) throw new Error("No pudimos cargar tus direcciones.");

  const addresses = (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    address: row.address as string,
    reference: row.reference,
    phone: row.phone,
    is_default: !!row.is_default,
    latitude: row.latitude,
    longitude: row.longitude,
    department: row.department,
  }));

  return (
    <SectionCard icon={<MapPin className="size-5" />} title="Direcciones de entrega" text="Guarda hasta 10 lugares de entrega y elígelos al pagar." id="direcciones">
      <AddressBook addresses={addresses} actions={{ save: saveAddress, setDefault: setDefaultAddress, remove: deleteAddress }} />
    </SectionCard>
  );
}
