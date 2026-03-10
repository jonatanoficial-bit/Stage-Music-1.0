
// Intencionalmente simples. Mantido apenas para remover caches antigos em futuras versões.
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
