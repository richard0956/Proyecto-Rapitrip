/**
 * Cola local de fotos de evidencia. Con mala señal la foto se guarda en el teléfono (IndexedDB) y se sube cuando vuelve la
 * conexión, aunque el repartidor cierre la aplicación. La lógica no depende del navegador: recibe un almacén y un "subir".
 */
export type QueueItem = {
  id: string;
  orderId: string;
  kind: "recogida" | "entrega" | "fallida" | "devolucion_tienda";
  blob: Blob;
  sha256: string;
  latitude: number | null;
  longitude: number | null;
  units: number | null;
  note: string | null;
  createdAt: number;
  attempts: number;
  lastError: string | null;
};

export interface QueueStore {
  put(item: QueueItem): Promise<void>;
  all(): Promise<QueueItem[]>;
  remove(id: string): Promise<void>;
}

/** El almacén en memoria sirve para las pruebas y como respaldo si el navegador no deja usar IndexedDB (modo privado). */
export function memoryStore(): QueueStore {
  const items = new Map<string, QueueItem>();
  return {
    put: async (item) => void items.set(item.id, item),
    all: async () => [...items.values()],
    remove: async (id) => void items.delete(id),
  };
}

export function indexedDbStore(name = "rapitrip-courier", store = "evidence"): QueueStore {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(store, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  const run = async <T,>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(store, mode).objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).finally(() => db.close());
  };
  return {
    put: async (item) => void (await run("readwrite", (s) => s.put(item))),
    all: () => run("readonly", (s) => s.getAll() as IDBRequest<QueueItem[]>),
    remove: async (id) => void (await run("readwrite", (s) => s.delete(id))),
  };
}

export type UploadOutcome = { ok: true } | { ok: false; error: string; permanent?: boolean };

/** Errores que no se arreglan reintentando (el pedido ya cambió de estado, la ruta no es válida…): se descartan tras avisar. */
export const MAX_ATTEMPTS = 8;

/**
 * Intenta subir lo pendiente, en orden. Una subida que falla por la red deja el elemento para después y corta (lo siguiente
 * también fallaría); una que falla de forma definitiva se descarta para no trabar la cola.
 * Devuelve cuántos se subieron y cuántos quedan.
 */
export async function flushQueue(
  store: QueueStore,
  upload: (item: QueueItem) => Promise<UploadOutcome>,
): Promise<{ uploaded: number; remaining: number; dropped: QueueItem[] }> {
  const items = (await store.all()).sort((a, b) => a.createdAt - b.createdAt);
  let uploaded = 0;
  const dropped: QueueItem[] = [];
  for (const item of items) {
    const outcome = await upload(item);
    if (outcome.ok) {
      await store.remove(item.id);
      uploaded++;
      continue;
    }
    if (outcome.permanent || item.attempts + 1 >= MAX_ATTEMPTS) {
      await store.remove(item.id);
      dropped.push({ ...item, attempts: item.attempts + 1, lastError: outcome.error });
      continue;
    }
    await store.put({ ...item, attempts: item.attempts + 1, lastError: outcome.error });
    break;
  }
  return { uploaded, remaining: (await store.all()).length, dropped };
}
