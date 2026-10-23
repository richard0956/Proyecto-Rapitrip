/* Service worker de la aplicación del repartidor.
 * Hace tres cosas: mostrar los avisos push, llevar a la aplicación al tocarlos y mostrar una pantalla propia si se abre sin
 * conexión. No guarda datos de pedidos en caché: lo que ve el repartidor viene siempre del servidor. */

const OFFLINE_CACHE = "rapitrip-courier-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Solo las navegaciones: si no hay red se muestra la pantalla de "sin conexión" en vez del error del navegador.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = {};
  }
  const tag = typeof message.tag === "string" ? message.tag : "rapitrip";

  // Aviso silencioso: la propuesta se canceló o venció, se cierra su notificación y no se muestra nada nuevo.
  if (message.close) {
    event.waitUntil(self.registration.getNotifications({ tag }).then((list) => list.forEach((n) => n.close())));
    return;
  }

  event.waitUntil(
    self.registration.showNotification(message.title || "Rapitrip", {
      body: message.body || "Tienes una novedad.",
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: typeof message.url === "string" ? message.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open) return open.focus().then((client) => (client && "navigate" in client ? client.navigate(target) : undefined));
      return self.clients.openWindow(target);
    }),
  );
});
