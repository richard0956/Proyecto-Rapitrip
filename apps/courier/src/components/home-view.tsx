"use client";

import { Alert, Card, EmptyState } from "@rapitrip/ui";
import { BellRing } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { readPushStatus, type PushStatus } from "@/lib/push-client";
import type { CourierMe, CourierOffer, CourierOrder } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { useEvidenceQueue } from "@/lib/use-evidence-queue";
import { usePolling } from "@/lib/use-polling";
import { AvailabilityCard } from "./availability-card";
import { ConnectionBanner } from "./connection-banner";
import { OfferCard } from "./offer-card";
import { OrderCard } from "./order-card";

const POLL_MS = 15_000;

type Notice = { tone: "info" | "warning" | "error"; text: string } | null;

/** Pantalla de inicio: disponibilidad, la propuesta abierta y los pedidos del repartidor. Se actualiza sola cada 15 segundos. */
export function HomeView() {
  const supabase = getSupabase();
  const guard = useAuthGuard();
  const [me, setMe] = useState<CourierMe | null>(null);
  const [offers, setOffers] = useState<CourierOffer[]>([]);
  const [orders, setOrders] = useState<CourierOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<"disponible" | "oferta" | null>(null);
  const [push, setPush] = useState<PushStatus>("cargando");

  const load = useCallback(async () => {
    const [meResult, offersResult, ordersResult] = await Promise.all([
      supabase.from("courier_me").select("*").maybeSingle(),
      supabase.rpc("courier_offers"),
      supabase.rpc("courier_orders"),
    ]);
    const failure = meResult.error ?? offersResult.error ?? ordersResult.error;
    if (failure) {
      if (guard(failure)) return;
      // Sin señal se conserva lo último que se vio y se avisa; no se vacía la pantalla.
      setNotice({ tone: "warning", text: friendlyError(failure, "No pudimos actualizar. Reintentamos solos.") });
      return;
    }
    setMe(meResult.data as CourierMe | null);
    setOffers(offersResult.data ?? []);
    setOrders(ordersResult.data ?? []);
    setNotice((current) => (current?.tone === "warning" ? null : current));
    setLoaded(true);
  }, [supabase, guard]);

  usePolling(load, POLL_MS);
  const queue = useEvidenceQueue(me?.id ?? null, load);
  useEffect(() => {
    void readPushStatus().then(setPush);
  }, []);

  async function toggleAvailable(next: boolean) {
    setBusy("disponible");
    setNotice(null);
    const { error } = await supabase.rpc("courier_set_available", { p_available: next });
    if (error) {
      if (!guard(error)) setNotice({ tone: "error", text: friendlyError(error) });
    } else {
      setMe((current) => (current ? { ...current, available: next } : current));
      await load();
    }
    setBusy(null);
  }

  async function answer(offer: CourierOffer, accept: boolean, reason: string | null = null) {
    if (!offer.offer_id) return;
    setBusy("oferta");
    setNotice(null);
    if (accept) {
      const { data, error } = await supabase.rpc("courier_accept_offer", { p_offer: offer.offer_id });
      if (error) {
        if (!guard(error)) setNotice({ tone: "error", text: friendlyError(error) });
      } else if (data === "aceptada") {
        setNotice({ tone: "info", text: `Pedido ${offer.number} asignado. Ve a la tienda a recogerlo.` });
      } else if (data === "vencida") {
        setNotice({ tone: "warning", text: "La propuesta venció antes de que la aceptaras." });
      } else {
        setNotice({ tone: "warning", text: "El pedido ya no está disponible." });
      }
    } else {
      const { error } = await supabase.rpc("courier_reject_offer", { p_offer: offer.offer_id, ...(reason ? { p_reason: reason } : {}) });
      if (error && !guard(error)) setNotice({ tone: "error", text: friendlyError(error) });
      else if (!error) setNotice({ tone: "info", text: "Rechazaste la propuesta. Coordinación la ofrecerá a otra persona." });
    }
    await load();
    setBusy(null);
  }

  const offer = offers[0] ?? null;
  const open = orders.filter((order) => order.status !== "entregado");
  const delivered = orders.filter((order) => order.status === "entregado");

  return (
    <div className="flex flex-col">
      <ConnectionBanner pending={queue.pending.length} />
      <header className="px-4 pb-2 pt-5">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-tinta">Hola{me?.full_name ? `, ${me.full_name.split(" ")[0]}` : ""}</h1>
        <p className="text-[13.5px] text-tinta-suave">Tus propuestas y pedidos de hoy.</p>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-6">
        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
        {!loaded ? (
          <p role="status" className="py-10 text-center text-sm text-tinta-suave">
            Cargando…
          </p>
        ) : (
          <>
            <AvailabilityCard available={me?.available === true} busy={busy === "disponible"} onToggle={toggleAvailable} />

            {push === "inactivo" ? (
              <Link href="/perfil" className="block rounded-campo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                <Alert tone="warning" icon={<BellRing className="size-[18px]" />}>
                  <span className="font-bold">Activa los avisos</span> para enterarte de las propuestas aunque la aplicación esté cerrada.
                </Alert>
              </Link>
            ) : null}

            {offer ? <OfferCard key={offer.offer_id} offer={offer} busy={busy === "oferta"} onAccept={() => answer(offer, true)} onReject={(reason) => answer(offer, false, reason)} /> : null}

            <section aria-labelledby="abiertos" className="flex flex-col gap-3">
              <h2 id="abiertos" className="text-base font-extrabold text-tinta">
                Mis pedidos
              </h2>
              {open.length === 0 ? (
                <EmptyState title="No tienes pedidos abiertos">{me?.available ? "Cuando coordinación te proponga uno, aparecerá aquí." : "Marca que estás disponible para recibir propuestas."}</EmptyState>
              ) : (
                open.map((order) => <OrderCard key={order.order_id} order={order} />)
              )}
            </section>

            {delivered.length > 0 ? (
              <section aria-labelledby="hoy" className="flex flex-col gap-3">
                <h2 id="hoy" className="text-base font-extrabold text-tinta">
                  Entregados hoy
                </h2>
                {delivered.map((order) => (
                  <OrderCard key={order.order_id} order={order} />
                ))}
                <Card className="p-4 text-center text-[13px] text-tinta-suave">
                  <Link href="/historial" className="font-bold text-hoja underline-offset-2 hover:underline">
                    Ver mi historial
                  </Link>
                </Card>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
