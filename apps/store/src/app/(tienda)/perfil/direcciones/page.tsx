import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { deleteAddress, saveAddress, setDefaultAddress } from "./actions";
import { AddressBook } from "./address-book";

export const metadata: Metadata = { title: "Mis direcciones", robots: { index: false } };

export default async function DireccionesPage() {
  await requireCustomer("/perfil/direcciones");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("my_addresses").select("id, label, address, reference, phone, is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false });
  // La vista responde vacía (no con error) si la sesión de un día venció: confirmarlo con el perfil evita tomarlo por «sin direcciones».
  const { data: profile } = await supabase.from("my_profile").select("id").maybeSingle();
  if (!profile) redirect(`/ingresar?next=${encodeURIComponent("/perfil/direcciones")}&expirada=1`);
  if (error) throw new Error("No pudimos cargar tus direcciones.");

  const addresses = (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    address: row.address as string,
    reference: row.reference,
    phone: row.phone,
    is_default: !!row.is_default,
  }));

  return (
    <main className="mx-auto max-w-[1176px] px-4 py-8 sm:px-8 sm:py-10">
      <nav aria-label="Ruta de navegación" className="text-[13px] text-tinta-suave">
        <Link href="/perfil" className="font-bold text-hoja hover:underline">
          Mi perfil
        </Link>{" "}
        / Direcciones
      </nav>
      <h1 className="mt-3 text-[26px] font-extrabold leading-tight text-tinta">Mis direcciones</h1>
      <p className="mb-6 mt-1 text-[13.5px] text-tinta-suave">Guarda hasta 10 lugares de entrega y elígelos al pagar.</p>
      <AddressBook addresses={addresses} actions={{ save: saveAddress, setDefault: setDefaultAddress, remove: deleteAddress }} />
    </main>
  );
}
