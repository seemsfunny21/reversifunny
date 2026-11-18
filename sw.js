/* ReversiFunny isolated cache — never touches other installed game data. */
const PREFIX="reversifunny-shell-",CACHE=PREFIX+"v2-desktop-layout";
const FILES=["./","./index.html","./style.css?v=2","./engine.js?v=1",
 "./app.js?v=1","./hero-banner.svg","./icon.svg","./manifest.webmanifest"];
self.addEventListener("install",event=>
 event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
 ])));
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=="GET"||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 event.respondWith((async()=>{
  const c=await caches.open(CACHE);
  if(request.mode==="navigate"){
   try{
    const res=await fetch(request,{cache:"no-store"});
    if(res.ok)try{await c.put("./index.html",res.clone())}catch(_){}
    return res;
   }catch{return await c.match("./index.html")||Response.error()}
  }
  const stored=await c.match(request);
  if(stored)return stored;
  try{const res=await fetch(request);if(res.ok)try{await c.put(request,res.clone())}catch(_){}return res;}
  catch{return Response.error()}
 })());
});
