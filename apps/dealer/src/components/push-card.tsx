"use client";

import { Alert, cn } from "@rapitrip/ui";
import { BellOff, BellRing, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { disablePush, enablePush, readPushStatus, type PushStatus } from "@/lib/push-client";
import { Tray } from "./panel";

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
    <Tray>
      <section aria-labelledby="avisos-propuestas" className="flex flex-col gap-3">
        <div className="flex items-center gap-3 px-1">
          <span aria-hidden="true" className={cn("relative flex size-12 shrink-0 items-center justify-center rounded-2xl", status === "activo" ? "bg-esmeralda text-panel" : "bg-gradient-to-br from-menta to-bruma text-hoja")}>
            <BellRing className="size-6" />
            {status === "inactivo" ? <span className="absolute -right-0.5 -top-0.5 size-3 animate-pulse rounded-full bg-naranja ring-2 ring-superficie motion-reduce:animate-none" /> : null}
          </span>
          <div className="min-w-0">
            <h2 id="avisos-propuestas" className="text-[18px] font-bold leading-tight tracking-tight text-tinta">
              Avisos de propuestas
            </h2>
            <p className="text-[12.5px] text-tinta-suave">Suena el teléfono aunque la aplicación esté cerrada.</p>
          </div>
        </div>
        {status === "cargando" ? <p className="px-1 text-sm text-tinta-suave">Revisando…</p> : null}
        {status === "instalar-ios" ? (
          <Alert tone="warning" icon={<Share className="size-[18px]" />}>
            <span className="font-bold">En iPhone, instala la aplicación primero.</span> Toca el botón Compartir de Safari y elige «Añadir a pantalla de inicio». Luego abre Rapitrip desde ese icono y activa los avisos aquí.
          </Alert>
        ) : null}
        {status === "no-soportado" ? <Alert tone="warning">Este navegador no permite avisos. Prueba con Chrome o instala la aplicación.</Alert> : null}
        {status === "sin-clave" ? <Alert tone="error">Los avisos no están configurados todavía. Avisa a coordinación.</Alert> : null}
        {status === "bloqueado" ? <Alert tone="warning">Bloqueaste los avisos para esta aplicación. Actívalos en los ajustes del navegador o del teléfono y vuelve aquí.</Alert> : null}
        {status === "activo" ? <Alert tone="info">Los avisos están activados en este teléfono.</Alert> : null}
        {status === "activo" ? (
          <button
            type="button"
            disabled={busy}
            onClick={toggle}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-crema text-[14px] font-bold text-tinta ring-1 ring-borde transition-[background-color,transform] duration-500 ease-fluido hover:bg-menta/60 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
          >
            <BellOff className="size-4" aria-hidden="true" />
            {busy ? "Un momento…" : "Quitar los avisos de este teléfono"}
          </button>
        ) : null}
        {status === "inactivo" ? (
          <button
            type="button"
            disabled={busy}
            onClick={toggle}
            className="group inline-flex min-h-12 items-center justify-between gap-2 rounded-full bg-selva py-1.5 pl-6 pr-1.5 text-[14px] font-bold text-sobre-acento shadow-pulsa transition-[background-color,transform] duration-500 ease-fluido hover:bg-tinta active:scale-[0.98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
          >
            {busy ? "Un momento…" : "Activar los avisos"}
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-esmeralda text-panel transition-transform duration-500 ease-fluido group-hover:translate-x-0.5">
              <BellRing className="size-4" />
            </span>
          </button>
        ) : null}
        {message ? <Alert tone="error">{message}</Alert> : null}
      </section>
    </Tray>
  );
}
