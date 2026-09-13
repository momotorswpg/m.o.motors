const SHELL='mo-staff-shell-v3';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(['./staff.html','./staff.css','./staff-notifications.css','./staff-config.js','./staff.js','./staff.webmanifest'])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mo-staff-shell-')&&key!==SHELL).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.mode!=='navigate'||!new URL(event.request.url).pathname.endsWith('/staff.html'))return;
  event.respondWith(fetch(event.request).catch(()=>caches.match('./staff.html')));
});
self.addEventListener('push',event=>{
  let payload={title:'M.O Motors staff update',body:'Open the staff workspace to review it.',url:'./staff.html'};
  try{if(event.data)payload={...payload,...event.data.json()}}catch{}
  const target=new URL(payload.url,self.location.origin);
  if(target.origin!==self.location.origin||!target.pathname.endsWith('/staff.html'))target.href=new URL('./staff.html',self.location.origin).href;
  event.waitUntil(self.registration.showNotification(String(payload.title).slice(0,100),{
    body:String(payload.body).slice(0,180),icon:'./mo-motors-logo.png',tag:`staff-${payload.id||Date.now()}`,
    data:{url:target.href}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||new URL('./staff.html',self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    for(const client of clients){if(client.url.startsWith(new URL('./staff.html',self.location.origin).href)){await client.focus();await client.navigate(target);return}}
    await self.clients.openWindow(target);
  }));
});
