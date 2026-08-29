/* Service worker des notifications de révision.
 * Volontairement minimal : il ne met rien en cache, ne track rien. Son seul rôle est
 * de recevoir l'événement `push` (obligation du Web Push) et d'afficher le message
 * préparé côté serveur. Le titre et le corps viennent de la route /api/revisions ;
 * ici on ne réinvente aucun texte, on affiche celui qui a été calculé en base. */
self.addEventListener("push", (event) => {
  let donnees = { titre: "Moncef IA", corps: "", url: "/app/thunder" };
  try {
    if (event.data) donnees = Object.assign(donnees, event.data.json());
  } catch {
    if (event.data && event.data.text()) donnees.corps = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(donnees.titre, {
      body: donnees.corps,
      tag: "moncef-revisions",
      data: { url: donnees.url || "/app/thunder" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = (event.notification.data && event.notification.data.url) || "/app/thunder";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((liste) => {
      for (const c of liste) {
        if ("focus" in c) {
          c.navigate(cible);
          return c.focus();
        }
      }
      return self.clients.openWindow(cible);
    })
  );
});
