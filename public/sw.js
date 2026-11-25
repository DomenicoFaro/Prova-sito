// Riceve le notifiche push anche a sito chiuso. Non salva pagine in memoria:
// il sito si aggiorna sempre normalmente.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try {
    d = e.data.json()
  } catch {
    /* messaggio vuoto: si mostra comunque un avviso generico */
  }
  // Solo indirizzi interni al sito
  const url = typeof d.url === 'string' && d.url.startsWith('/area/') ? d.url : '/area/ticket'
  e.waitUntil(
    self.registration.showNotification(d.titolo || 'Forma Web', {
      body: d.testo || 'Hai un nuovo messaggio.',
      icon: '/favicon-192.png',
      badge: '/favicon-192.png',
      tag: d.tag || undefined,
      renotify: Boolean(d.tag),
      data: { url },
    }),
  )
})

// Toccando la notifica si apre il ticket
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/area/ticket'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (finestre) => {
      const aperta = finestre[0]
      if (!aperta) return self.clients.openWindow(url)
      await aperta.focus()
      try {
        await aperta.navigate(url)
      } catch {
        await self.clients.openWindow(url)
      }
    }),
  )
})
