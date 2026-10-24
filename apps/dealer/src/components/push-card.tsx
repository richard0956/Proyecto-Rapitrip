"use client";

import { Alert, Button, Card, CardHeader } from "@rapitrip/ui";
import { BellRing, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { disablePush, enablePush, readPushStatus, type PushStatus } from "@/lib/push-client";

/** Activar o quitar los avisos en este teléfono. En iPhone, Apple exige tener la aplicación en la pantalla de inicio. */
export function PushCard() {
  const [status, setStatus] = useState<PushStatus>("cargando");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void readPushStatus().then(setStatus);
  }, []);

  async function toggle() {
    setBusy(true);
    setMessage(null);
    const result = status === "activo" ? await disablePush() : await enablePush();
    if (!result.ok) setMessage(result.message);
    setStatus(await readPushStatus());
    setBusy(false);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <CardHeader title="Avisos de propuestas" subtitle="Suena el teléfono aunque la aplicación esté cerrada" />
      {status === "cargando" ? <p className="text-sm text-tinta-suave">Revisando…</p> : null}
      {status === "instalar-ios" ? (
        <Alert tone="warning" icon={<Share className="size-[18px]" />}>
          <span className="font-bold">En iPhone, instala la aplicación primero.</span> Toca el botón Compartir de Safari y elige «Añadir a pantalla de inicio». Luego abre Rapitrip desde ese icono y activa los avisos aquí.
        </Alert>
      ) : null}
      {status === "no-soportado" ? <Alert tone="warning">Este navegador no permite avisos. Prueba con Chrome o instala la aplicación.</Alert> : null}
      {status === "sin-clave" ? <Alert tone="error">Los avisos no están configurados todavía. Avisa a coordinación.</Alert> : null}
      {status === "bloqueado" ? <Alert tone="warning">Bloqueaste los avisos para esta aplicación. Actívalos en los ajustes del navegador o del teléfono y vuelve aquí.</Alert> : null}
      {status === "activo" ? <Alert tone="info">Los avisos están activados en este teléfono.</Alert> : null}
      {status === "activo" || status === "inactivo" ? (
        <Button variant={status === "activo" ? "secondary" : "primary"} className="min-h-12" disabled={busy} onClick={toggle}>
          <BellRing className="size-4" aria-hidden="true" />
          {busy ? "Un momento…" : status === "activo" ? "Quitar los avisos de este teléfono" : "Activar los avisos"}
        </Button>
      ) : null}
      {message ? <Alert tone="error">{message}</Alert> : null}
    </Card>
  );
}
