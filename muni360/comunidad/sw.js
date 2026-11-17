// Service Worker liviano para notificaciones de Comunidad Muni (CCBA).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { notification: { title: "Comunidad Muni", body: event.data ? event.data.text() : "" } };
  }
  const notif = payload.notification || {};
  const title = notif.title || "Comunidad Muni";
  const options = {
    body: notif.body || "Hay un nuevo aviso en Comunidad Muni.",
    icon: "../assets/images/favicon.png",
    badge: "../assets/images/favicon.png",
    data: { url: "./" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./", self.location.href).href;
  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windowClients) {
      if (client.url.startsWith(new URL("./", self.location.href).href) && "focus" in client) {
        return client.focus();
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});
