"use client";

import { Alert, Card, CardHeader } from "@rapitrip/ui";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

type CodeResult = { ok: true; code: string | null } | { ok: false; error: string };
type PhotoResult = { ok: true; photo: { url: string | null; takenAt: string; purged: boolean } | null } | { ok: false; error: string };

const when = new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Managua" });

/**
 * Entrega del pedido al repartidor. Con el pedido listo, el comercio ve el código de 4 dígitos que el repartidor debe escribir
 * (prueba de que estuvo en la tienda); cuando ya salió, ve la foto que tomó del paquete.
 */
export function PickupHandoff({ orderId, status, loadCode, loadPhoto }: { orderId: string; status: string; loadCode: (id: string) => Promise<CodeResult>; loadPhoto: (id: string) => Promise<PhotoResult> }) {
  const [code, setCode] = useState<CodeResult | null>(null);
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const showCode = status === "listo";
  const showPhoto = status === "en_camino" || status === "entregado";

  useEffect(() => {
    let cancelled = false;
    if (showCode) void loadCode(orderId).then((result) => !cancelled && setCode(result));
    if (showPhoto) void loadPhoto(orderId).then((result) => !cancelled && setPhoto(result));
    return () => {
      cancelled = true;
    };
  }, [orderId, status, showCode, showPhoto, loadCode, loadPhoto]);

  if (showCode) {
    return (
      <Card className="mb-3.5 border-2 border-hoja p-4">
        <CardHeader title="Código de recogida" subtitle="Muéstraselo al repartidor al entregarle el pedido" />
        {code === null ? (
          <p className="text-sm text-tinta-suave">Cargando…</p>
        ) : !code.ok ? (
          <Alert tone="error">{code.error}</Alert>
        ) : code.code ? (
          <>
            <p aria-label={`Código de recogida ${code.code.split("").join(" ")}`} className="rounded-panel bg-menta py-3 text-center font-mono text-[34px] font-extrabold tracking-[0.4em] text-selva">
              {code.code}
            </p>
            <p className="mt-2 text-xs text-tinta-suave">El repartidor lo escribe en su teléfono y toma una foto del paquete. Entrégale el pedido completo y sellado.</p>
          </>
        ) : (
          <p className="text-sm text-tinta-suave">Todavía no hay código para este pedido.</p>
        )}
      </Card>
    );
  }
  if (showPhoto && photo?.ok && photo.photo) {
    return (
      <Card className="mb-3.5 p-4">
        <CardHeader title="Recogida registrada" subtitle={`El repartidor lo recogió el ${when.format(new Date(photo.photo.takenAt))}`} />
        {photo.photo.url ? (
          <a href={photo.photo.url} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
            <img src={photo.photo.url} alt="Foto del paquete al recogerlo el repartidor" loading="lazy" className="max-h-56 w-full rounded-panel object-cover" />
          </a>
        ) : (
          <p className="flex items-center gap-2 text-sm text-tinta-suave">
            <KeyRound className="size-4" aria-hidden="true" />
            {photo.photo.purged ? "La foto se eliminó pasados 3 meses." : "La foto no está disponible en este momento."}
          </p>
        )}
      </Card>
    );
  }
  return null;
}
