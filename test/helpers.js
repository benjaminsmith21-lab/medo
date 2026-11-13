// Loads index.html in jsdom with fake storage, speech and network, so the board can be driven like a tablet.
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const makeSeed=require('./seed.js');
// The board's own timers (voice loading, update checks) can fire after a test has closed its window. Ignore only that noise.
let closedAny=false;
process.on('unhandledRejection',e=>{if(closedAny&&/reading '(getElementById|querySelector|body)'|document is not defined/.test(String(e&&e.message)))return;throw e;});
process.on('uncaughtException',e=>{if(closedAny&&/reading '(getElementById|querySelector|body)'|document is not defined/.test(String(e&&e.message)))return;throw e;});
function boot(opts={}){
  const seed=makeSeed();seed.cfg.v=9;seed.cfg.setupDone=true;
  if(opts.cfg)opts.cfg(seed.cfg,seed);
  const spoken=[],posts=[],fetches=[],stats=[],played=[];
  const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:opts.url||'https://x.test/',beforeParse(w){
    if(opts.lang){Object.defineProperty(w.navigator,'language',{value:opts.lang});Object.defineProperty(w.navigator,'languages',{value:[opts.lang]});}
    if(!opts.blank){w.localStorage.setItem('qb_cfg',JSON.stringify(seed.cfg));w.localStorage.setItem('qb_hist',JSON.stringify(seed.hist));}
    if(opts.storage)for(const k in opts.storage)w.localStorage.setItem(k,typeof opts.storage[k]==='string'?opts.storage[k]:JSON.stringify(opts.storage[k]));
    w.fetch=(u,o)=>{fetches.push(u);if(o&&o.method==='POST'){posts.push({url:u,mode:o.mode,body:o.body.toString()});return Promise.resolve({type:'opaque'});}
      const r=opts.fetch&&opts.fetch(u);if(r)return Promise.resolve(r);return Promise.reject(new Error('offline'));};
    w.speechSynthesis={getVoices:()=>[],cancel(){},speak(u){spoken.push(u.text);setTimeout(()=>{u.onend&&u.onend();},0);},addEventListener(){}};
    if(opts.idb){const f=require('fake-indexeddb');w.indexedDB=new f.IDBFactory();w.IDBKeyRange=f.IDBKeyRange;}
    w.Audio=function(src){this.src=src;this.play=()=>{played.push(src);return Promise.resolve();};this.pause=()=>{};};
    w.SpeechSynthesisUtterance=function(t){this.text=t;};
    w.goatcounter={count:c=>stats.push(c.path)};
    // remember every timer so a finished test can switch the board off cleanly
    const st=w.setTimeout.bind(w),si=w.setInterval.bind(w);
    w.__timers=[];w.setTimeout=(f,ms,...a)=>{const id=st(f,ms,...a);w.__timers.push(id);return id;};
    w.setInterval=(f,ms,...a)=>{const id=si(f,ms,...a);w.__timers.push(id);return id;};
  }});
  const w=dom.window,d=w.document,errors=[];
  w.addEventListener('error',e=>errors.push(e.message));
  const t={w,d,seed,spoken,posts,fetches,stats,errors,played,
    putAudio(key,url){return new Promise(res=>{const rq=w.indexedDB.open('qb_photos',1);rq.onupgradeneeded=()=>rq.result.createObjectStore('p');rq.onsuccess=()=>{const tx=rq.result.transaction('p','readwrite');tx.objectStore('p').put({url,ts:Date.now()},key);tx.oncomplete=()=>{rq.result.close();res();};};});},
    cfg:()=>JSON.parse(w.localStorage.getItem('qb_cfg')),
    lastSaid:()=>spoken[spoken.length-1]||'',
    openSettings(tab){d.getElementById('gearBtn').click();const m=d.getElementById('gateQ').textContent.match(/(\d+) × (\d+)/);
      d.getElementById('gateInput').value=String(m[1]*m[2]);d.getElementById('gateOk').click();
      if(tab)[...d.querySelectorAll('#sNav button')].find(b=>b.textContent.includes(tab)).click();},
    button:(text,root)=>[...(root||d).querySelectorAll('button')].find(b=>b.textContent.trim()===text||b.textContent.includes(text)),
    close(){closedAny=true;w.fetch=()=>new Promise(()=>{});w.__timers.forEach(id=>{w.clearTimeout(id);w.clearInterval(id);});w.__closed=true;
      w.setTimeout=()=>0;w.setInterval=()=>0;}};
  return t;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dayOff=n=>{const t=new Date();return new Date(t.getFullYear(),t.getMonth(),t.getDate()+n);};
module.exports={boot,wait,ymd,dayOff,HTML};
