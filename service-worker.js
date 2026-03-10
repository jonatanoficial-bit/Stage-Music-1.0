const CACHE_NAME='stage-music-v110';
const ASSETS=['./','./index.html','./css/style.css','./js/store.js','./js/app.js','./assets/icons/favicon.svg','./assets/branding/logo-stage-music.png','./assets/branding/bg-stage-premium.png','./site.webmanifest','./content/online-library/manifest.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(resp=>resp||fetch(event.request)));});
