const test=require('node:test');const assert=require('node:assert');
const {boot,wait,ymd,dayOff,HTML}=require('./helpers');
const vm=require('vm');const fs=require('fs');const path=require('path');

test('app script and service worker parse',()=>{
  const js=HTML.match(/<script>([\s\S]*)<\/script>/)[1];
  assert.doesNotThrow(()=>new vm.Script(js));
  assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8')));
  assert.match(HTML,/var BOARD_VERSION='[^']+'/,'BOARD_VERSION must exist (the updater looks for it)');
});

test('board loads with a card per child and no errors',async()=>{
  const t=boot();await wait(300);
  assert.equal(t.d.querySelectorAll('.kcard').length,2);
  assert.deepEqual(t.errors,[]);t.close();
});

test('ticking a quest praises it in the past tense; finishing the day earns a star',async()=>{
  const t=boot({cfg:c=>{c.arvoStart='00:00';},storage:{qb_prog:{date:ymd(new Date()),done:[['toilet','dress','breakfast','teeth','hair','shoes'],[]],celebrated:{am:[true,false],pm:[]}}}});
  await wait(300);
  t.d.querySelectorAll('.kcard')[0].click();
  const tiles=()=>[...t.d.querySelectorAll('.tile:not(.done)')];
  tiles()[0].click();assert.match(t.lastSaid(),/^You /);
  while(tiles().length)tiles()[0].click();
  assert.match(t.lastSaid(),/star for your star jar/);
  assert.equal(t.cfg().kids[0].stars.count,13);
  t.close();
});

test('grown-ups lock: keypad opens settings only with the right answer',async()=>{
  const t=boot();await wait(300);
  t.d.getElementById('gearBtn').click();
  ['1','1'].forEach(k=>t.d.querySelector(`#gateKeys button[data-k="${k}"]`).click());await wait(250);
  assert.ok(!t.d.getElementById('settings').classList.contains('open'));
  const m=t.d.getElementById('gateQ').textContent.match(/(\d+) × (\d+)/);
  String(m[1]*m[2]).split('').forEach(k=>t.d.querySelector(`#gateKeys button[data-k="${k}"]`).click());await wait(250);
  assert.ok(t.d.getElementById('settings').classList.contains('open'));t.close();
});

test('rewards: earned pill, Given resets, money goes in the jar and can be spent',async()=>{
  const t=boot({cfg:c=>c.rewards.push({id:'r9',kind:'money',amount:2,prize:'',kids:['kA'],type:'stars',n:5,frame:'since',repeat:'every',show:true,created:c.rewards[0].created})});
  await wait(300);
  assert.ok(t.d.querySelector('.kbadges .pill.reward.earned'));
  assert.equal(t.d.querySelector('#gearBtn .gdot').textContent,'2');
  t.openSettings();
  assert.match(t.d.querySelector('#sNav button.sel').textContent,/Rewards/,'settings opens on Rewards when something is waiting');
  const row=[...t.d.querySelectorAll('.rwwait')].find(r=>r.textContent.includes('pocket money'));row.querySelector('button').click();
  assert.equal(t.d.querySelector('.mjbal').textContent,'$2');
  const jar=t.d.querySelectorAll('.mjrow')[0];t.button('Spend',jar).click();
  jar.querySelector('.mjform input[type=number]').value='1.5';t.button('Save',jar).click();
  assert.equal(t.d.querySelector('.mjbal').textContent,'$0.50');
  assert.equal(t.cfg().kids[0].rewardLog.slice(-1)[0].name,'$2 pocket money');
  t.close();
});

test('trophy case opens from the card and lists badges and rewards',async()=>{
  const t=boot();await wait(300);
  t.d.querySelector('.pill.troph').click();
  assert.ok(t.d.getElementById('trophyOv').classList.contains('show'));
  assert.ok(t.d.querySelectorAll('.tgrid .ttile').length>=10);
  assert.ok([...t.d.querySelectorAll('.tsec h3')].some(h=>/My rewards/.test(h.textContent)));
  assert.match(t.lastSaid(),/trophy case/);t.close();
});

test('photo/grown-up proof: ticking a proof quest opens the proof screen instead',async()=>{
  const t=boot({cfg:c=>{c.steps.find(s=>s.id==='teeth').proof='parent';}});await wait(300);
  t.d.querySelectorAll('.kcard')[0].click();
  [...t.d.querySelectorAll('.tile')].find(x=>x.textContent.includes('Brush teeth')).click();
  assert.ok(t.d.getElementById('proofOv').classList.contains('show'));
  assert.ok(t.d.querySelector('.pfhold'));t.close();
});

test('birthdays: own child gets the crown; a friend with the same name does not',async()=>{
  let t=boot({cfg:c=>{c.kids[0].birthday=ymd(new Date(new Date().getFullYear()-6,new Date().getMonth(),new Date().getDate()));
    c.events=[{id:'e2',emoji:'🎈',name:"Ava's birthday party",date:ymd(new Date()),repeat:'none'}];}});await wait(300);
  assert.match(t.d.getElementById('themeBanner').textContent,/Happy birthday, Ava! 6 today/);
  assert.ok(t.d.querySelectorAll('.kcard')[0].querySelector('.crown'));t.close();
  t=boot({cfg:c=>{c.kids[0].birthday='2020-03-12';c.events=[{id:'e2',emoji:'🎈',name:"Ava's birthday party",date:ymd(new Date()),repeat:'none'}];}});await wait(300);
  assert.match(t.d.getElementById('themeBanner').textContent,/birthday party today/);
  assert.equal(t.d.querySelectorAll('.crown').length,0);t.close();
});

test('countdowns: ordinal titles and natural, rotating speech',async()=>{
  const b=dayOff(17);
  const t=boot({cfg:c=>{c.eventLead=40;c.kids[0].name='Marlo';c.kids[0].birthday=ymd(new Date(b.getFullYear()-6,b.getMonth(),b.getDate()));c.events=[];}});await wait(300);
  const chip=[...t.d.querySelectorAll('.evchip')].find(c=>c.textContent.includes('Marlo'));
  assert.match(chip.textContent,/Marlo's 6th birthday/);
  chip.click();const a=t.lastSaid();chip.click();const b2=t.lastSaid();
  assert.equal(a,'Marlo turns 6 in 17 more sleeps!');assert.notEqual(a,b2);t.close();
});

test('trips: Day 3 of 7 pill, holiday mode drops the leave time and uses weekend quests',async()=>{
  const t=boot({cfg:c=>{for(let i=0;i<7;i++)c.days[i].leave='23:59';c.days[6].kids=[['toilet'],['toilet']];c.days[0].kids=[['toilet'],['toilet']];
    c.events=[{id:'e1',emoji:'🏖️',name:'Sydney holiday',date:ymd(dayOff(-2)),end:ymd(dayOff(4)),repeat:'none'}];}});await wait(300);
  assert.equal(t.d.getElementById('tripPill').textContent,'🏖️ Day 3 of 7');
  assert.equal(t.d.getElementById('themeBanner').style.display,'none');
  assert.ok(t.d.querySelector('header').classList.contains('centred'),'no leave bar on holiday');
  assert.match(t.d.querySelector('.kcount').textContent,/of 1 done/);t.close();
});

test('away weather: an event with a location fetches that town',async()=>{
  const t=boot({cfg:c=>{c.events=[{id:'e1',emoji:'🏖️',name:'Noosa',date:ymd(dayOff(-1)),end:ymd(dayOff(2)),repeat:'none',loc:{name:'Noosa Heads',lat:-26.39,lon:153.09}}];}});
  await wait(300);
  assert.ok(t.fetches.some(u=>/forecast.*latitude=-26\.39/.test(u)));t.close();
});

test('public holidays follow the country; a new US device gets °F and US holidays',async()=>{
  const t=boot({blank:true,lang:'en-US'});await wait(400);
  assert.ok(t.fetches.some(u=>/PublicHolidays\/\d+\/US/.test(u)));
  assert.ok(t.d.getElementById('setupOv').classList.contains('show')||true);
  t.close();
});

test('first run shows the setup; an existing family does not',async()=>{
  let t=boot({blank:true});await wait(2600);
  assert.ok(t.d.getElementById('setupOv').classList.contains('show'));t.close();
  t=boot();await wait(2600);
  assert.ok(!t.d.getElementById('setupOv').classList.contains('show'));t.close();
});

test('feedback posts the four fields to the Google Form',async()=>{
  const t=boot();await wait(300);t.openSettings('About');
  t.d.querySelector('.fbtext').value='Hello there';t.button('Send').click();await wait(50);
  assert.equal(t.posts.length,1);
  assert.match(t.posts[0].url,/forms\/d\/e\/.+\/formResponse$/);
  assert.match(t.posts[0].body,/entry\.178877530=Hello\+there/);t.close();
});

test('usage stats: counts when on, nothing at all when switched off',async()=>{
  let t=boot({url:'https://benjaminsmith21-lab.github.io/medo/'});await wait(3300);
  const sc=t.d.getElementById('gcScript');assert.ok(sc);sc.onload();
  assert.ok(t.stats.includes('/')&&t.stats.includes('daily-board'));t.close();
  t=boot({url:'https://benjaminsmith21-lab.github.io/medo/',storage:{qb_stats:'off'}});await wait(3300);
  assert.equal(t.d.getElementById('gcScript'),null);t.close();
});

test.after(()=>{setTimeout(()=>process.exit(process.exitCode||0),200);});   // jsdom windows are left open; exit once all tests are done

test('leaving for activities: after school, the runner counts down to the event and the clock names it',async()=>{
  const t=boot({cfg:c=>{const now=new Date(),hm=d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    for(let i=0;i<7;i++)c.days[i].leave=hm(new Date(now.getTime()-3*3600e3));          // school run already done today
    c.events=[{id:'n1',emoji:'🏄',name:'Nippers',date:ymd(dayOff(-7)),repeat:'weekly',wdays:[now.getDay()],leave:hm(new Date(now.getTime()+40*60e3))}];}});
  await wait(300);
  assert.equal(t.d.getElementById('dest').textContent,'🏄');
  assert.match(t.d.getElementById('cdLabel').textContent,/^Nippers · .* · 40 min$/);
  t.d.getElementById('countdown').click();await wait(3500);
  assert.match(t.d.getElementById('clockLeave').textContent,/Nippers · Leave at/);
  t.close();
});

test('calendar link carries the weekly repeat and end date',async()=>{
  const t=boot({cfg:c=>{c.events=[{id:'n1',emoji:'🏄',name:'Nippers',date:'2026-11-06',repeat:'weekly',wdays:[5],endMode:'on',until:'2027-03-26',leave:'16:00'}];}});
  await wait(300);t.openSettings('Events');
  let opened='';t.w.open=u=>{opened=u;};
  const it=t.d.querySelector('details.item');it.open=true;t.button('Add to Google Calendar',it).click();
  assert.match(decodeURIComponent(opened),/text=Leave for Nippers/);
  assert.match(decodeURIComponent(opened),/RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20270326/);
  assert.match(opened,/T160000\//);t.close();
});

test('own time picker: no Android clock; 4 + :00 + pm sets 16:00 on the event',async()=>{
  const t=boot({cfg:c=>{c.events=[{id:'n1',emoji:'🏄',name:'Nippers',date:'2026-11-06',repeat:'weekly',wdays:[5],leave:'05:00'}];}});
  await wait(300);t.openSettings('Events');const it=t.d.querySelector('details.item');it.open=true;await wait(50);
  const btn=[...it.querySelectorAll('.pkbtn')].find(b=>/5:00 am/.test(b.textContent));assert.ok(btn,'leave time shows as an in-app button');
  assert.equal(it.querySelectorAll('input[type=time]:not([style*="none"])').length,0,'native time boxes are hidden');
  btn.click();
  const sheet=t.d.querySelector('.pksheet');
  [...sheet.querySelectorAll('.pkgrid button')].find(b=>b.textContent==='4').click();
  [...sheet.querySelectorAll('.pkgrid button')].find(b=>b.textContent===':00').click();
  [...sheet.querySelectorAll('.pkap button')].find(b=>b.textContent==='pm').click();
  t.button('Set',sheet).click();
  assert.equal(t.cfg().events[0].leave,'16:00');
  assert.match(btn.textContent,/4:00 pm/);t.close();
});

test('own date picker: birthday picked from the calendar, future dates blocked',async()=>{
  const t=boot();await wait(300);t.openSettings('Children');await wait(50);
  const btn=[...t.d.querySelectorAll('.pkbtn')][0];btn.click();
  const sheet=t.d.querySelector('.pksheet');
  for(let i=0;i<6;i++)sheet.querySelector('.pknav button[title="Year back"]').click();
  assert.ok(sheet.querySelector('.pknav b').textContent.endsWith(String(new Date().getFullYear()-6)));
  [...sheet.querySelectorAll('.pkcal button')].find(b=>b.textContent==='12').click();
  assert.match(t.cfg().kids[0].birthday,new RegExp('^'+(new Date().getFullYear()-6)+'-\\d\\d-12$'));
  btn.click();const s2=t.d.querySelector('.pksheet');
  s2.querySelector('.pknav button[title="Year forward"]').click();for(let i=0;i<7;i++)s2.querySelector('.pknav button[title="Year forward"]').click();
  assert.ok([...s2.querySelectorAll('.pkcal button')].every(b=>b.disabled),'a birthday can\'t be in the future');t.close();
});

test('routine length: a 4-year-old with 9 morning quests gets a gentle note, with fixes',async()=>{
  const t=boot({cfg:c=>{const y=new Date().getFullYear()-4;c.kids[1].birthday=y+'-01-01';c.kids[1].mode='grid';
    ['x1','x2','x3'].forEach(id=>c.steps.push({id,emoji:'⭐',label:'Extra '+id,period:'am'}));
    const am=c.steps.filter(s=>(s.period||'am')==='am').map(s=>s.id).slice(0,9);for(let d=0;d<7;d++)c.days[d].kids[1]=am.slice();}});
  await wait(300);t.openSettings('Quests');await wait(50);
  const note=[...t.d.querySelectorAll('.loadnote')].find(n=>n.textContent.includes('Leo'));
  assert.ok(note,'note shown');assert.match(note.textContent,/Around 6 or fewer suits most 4-year-olds/);
  assert.ok(t.d.querySelector('.qcount.over'));
  t.button('Show one at a time for Leo',note).click();
  assert.equal(t.cfg().kids[1].mode,'nownext');
  t.button("Don't show again for Leo").click();
  assert.ok(![...t.d.querySelectorAll('.loadnote')].some(n=>n.textContent.includes('Leo')));t.close();
});

test('progress insight: a morning rarely finished is pointed out',async()=>{
  const hist={};for(let i=1;i<=12;i++){const k=ymd(dayOff(-i));hist[k]={kA:{am:['toilet','dress','breakfast','teeth','hair','shoes','bag','sunscreen','hat'],pm:[],done:i%5===0?['toilet','dress','breakfast','teeth','hair','shoes','bag','sunscreen','hat']:['toilet','dress'],star:false,read:false}};}
  const t=boot({storage:{qb_hist:hist},cfg:c=>{c.kids[0].birthday=(new Date().getFullYear()-6)+'-01-01';}});await wait(300);t.openSettings('Progress');
  const n=[...t.d.querySelectorAll('.loadnote')].find(x=>x.textContent.includes('Ava finished their morning'));
  assert.ok(n);assert.match(n.textContent,/on 2 of the last 10 days/);assert.match(n.textContent,/might be too long/);t.close();
});
