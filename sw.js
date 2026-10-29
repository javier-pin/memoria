importScripts('./storage.js','./capture.js');
const CACHE='memoria-shell-v040-final';
const ASSETS=['./','./index.html','./style.css','./storage.js','./capture.js','./capture-ui.js','./app.js','./protection.js','./start.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('memoria-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.method==='POST'&&url.pathname===new URL('share-target',self.registration.scope).pathname){
    event.respondWith(MemoriaCapture.receive(event.request,self.registration.scope));return;
  }
  if(event.request.method!=='GET')return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    // Parámetro opaco de recepción: servir solo el shell; no enviarlo a GitHub.
    if(url.pathname===new URL('./',self.registration.scope).pathname&&url.searchParams.has('received'))return cache.match('./index.html');
    const cached=await cache.match(event.request);if(cached)return cached;
    try{return await fetch(event.request)}catch(error){if(event.request.mode==='navigate')return cache.match('./index.html');throw error}
  }));
});
