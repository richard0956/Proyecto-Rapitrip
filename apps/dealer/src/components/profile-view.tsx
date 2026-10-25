"use client";

import { Alert, Avatar, Button, Card } from "@rapitrip/ui";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { departmentName } from "@/lib/department";
import { disablePush } from "@/lib/push-client";
import type { CourierMe } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { usePolling } from "@/lib/use-polling";
import { PageHeader } from "./page-header";
import { PushCard } from "./push-card";

const vehicle: Record<string, string> = { moto: "Moto", vehiculo: "Vehículo" };

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-borde py-2 last:border-0">
      <dt className="text-xs font-bold text-tinta-suave">{label}</dt>
      <dd className="text-right text-sm text-tinta">{value || "—"}</dd>
    </div>
  );
}

export function ProfileView() {
  const supabase = getSupabase();
  const router = useRouter();
  const guard = useAuthGuard();
  const [me, setMe] = useState<CourierMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error: failure } = await supabase.from("courier_me").select("*").maybeSingle();
    if (failure) {
      if (!guard(failure)) setError(friendlyError(failure, "No pudimos cargar tus datos."));
      return;
    }
    setMe(data as CourierMe | null);
    setError(null);
  }, [supabase, guard]);
  usePolling(load, 60_000);

  async function logout() {
    setLeaving(true);
    // Este teléfono deja de recibir los avisos de esta cuenta (si otra persona lo usa, no los recibirá).
    await disablePush();
    await supabase.auth.signOut();
    router.replace("/ingresar");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-5">
      <PageHeader eyebrow="Tu cuenta" title="Perfil" description="Tus datos y los avisos de este teléfono." />
      {error ? <Alert tone="warning">{error}</Alert> : null}

      <Card className="p-4">
        <div className="mb-3.5 flex items-center gap-3">
          <Avatar name={me?.full_name} />
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold tracking-tight text-tinta">{me?.full_name ?? "Repartidor"}</h2>
            <p className="text-xs text-tinta-suave">Datos de tu ficha. Si algo está mal, pide a coordinación que lo corrija.</p>
          </div>
        </div>
        <dl>
          <Row label="Teléfono" value={me?.phone} />
          <Row label="Vehículo" value={me?.vehicle_class ? vehicle[me.vehicle_class] : me?.vehicle_type} />
          <Row label="Departamento" value={departmentName(me?.department)} />
        </dl>
      </Card>

      <PushCard />

      <Button variant="secondary" className="min-h-12" disabled={leaving} onClick={logout}>
        <LogOut className="size-4" aria-hidden="true" />
        {leaving ? "Saliendo…" : "Cerrar sesión"}
      </Button>
    </div>
  );
}
