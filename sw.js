// Service worker MÍNIMO pro canal "Notificação nativa" da Central de
// Notificações (pedido do Georges: "outra opção... sem ter que desenvolver
// tudo aquilo" — Web Push completo). Este arquivo NÃO faz push de verdade:
// sem VAPID, sem assinatura (subscription), sem nada guardado no servidor,
// sem "push" event nenhum. Ele só existe porque o Chrome no Android EXIGE
// um service worker registrado pra poder chamar
// registration.showNotification() (mesmo sendo uma notificação 100% local,
// disparada pelo próprio app enquanto está aberto numa aba — ver
// fireNativeNotification() em app.js). No desktop o "new Notification()"
// direto já funciona sem nada disso, mas registrar este arquivo também lá
// não atrapalha em nada e mantém o MESMO caminho de código pros dois casos.
//
// Deploy: este arquivo precisa subir JUNTO com index.html/app.js/config.js/
// styles.css pro GitHub Pages (mesma pasta, raiz do site) — sem isso o
// navigator.serviceWorker.register("sw.js") do app.js dá 404 e o canal
// "Notificação nativa" simplesmente não funciona no Android (no desktop
// funciona mesmo sem isso, por isso pode passar despercebido em teste feito
// só no computador).

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

// Clique numa notificação nativa: foca uma aba já aberta do app (mandando
// ela navegar pra rota certa via postMessage — ver o listener de
// "message" em app.js) ou abre uma aba nova quando não tem nenhuma aberta.
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var route = (event.notification.data && event.notification.data.route) || "";
  var url = self.registration.scope + (route ? route : "");
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if ("focus" in client) {
          client.focus();
          if (route) client.postMessage({ type: "notif-navigate", route: route });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
