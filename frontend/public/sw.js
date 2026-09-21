const CACHE='plan2field-shell-v1';
self.addEventListener('install',event=>{event.waitUntil((async()=>{const html=await fetch('/index.html').then(r=>r.text());const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(m=>m[1]);const cache=await caches.open(CACHE);await cache.addAll(['/','/index.html',...assets]);await self.skipWaiting();})());});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;}).catch(async()=>await caches.match(event.request)||(event.request.mode==='navigate'?await caches.match('/index.html'):Response.error())));
});
