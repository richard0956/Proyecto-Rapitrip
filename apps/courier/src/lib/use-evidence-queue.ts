"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "./client";
import { uploadEvidence } from "./evidence";
import { flushQueue, indexedDbStore, memoryStore, type QueueItem, type QueueStore } from "./evidence-queue";

function createStore(): QueueStore {
  try {
    return typeof indexedDB === "undefined" ? memoryStore() : indexedDbStore();
  } catch {
    return memoryStore();
  }
}

export type QueueState = { pending: QueueItem[]; busy: boolean; lastDropped: string | null };

/**
 * Fotos de evidencia pendientes de subir. `submit` guarda la foto en el teléfono y trata de subirla enseguida; si no hay
 * señal queda en la cola y se reintenta sola al volver la conexión o al abrir la aplicación.
 */
export function useEvidenceQueue(courierId: string | null, onUploaded?: () => void) {
  const storeRef = useRef<QueueStore | null>(null);
  const [state, setState] = useState<QueueState>({ pending: [], busy: false, lastDropped: null });
  const flushing = useRef(false);
  const callback = useRef(onUploaded);
  useEffect(() => {
    callback.current = onUploaded;
  });

  const store = useCallback(() => (storeRef.current ??= createStore()), []);

  const flush = useCallback(async () => {
    if (!courierId || flushing.current) return;
    flushing.current = true;
    setState((s) => ({ ...s, busy: true }));
    try {
      const supabase = getSupabase();
      const result = await flushQueue(store(), (item) => uploadEvidence(supabase, courierId, item));
      const pending = await store().all();
      setState({ pending, busy: false, lastDropped: result.dropped[0]?.lastError ?? null });
      if (result.uploaded > 0) callback.current?.();
    } catch {
      setState((s) => ({ ...s, busy: false }));
    } finally {
      flushing.current = false;
    }
  }, [courierId, store]);

  useEffect(() => {
    // La primera pasada va en un temporizador para no cambiar el estado dentro del propio efecto.
    const first = setTimeout(() => void flush(), 0);
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const timer = setInterval(() => void flush(), 20_000);
    return () => {
      clearTimeout(first);
      window.removeEventListener("online", onOnline);
      clearInterval(timer);
    };
  }, [flush]);

  const submit = useCallback(
    async (input: Omit<QueueItem, "id" | "createdAt" | "attempts" | "lastError">) => {
      const item: QueueItem = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), attempts: 0, lastError: null };
      await store().put(item);
      setState((s) => ({ ...s, pending: [...s.pending, item] }));
      await flush();
    },
    [flush, store],
  );

  return { ...state, submit, flush };
}
