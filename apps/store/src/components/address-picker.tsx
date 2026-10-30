"use client";

import { cn } from "@rapitrip/ui";
import { Check, ChevronDown, MapPin, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { CustomerResult } from "@/lib/result";

export type HeaderAddress = { id: string; label: string; address: string; is_default: boolean };

type Props = {
  signedIn: boolean;
  addresses: HeaderAddress[];
  setDefault: (id: string) => Promise<CustomerResult>;
  /** Versión de una línea (pin + nombre de la dirección) para ir pegada al buscador. */
  compact?: boolean;
  className?: string;
};

/**
 * «Entregar en»: muestra la dirección predeterminada del cliente y, al abrirla, la lista de sus direcciones para elegir otra
 * (queda como predeterminada) o administrarlas. Sin direcciones invita a agregar una; sin sesión, a ingresar para elegirla.
 */
export function AddressPicker({ signedIn, addresses, setDefault, compact = false, className = "" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const current = addresses.find((a) => a.is_default) ?? addresses[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => ref.current && !ref.current.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id: string) {
    if (id === current?.id) return setOpen(false);
    setError("");
    start(async () => {
      const result = await setDefault(id);
      if (!result.ok) {
        if (result.expired) router.replace(`/ingresar?next=${encodeURIComponent("/")}&expirada=1`);
        else setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const title = current ? current.label : signedIn ? "Agrega tu dirección" : "¿A dónde lo llevamos?";
  const detail = current ? current.address : signedIn ? "Para calcular tu envío" : "Ingresa para elegir tu dirección";

  return (
    <div ref={ref} className={cn("relative min-w-0", className)}>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={current ? `Entregar en ${current.label}: ${current.address}` : `Entregar en: ${title}`}
          title={current ? `${current.label} · ${current.address}` : title}
          className="flex h-full min-w-0 items-center gap-1.5 rounded-full pl-4 pr-2.5 text-[13px] font-semibold text-tinta transition-colors duration-500 ease-fluido hover:bg-superficie/70 dark:hover:bg-selva/10 focus-visible:outline-2 focus-visible:outline-hoja"
        >
          <span aria-hidden="true" className="relative shrink-0 text-hoja">
            <MapPin className="size-4" />
            {!current ? <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-naranja ring-2 ring-crema" /> : null}
          </span>
          <span className="max-w-[110px] truncate">{current ? current.label : "Ubicación"}</span>
          <ChevronDown aria-hidden="true" className={cn("size-3.5 shrink-0 text-tinta-suave transition-transform duration-300", open && "rotate-180")} />
        </button>
      ) : (
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="group flex w-full min-w-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-3 text-left transition-colors duration-500 ease-fluido hover:bg-crema focus-visible:outline-2 focus-visible:outline-hoja"
      >
        <span aria-hidden="true" className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-menta text-hoja">
          <MapPin className="size-[18px]" />
          {!current ? <span className="absolute right-0 top-0 size-2.5 animate-pulse rounded-full bg-naranja ring-2 ring-superficie" /> : null}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[11px] font-medium text-tinta-suave">{current ? `Entregar en · ${title}` : "Entregar en"}</span>
          <span className="block truncate text-[13px] font-semibold text-tinta">{current ? detail : title}</span>
        </span>
        <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-tinta-suave transition-transform duration-300", open && "rotate-180")} />
      </button>
      )}

      <div
        id={panelId}
        hidden={!open}
        className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(340px,calc(100vw-24px))] rounded-3xl bg-superficie p-2 shadow-flota ring-1 ring-selva/10"
      >
        {addresses.length > 0 ? (
          <>
            <p className="px-3 pb-1 pt-2 text-[12px] font-semibold text-tinta-suave">¿A dónde enviamos tu pedido?</p>
            <ul className="flex flex-col">
              {addresses.map((address) => {
                const selected = address.id === current?.id;
                return (
                  <li key={address.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => choose(address.id)}
                      aria-pressed={selected}
                      className={cn("flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-crema disabled:opacity-60", selected && "bg-menta/60 hover:bg-menta/60")}
                    >
                      <MapPin aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", selected ? "text-hoja" : "text-tinta-suave")} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-tinta">{address.label}</span>
                        <span className="block truncate text-[12px] text-tinta-suave">{address.address}</span>
                      </span>
                      {selected ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-hoja" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {error ? (
              <p role="alert" className="px-3 py-2 text-[12px] font-semibold text-rojo">
                {error}
              </p>
            ) : null}
            <div className="mt-1 flex gap-2 border-t border-selva/[0.06] p-2">
              <Link href="/ajustes/direcciones" className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-crema text-[12.5px] font-semibold text-tinta hover:bg-menta">
                <Plus aria-hidden="true" className="size-4" /> Nueva
              </Link>
              <Link href="/ajustes/direcciones" className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-crema text-[12.5px] font-semibold text-tinta hover:bg-menta">
                <Settings2 aria-hidden="true" className="size-4" /> Administrar
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center px-4 pb-4 pt-5 text-center">
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-menta to-bruma text-hoja">
              <MapPin className="size-7" />
            </span>
            <p className="mt-3 text-[15px] font-bold text-tinta">¿A dónde llevamos tu pedido?</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-tinta-suave">
              {signedIn ? "Guarda tu casa o tu trabajo y lo elegimos por ti al pagar." : "Ingresa a tu cuenta para guardar tus direcciones de entrega."}
            </p>
            <Link
              href={signedIn ? "/ajustes/direcciones" : `/ingresar?next=${encodeURIComponent("/ajustes/direcciones")}`}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-selva text-[13px] font-semibold text-sobre-acento hover:bg-tinta"
            >
              {signedIn ? (
                <>
                  <Plus aria-hidden="true" className="size-4" /> Agregar dirección
                </>
              ) : (
                "Ingresar"
              )}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
