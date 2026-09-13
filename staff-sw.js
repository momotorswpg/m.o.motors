const SHELL='mo-staff-shell-v1';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(['./staff.html','./staff.css','./staff.js','./staff.webmanifest'])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mo-staff-shell-')&&key!==SHELL).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.mode!=='navigate'||!new URL(event.request.url).pathname.endsWith('/staff.html'))return;
  event.respondWith(fetch(event.request).catch(()=>caches.match('./staff.html')));
});
