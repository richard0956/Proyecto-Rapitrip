"use client";

import { distanceKm, fetchRoute, formatDistance, formatMinutes, MapView, resolveToken, type RouteResult as MapRoute } from "@rapitrip/maps";
import { Alert } from "@rapitrip/ui";
import { Route as RouteIcon, Ruler } from "lucide-react";
import { useEffect, useState } from "react";
import type { DistanceResult, RoutePoints, RouteResult } from "@/lib/order-route";

/**
 * Ruta de un pedido: tienda y destino en el mismo mapa, con la distancia y el tiempo por calle.
 * Solo para coordinación y administración (el comercio no ve el destino del cliente: ver `OrderDistance`).
 */
export function OrderRoute({ orderId, load }: { orderId: string; load: (id: string) => Promise<RouteResult> }) {
  const [points, setPoints] = useState<RoutePoints | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<MapRoute | null>(null);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load(orderId).then((result) => {
      if (cancelled) return;
      if (result.ok) setPoints(result.points);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, load]);

  const store = points?.store ?? null;
  const destination = points?.destination ?? null;

  useEffect(() => {
    const token = resolveToken();
    if (!store || !destination || !token) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRouting(true);
    fetchRoute(store, destination, token, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setRoute(result);
      setRouting(false);
    });
    return () => controller.abort();
  }, [store, destination]);

  if (error) return <Alert tone="error" className="mb-3.5">No pudimos cargar la ruta.</Alert>;
  if (!points) return <p className="mb-3.5 text-[13px] text-tinta-suave" aria-live="polite">Cargando la ruta…</p>;

  if (!store || !destination) {
    return (
      <div className="mb-3.5 rounded-panel bg-calido/50 p-3.5 text-[13px] text-tinta-suave">
        <p className="mb-1 text-xs font-bold">Ruta de entrega</p>
        {!store ? <p>La tienda aún no tiene su ubicación marcada en el mapa.</p> : null}
        {!destination ? <p>El cliente no marcó el punto de entrega: guíate por la dirección escrita.</p> : null}
      </div>
    );
  }

  const straight = distanceKm(store, destination);
  return (
    <div className="mb-3.5 flex flex-col gap-2.5 rounded-panel bg-calido/50 p-3.5 text-sm">
      <p className="text-xs font-bold text-tinta-suave">Ruta de entrega</p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-tinta" aria-live="polite">
        {route ? (
          <>
            <span className="inline-flex items-center gap-1.5 font-bold">
              <RouteIcon className="size-4" aria-hidden="true" />
              {formatDistance(route.distanceKm)} por calle
            </span>
            <span>unos {formatMinutes(route.minutes)} en moto o auto</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Ruler className="size-4" aria-hidden="true" />
            {routing ? "Calculando la ruta…" : `${formatDistance(straight)} en línea recta (no se pudo calcular la ruta)`}
          </span>
        )}
      </p>
      <MapView
        ariaLabel="Mapa de la ruta entre la tienda y el destino"
        route={route?.coordinates ?? null}
        markers={[
          { id: "tienda", label: points.storeName || "Tienda", tone: "tienda", point: store },
          { id: "destino", label: "Destino del cliente", tone: "cliente", point: destination },
        ]}
      />
    </div>
  );
}

/** Para el comercio: solo la distancia aproximada. Nunca se le entrega el punto del cliente. */
export function OrderDistance({ orderId, load }: { orderId: string; load: (id: string) => Promise<DistanceResult> }) {
  const [result, setResult] = useState<DistanceResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(orderId).then((value) => {
      if (!cancelled) setResult(value);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, load]);

  if (!result) return null;
  if (!result.ok) return null;
  return (
    <p className="mb-3.5 flex items-center gap-2 text-[13px] text-tinta-suave">
      <Ruler className="size-4 shrink-0" aria-hidden="true" />
      {result.km === null ? "Distancia al cliente: sin calcular (falta marcar alguna ubicación)." : `Distancia al cliente: unos ${formatDistance(result.km)} en línea recta.`}
    </p>
  );
}
