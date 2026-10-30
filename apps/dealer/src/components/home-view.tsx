"use client";

import { Alert, Reveal } from "@rapitrip/ui";
import { BellRing, ChevronRight, PackageSearch } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { readPushStatus, type PushStatus } from "@/lib/push-client";
import type { CourierMe, CourierOffer, CourierOrder } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { useEvidenceQueue } from "@/lib/use-evidence-queue";
import { usePolling } from "@/lib/use-polling";
import { ConnectionBanner } from "./connection-banner";
import { HomeHero } from "./home-hero";
import { OfferCard } from "./offer-card";
import { OrderCard } from "./order-card";
import { SectionTitle, Tray, WarmEmpty } from "./panel";
import { Skeleton } from "./skeleton";

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
  const cashToCollect = open.reduce((total, order) => total + (order.cash_total != null ? Number(order.cash_total) : 0), 0);
  const available = me?.available === true;

  return (
    <div className="flex flex-col">
      <ConnectionBanner pending={queue.pending.length} />

      <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
        {!loaded ? (
          <>
            <p role="status" className="sr-only">
              Cargando tus pedidos…
            </p>
            <Skeleton className="h-[340px] rounded-[2rem]" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <Reveal>
              <HomeHero
                name={me?.full_name?.trim().split(/\s+/)[0] || null}
                available={available}
                since={me?.available_since ?? null}
                busy={busy === "disponible"}
                inProgress={open.length}
                deliveredToday={delivered.length}
                cashToCollect={cashToCollect}
                onToggle={toggleAvailable}
              />
            </Reveal>

            {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

            {push === "inactivo" ? (
              <Reveal>
                <PushNudge />
              </Reveal>
            ) : null}

            {offer ? <OfferCard key={offer.offer_id} offer={offer} busy={busy === "oferta"} onAccept={() => answer(offer, true)} onReject={(reason) => answer(offer, false, reason)} /> : null}

            <Tray>
              <section aria-labelledby="abiertos" className="flex flex-col gap-3">
                <SectionTitle id="abiertos" title="Mis pedidos" text={open.length > 0 ? "Toca un pedido para ver qué sigue." : undefined} count={open.length} />
                {open.length === 0 ? (
                  <OrdersEmpty available={available} />
                ) : (
                  open.map((order, index) => (
                    <Reveal key={order.order_id} index={index}>
                      <OrderCard order={order} />
                    </Reveal>
                  ))
                )}
              </section>
            </Tray>

            {delivered.length > 0 ? (
              <Tray>
                <section aria-labelledby="hoy" className="flex flex-col gap-3">
                  <SectionTitle id="hoy" title="Entregados hoy" href="/historial" linkLabel="Historial" count={delivered.length} />
                  {delivered.map((order) => (
                    <OrderCard key={order.order_id} order={order} />
                  ))}
                </section>
              </Tray>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Sin pedidos abiertos: un estado cálido que dice qué hacer. */
function OrdersEmpty({ available }: { available: boolean }) {
  return (
    <WarmEmpty icon={<PackageSearch className="size-7" />} title="No tienes pedidos abiertos">
      {available ? "Cuando coordinación te proponga uno, aparecerá aquí." : "Toca «Empezar» arriba para recibir propuestas."}
    </WarmEmpty>
  );
}

/** Invitación a activar los avisos, con la forma de la tarjeta «¿A dónde llevamos tus pedidos?» de la tienda. */
function PushNudge() {
  return (
    <section aria-labelledby="avisos" className="flex items-center gap-3.5 rounded-[1.75rem] bg-superficie p-4 shadow-[0_18px_40px_-30px_rgb(6_54_42/0.45)] ring-1 ring-selva/[0.06]">
      <span aria-hidden="true" className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-menta to-bruma text-hoja">
        <BellRing className="size-6" />
        <span className="absolute -right-0.5 -top-0.5 size-3 animate-pulse rounded-full bg-naranja ring-2 ring-superficie motion-reduce:animate-none" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="avisos" className="text-[15px] font-bold text-tinta">
          Activa los avisos
        </h2>
        <p className="mt-0.5 text-[12.5px] text-tinta-suave">Entérate de las propuestas aunque la aplicación esté cerrada.</p>
      </div>
      <Link
        href="/perfil"
        aria-label="Activar los avisos en tu perfil"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-selva text-sobre-acento transition-colors hover:bg-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </section>
  );
}
