/* First Move iPhone — offline, same-origin, static-only service worker. */
const CACHE_PREFIX="firstmove-iphone-";
const CACHE=CACHE_PREFIX+"5922212746b1";
const APP_ROOT=new URL("./",self.registration.scope);
const INDEX=new URL("index.html",APP_ROOT).href;
const PRECACHE=[
 "./",
 "./index.html",
 "./manifest.webmanifest",
 "./icons/icon-180.png",
 "./icons/icon-192.png",
 "./icons/icon-512.png"
];
self.addEventListener("install",event=>{
 event.waitUntil(
   caches.open(CACHE).then(cache=>cache.addAll(PRECACHE.map(url=>new Request(url,{cache:"reload"})))).then(()=>self.skipWaiting())
 );
});
self.addEventListener("activate",event=>{
 event.waitUntil(
   caches.keys().then(keys=>Promise.all(keys.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE).map(name=>caches.delete(name)))).then(()=>self.clients.claim())
 );
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(APP_ROOT.pathname))return;
 if(url.pathname.endsWith("/version.json")){event.respondWith(fetch(request,{cache:"no-store"}));return;}
 if(request.mode==="navigate"){
   // Try online updates first, but preserve the complete chess program for offline play.
   event.respondWith(fetch(request,{cache:"no-store"}).then(async response=>{
     if(response.ok){
       try{const cache=await caches.open(CACHE);await cache.put(INDEX,response.clone());}catch{}
     }
     if(!response.ok)throw new Error("Navigation HTTP "+response.status);
     return response;
   }).catch(async()=>{
     return await caches.match(INDEX)||await caches.match(new URL("./",APP_ROOT).href)||Response.error();
   }));
   return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
   if(response.ok&&url.origin===self.location.origin){
     const copy=response.clone();
     void caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
   }
   return response;
 })));
});
self.addEventListener("message",event=>{
 if(event.data?.type==="SKIP_WAITING")void self.skipWaiting();
});
