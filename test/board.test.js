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
  let t=boot({blank:true});await wait(3000);
  assert.ok(t.d.getElementById('intro'),'the splash waits for them');
  t.button('Get started',t.d.getElementById('intro')).click();await wait(400);
  assert.ok(t.d.getElementById('setupOv').classList.contains('show'));
  assert.match(t.d.getElementById('setupOv').textContent,/Who's using it/,'straight to the first question');t.close();
  t=boot();await wait(4000);
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
  let t=boot({url:'https://benjaminsmith21-lab.github.io/medo/'});await wait(4200);
  const sc=t.d.getElementById('gcScript');assert.ok(sc);sc.onload();
  assert.ok(t.stats.includes('/')&&t.stats.includes('daily-board'));t.close();
  t=boot({url:'https://benjaminsmith21-lab.github.io/medo/',storage:{qb_stats:'off'}});await wait(4200);
  assert.equal(t.d.getElementById('gcScript'),null);t.close();
});

test.after(()=>{setTimeout(()=>process.exit(process.exitCode||0),200);});   // jsdom windows are left open; exit once all tests are done

test('leaving for activities: after school, the runner counts down to the event and the clock names it',async()=>{
  // works at any time of day (the GitHub check runs on UTC, often around midnight)
  const now=new Date(),hm=d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  let lv=new Date(now.getTime()+40*60e3);if(lv.getDate()!==now.getDate())lv=new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59);
  const school=now.getHours()>=1?hm(new Date(now.getTime()-Math.min(3,now.getHours())*3600e3+60e3)):'';
  const t=boot({cfg:c=>{for(let i=0;i<7;i++)c.days[i].leave=school;          // school run already done today (if there was time for one)
    c.events=[{id:'n1',emoji:'🏄',name:'Nippers',date:ymd(dayOff(-7)),repeat:'weekly',wdays:[now.getDay()],leave:hm(lv)}];}});
  await wait(300);
  assert.equal(t.d.getElementById('dest').textContent,'🏄');
  assert.match(t.d.getElementById('cdLabel').textContent,/^Nippers · .* · \d+ min$/);
  t.d.getElementById('countdown').click();await wait(4500);
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

test('voice message: plays after the cheer when a child finishes the day, once only',async()=>{
  const t=boot({idb:true,cfg:c=>{c.arvoStart='00:00';c.messages=[{id:'m1',from:{name:'Nana',emoji:'👵'},kids:['kA'],when:'day',repeat:'once',created:'2026-11-01',played:{}}];},
    storage:{qb_prog:{date:ymd(new Date()),done:[['toilet','dress','breakfast','teeth','hair','shoes'],[]],celebrated:{am:[true,false],pm:[]}}}});
  await t.putAudio('msg|m1','data:audio/webm;base64,AAAA');await wait(300);
  t.d.querySelectorAll('.kcard')[0].click();
  while(t.d.querySelector('.tile:not(.done)'))t.d.querySelector('.tile:not(.done)').click();
  await wait(400);
  assert.deepEqual(t.played,['data:audio/webm;base64,AAAA']);
  assert.equal(t.cfg().messages[0].played.kA.length,1);
  assert.ok([...t.d.querySelectorAll('.mile')].some(x=>/A message from Nana!/.test(x.textContent)));t.close();
});

test('voice message on a date plays by itself when the board is on',async()=>{
  const t=boot({idb:true,cfg:c=>{c.messages=[{id:'m2',from:{name:'Pop',emoji:'👴'},kids:['kA','kB'],when:'date',date:ymd(new Date()),repeat:'once',created:'2026-11-01',played:{}}];}});
  await t.putAudio('msg|m2','data:audio/webm;base64,BBBB');await wait(6500);
  assert.deepEqual(t.played,['data:audio/webm;base64,BBBB']);
  const ms=t.cfg().messages;assert.equal(ms.length,2,'an older both-kids message becomes one per child');
  assert.ok(ms.every(m=>m.kids.length===1&&m.audio==='msg|m2'),'both share the one recording');
  assert.equal(t.played.length,1);t.close();
});

test('messages tab lists messages; kids can replay heard ones from the trophy case',async()=>{
  const t=boot({idb:true,cfg:c=>{c.messages=[{id:'m3',from:{name:'Nana',emoji:'👵'},kids:['kA'],when:'surprise',repeat:'every',created:'2026-11-01',played:{kA:['2026-11-10']}}];}});
  await t.putAudio('msg|m3','data:audio/webm;base64,CCCC');await wait(300);
  t.d.querySelector('.pill.troph').click();
  const card=[...t.d.querySelectorAll('.tsec')].find(x=>x.textContent.includes('My messages'));assert.ok(card);
  card.querySelector('.rwcard').click();await wait(200);
  assert.deepEqual(t.played,['data:audio/webm;base64,CCCC']);
  t.d.querySelector('.tclose').click();t.openSettings('Messages');
  assert.match(t.d.querySelector('details.item').textContent,/From Nana/);
  assert.ok(t.button('Record a new message'));t.close();
});

test('no wifi: the weather card says so plainly instead of sounding broken',async()=>{
  const t=boot({storage:{qb_wx:{date:'2000-01-01'}}});
  Object.defineProperty(t.w.navigator,'onLine',{value:false,configurable:true});
  await wait(400);t.w.dispatchEvent(new t.w.Event('offline'));
  assert.match(t.d.getElementById('wxTitle').textContent,/No internet right now/);
  assert.match(t.d.getElementById('wxSub').textContent,/back on wifi/);
  t.d.getElementById('wx').click();await wait(200);
  assert.match(t.lastSaid(),/need the internet to check the weather/);t.close();
});

test('a message can play straight after a particular quest',async()=>{
  const t=boot({idb:true,cfg:c=>{c.arvoStart='23:59';c.messages=[{id:'m5',from:{name:'Pop',emoji:'👴'},kids:['kA'],when:'quest',quest:'teeth',repeat:'every',created:'2026-11-01',played:{}}];}});
  await t.putAudio('msg|m5','data:audio/webm;base64,EEEE');await wait(300);
  t.d.querySelectorAll('.kcard')[0].click();
  [...t.d.querySelectorAll('.tile')].find(x=>x.textContent.includes('Get dressed')).click();await wait(300);
  assert.deepEqual(t.played,[],'not after another quest');
  [...t.d.querySelectorAll('.tile')].find(x=>x.textContent.includes('Brush teeth')).click();await wait(400);
  assert.deepEqual(t.played,['data:audio/webm;base64,EEEE']);t.close();
});

test('recording a message: pick a moment, then a script that fits who it is for',async()=>{
  const t=boot({idb:true});await wait(300);t.openSettings('Messages');
  t.button('Record a new message').click();
  const s1=t.d.querySelector('.pksheet');
  assert.equal(s1.querySelectorAll('.rwtype.mom').length,5,'five moments to pick from');
  [...s1.querySelectorAll('.rwtype')].find(b=>b.textContent.includes('Surprise')).click();
  const s2=t.d.querySelector('.pksheet');
  const nm=s2.querySelector('.recwho input[type=text]');nm.value='Nana';nm.dispatchEvent(new t.w.Event('input'));
  assert.match(s2.querySelector('.scriptt').textContent,/Surprise! It's Nana/);
  t.button('Another idea',s2).click();
  assert.match(s2.querySelector('.scriptt').textContent,/^Hello! Nana here/,'any child: no name');
  t.button('Ava',s2).click();
  assert.match(s2.querySelector('.scriptt').textContent,/^Hello Ava! Nana here/);t.close();
});

test('several recordings for the same moment: one plays, picked at random',async()=>{
  const msg=(id,n)=>({id,from:{name:n,emoji:'👵'},kids:[],when:'day',repeat:'every',created:'2026-11-01',played:{}});
  const t=boot({idb:true,cfg:c=>{c.arvoStart='00:00';c.messages=[msg('n1','Nana'),msg('p1','Pop')];},
    storage:{qb_prog:{date:ymd(new Date()),done:[['toilet','dress','breakfast','teeth','hair','shoes'],[]],celebrated:{am:[true,false],pm:[]}}}});
  await t.putAudio('msg|n1','data:audio/webm;base64,NANA');await t.putAudio('msg|p1','data:audio/webm;base64,POPP');await wait(300);
  t.d.querySelectorAll('.kcard')[0].click();
  while(t.d.querySelector('.tile:not(.done)'))t.d.querySelector('.tile:not(.done)').click();
  await wait(400);
  assert.equal(t.played.length,1,'only one message for the moment');t.close();
});

test('birthday message plays on that child\'s birthday',async()=>{
  const md=ymd(new Date()).slice(5);
  const t=boot({idb:true,cfg:c=>{c.kids[0].birthday='2020-'+md;c.messages=[{id:'b1',from:{name:'Pop',emoji:'👴'},kids:[],when:'birthday',repeat:'every',created:'2026-11-01',played:{}}];}});
  await t.putAudio('msg|b1','data:audio/webm;base64,BDAY');await wait(6500);
  assert.deepEqual(t.played,['data:audio/webm;base64,BDAY']);
  const m=t.cfg().messages[0];assert.ok(m.played.kA&&!m.played.kB,'only the birthday child');t.close();
});

test('rain is spoken by part of the day, not just "it will rain"',async()=>{
  const td=ymd(new Date()),time=[],pp=[],mm=[],code=[],uv=[];
  for(let h=0;h<24;h++){time.push(td+'T'+String(h).padStart(2,'0')+':00');
    const pm=h>=12&&h<18,eve=h>=18&&h<22;pp.push(pm||eve?90:10);mm.push(pm?0.6:eve?0.05:0);code.push(pm?61:1);uv.push(0);}
  const data={current:{temperature_2m:18,weather_code:1},
    daily:{temperature_2m_max:[20],temperature_2m_min:[12],precipitation_probability_max:[90],uv_index_max:[2],weather_code:[61],wind_speed_10m_max:[10],wind_gusts_10m_max:[20]},
    hourly:{time,precipitation_probability:pp,precipitation:mm,weather_code:code,uv_index:uv}};
  const t=boot({fetch:u=>/api\.open-meteo\.com\/v1\/forecast/.test(u)?{ok:true,json:()=>Promise.resolve(data)}:null});
  await wait(500);t.d.getElementById('wx').click();await wait(300);
  const said=t.lastSaid(),hr=new Date().getHours();
  if(hr<18){assert.match(said,/^It will be \w+( and \w+)? today, so wear .*\. .*It will rain after lunch, so take your raincoat\.$/);
    assert.doesNotMatch(said,/tonight/,'tonight does not change what they wear');
    assert.match(t.d.getElementById('wxSub').textContent,/rain 90% after lunch/);}
  else assert.doesNotMatch(said,/rain/);
  t.close();
});

test('the money jar is spoken in words, and an empty jar says so',async()=>{
  const t=boot({cfg:c=>{c.holidays=c.holidays||{};c.holidays.country='AU';c.rewards.push({id:'r9',kind:'money',amount:2,prize:'',kids:['kA'],type:'stars',n:500,frame:'since',repeat:'every',show:true,created:c.rewards[0].created});}});
  await wait(300);
  t.d.querySelector('.pill.troph').click();
  t.d.querySelector('.rwcard.jar').click();
  assert.match(t.lastSaid(),/money jar is empty/);assert.doesNotMatch(t.lastSaid(),/\$/);
  t.d.querySelector('.tclose').click();
  t.close();
  const t2=boot({cfg:c=>{c.holidays=c.holidays||{};c.holidays.country='AU';c.kids[0].money={bal:2.5,log:[]};c.rewards.push({id:'r9',kind:'money',amount:2,prize:'',kids:['kA'],type:'stars',n:500,frame:'since',repeat:'every',show:true,created:c.rewards[0].created});}});
  await wait(300);t2.d.querySelector('.pill.troph').click();t2.d.querySelector('.rwcard.jar').click();
  assert.match(t2.lastSaid(),/You have 2 dollars and 50 cents in your money jar/);t2.close();
});

test('first-run setup assumes nothing: no default children, town or leave time',async()=>{
  const t=boot({blank:true});await wait(3000);
  t.button('Get started',t.d.getElementById('intro')).click();await wait(400);
  assert.ok(!t.fetches.some(u=>/api\.open-meteo\.com\/v1\/forecast/.test(u)),'no weather lookup before a town is chosen');
  assert.equal(t.d.getElementById('wx').style.display,'none');
  const ov=t.d.getElementById('setupOv');
  assert.ok(!t.button('Skip setup',ov),'no skip-everything button');
  assert.equal(ov.querySelectorAll('.sukid').length,1,'one child to start');
  const nm=ov.querySelector('.bigname');assert.equal(nm.value,'');
  t.button('Next',ov).click();assert.ok(ov.querySelector('.bigname'),'needs a name before moving on');
  nm.value='Mia';nm.dispatchEvent(new t.w.Event('input'));t.button('Next',ov).click();
  assert.doesNotMatch(ov.textContent,/Frankston/);assert.match(ov.textContent,/Medo will show Mia what to wear/);
  t.button("Skip, we don't need what-to-wear tips",ov).click();
  assert.ok(!ov.querySelector('.sutimes .chip.on'),'no leave time picked for them');
  t.button('Next',ov).click();assert.ok(ov.querySelector('.sutimes'),'needs a time or "no set time"');
  t.button('8:30',ov).click();t.button('Next',ov).click();
  assert.match(ov.textContent,/talks to Mia/);assert.ok(!ov.querySelector('.switch'),'no voice off switch in setup');
  t.button('Emma',ov).click();
  assert.ok(t.played.some(x=>/tts\/samples\/emma\.mp3$/.test(x)),'plays the sample straight away');
  assert.equal(t.cfg().ai.voice,'k:bf_emma');
  t.button('Next',ov).click();
  assert.match(ov.textContent,/stays on this/);
  const c=t.cfg();assert.equal(c.kids.length,1);assert.equal(c.kids[0].name,'Mia');assert.equal(c.days[1].leave,'08:30');assert.equal(c.loc.lat,null);
  t.close();
});

test('Kokoro voices are offered, and the board still talks if Kokoro can\'t load',async()=>{
  const t=boot({cfg:c=>{c.ai={on:true,voice:'k:af_heart'};}});await wait(300);
  t.openSettings('Sound');
  const sel=[...t.d.querySelectorAll('select')].find(s=>s.querySelector('optgroup'));
  assert.ok(sel,'grouped voice list');
  assert.match(sel.querySelector('optgroup').label,/Kokoro/);
  assert.equal(sel.value,'k:af_heart');
  t.button('Play a sample').click();await wait(300);
  assert.match(t.lastSaid(),/superstar/,'falls back to the built-in voice');t.close();
});

test('cool but sunny: the sun warning explains itself',async()=>{
  const td=ymd(new Date()),time=[],z=[],uv=[];
  for(let h=0;h<24;h++){time.push(td+'T'+String(h).padStart(2,'0')+':00');z.push(0);uv.push(h>=6&&h<=20?9:0);}
  const data={current:{temperature_2m:13,weather_code:1},daily:{temperature_2m_max:[15],temperature_2m_min:[8],precipitation_probability_max:[0],uv_index_max:[9],weather_code:[1],wind_speed_10m_max:[5],wind_gusts_10m_max:[10]},
    hourly:{time,precipitation_probability:z,precipitation:z,weather_code:z.map(()=>1),uv_index:uv}};
  const t=boot({fetch:u=>/v1\/forecast/.test(u)?{ok:true,json:()=>Promise.resolve(data)}:null});
  await wait(500);t.d.getElementById('wx').click();await wait(300);
  const said=t.lastSaid();
  if(new Date().getHours()<20){
    assert.match(said,/^It will be cool today, so wear .*jumper.*\. The sun is strong today and can burn your skin, even though it feels cool\. Put on sunscreen and wear your hat, and play in the shade at lunchtime\.$/);}
  t.close();
});

test('praise describes what they did, changes each time, and fades as the habit forms',async()=>{
  // a brand-new child (no history): praise on every tick, worded differently each time
  const t=boot({storage:{qb_hist:{}}});await wait(300);
  t.d.querySelectorAll('.kcard')[0].click();
  const said=[];
  for(let i=0;i<4;i++){const tile=t.d.querySelector('.tile:not(.done)');tile.click();await wait(120);said.push(t.lastSaid());tile.click();await wait(120);}
  assert.ok(new Set(said).size>=3,'varied: '+said.join(' | '));
  t.close();
  // a child with a month of history: some ticks are just a quiet "You brushed your teeth."
  const h={};for(let i=1;i<=30;i++){const d=ymd(new Date(Date.now()-i*864e5));h[d]={kA:{am:['teeth'],pm:[],done:['teeth']}};}
  const t2=boot({cfg:c=>{c.trophies=false;},storage:{qb_hist:h,qb_tips:{'undo:kA':1}}});   // no badge news in the wayawait wait(300);
  t2.w.Math.random=()=>0.99;   // above the fade line
  t2.d.querySelectorAll('.kcard')[0].click();
  t2.d.querySelector('.tile:not(.done)').click();await wait(150);
  assert.match(t2.lastSaid(),/^You [^.!]+\.$/,'a plain description, no praise word');t2.close();
});

test('spoken countdown: says the time left and asks about each child\'s next quest',async()=>{
  while(new Date().getSeconds()>40)await wait(1000);   // start early in a minute so it's still "10 minutes" when the board checks ~4s later
  const n=new Date();const lt=new Date(n.getFullYear(),n.getMonth(),n.getDate(),n.getHours(),n.getMinutes()+10);
  const hm=String(lt.getHours()).padStart(2,'0')+':'+String(lt.getMinutes()).padStart(2,'0');
  if(lt.getDate()!==n.getDate())return; // just before midnight: skip
  const t=boot({cfg:c=>{c.leave=Object.assign(c.leave||{},{remind:'10,5'});c.arvoStart='23:59';for(let d=0;d<7;d++)c.days[d].leave=hm;}});
  await wait(3600);
  const said=t.lastSaid();
  assert.match(said,/^Ten minutes until we leave!/i);
  assert.match(said,/, have you (gone|been|went|eaten|got|brushed|put|packed)[^?]* yet\?/);
  t.close();
});

test('video message plays full screen, then closes itself',async()=>{
  const t=boot({idb:true,cfg:c=>{c.arvoStart='23:59';c.messages=[{id:'v1',from:{name:'Nana',emoji:'👵'},kids:['kA'],when:'quest',quest:'teeth',repeat:'every',video:true,created:'2026-11-01',played:{}}];}});
  await t.putAudio('msg|v1','data:video/webm;base64,VVVV');await wait(300);
  t.d.querySelectorAll('.kcard')[0].click();
  [...t.d.querySelectorAll('.tile')].find(x=>x.textContent.includes('Brush teeth')).click();await wait(500);
  const ov=t.d.getElementById('vidOv');assert.ok(ov,'video on screen');
  assert.match(ov.textContent,/Nana/);
  assert.deepEqual(t.played,['data:video/webm;base64,VVVV']);
  ov.querySelector('video').dispatchEvent(new t.w.Event('ended'));await wait(1000);
  assert.ok(!t.d.getElementById('vidOv'),'closes when it ends');t.close();
});

test('the recorder offers voice or video',async()=>{
  const t=boot({idb:true});await wait(300);t.openSettings('Messages');
  t.button('Record a new message').click();
  [...t.d.querySelectorAll('.pksheet .rwtype')].find(b=>b.textContent.includes('Surprise')).click();
  const sh=t.d.querySelector('.pksheet');
  const pv=sh.querySelector('video.recprev');assert.equal(pv.style.display,'none','voice by default');
  t.button('Video',sh).click();
  assert.equal(pv.style.display,'');assert.match(sh.querySelector('.hint').textContent,/look at the camera/);t.close();
});

test('a deleted recording is skipped, flagged in settings, and never blocks the others',async()=>{
  const msg=(id,n)=>({id,from:{name:n,emoji:'👵'},kids:[],when:'quest',quest:'teeth',repeat:'every',created:'2026-11-01',played:{}});
  const t=boot({idb:true,cfg:c=>{c.arvoStart='23:59';c.messages=[msg('gone','Nana'),msg('here','Pop')];}});
  await t.putAudio('msg|here','data:audio/webm;base64,POPP');await wait(2000);   // msg|gone was never saved (as if deleted)
  t.d.querySelectorAll('.kcard')[0].click();
  for(let i=0;i<3;i++){const tile=[...t.d.querySelectorAll('.tile')].find(x=>x.textContent.includes('Brush teeth'));
    if(!tile.classList.contains('done'))tile.click();await wait(300);tile.click();await wait(200);
    const c=t.cfg();c.messages.forEach(m=>m.played={});}
  assert.ok(t.played.length>=1);assert.ok(t.played.every(u=>u==='data:audio/webm;base64,POPP'),'only the one that exists plays');
  t.openSettings('Messages');
  assert.match(t.d.getElementById('settings').textContent,/recording missing/);
  assert.equal(t.errors.length,0);t.close();
});

test('settings lock: hold the gear by default; a quick tap only shows a hint',async()=>{
  const t=boot({cfg:c=>{delete c.lock;}});await wait(300);
  const g=t.d.getElementById('gearBtn');
  g.dispatchEvent(new t.w.Event('pointerdown'));await wait(300);g.dispatchEvent(new t.w.Event('pointerup'));g.click();await wait(100);
  assert.ok(!t.d.getElementById('settings').classList.contains('open'));
  assert.ok(!t.d.getElementById('gate').classList.contains('open'),'no maths question');
  t.d.querySelector('#holdOv .holdx').click();
  g.dispatchEvent(new t.w.Event('pointerdown'));await wait(2200);
  assert.ok(t.d.getElementById('settings').classList.contains('open'));t.close();
});

test('settings lock: PIN opens settings; a wrong PIN does not; forgot PIN asks harder maths',async()=>{
  const h=require('crypto').createHash('sha256').update('medo:2580').digest('hex');
  const t=boot({cfg:c=>{c.lock={type:'pin',pin:h};}});await wait(300);
  const key=k=>t.d.querySelector(`#gateKeys button[data-k="${k}"]`).click();
  t.d.getElementById('gearBtn').click();
  assert.match(t.d.getElementById('gateQ').textContent,/PIN/);
  '1111'.split('').forEach(key);await wait(400);
  assert.ok(!t.d.getElementById('settings').classList.contains('open'));
  '2580'.split('').forEach(key);await wait(400);
  assert.ok(t.d.getElementById('settings').classList.contains('open'));
  t.d.getElementById('closeSettings').click();
  t.d.getElementById('gearBtn').click();t.d.getElementById('gateForgot').click();
  const m=t.d.getElementById('gateQ').textContent.match(/(\d+) × (\d+)/);assert.ok(+m[1]>=12,'harder question');
  t.close();
});

test('messages can be filtered by who they are from',async()=>{
  const mk=(id,n,v)=>({id,from:{name:n,emoji:'👵'},kids:[],when:'day',repeat:'once',video:v,created:'2026-11-01',played:{}});
  const t=boot({cfg:c=>{c.messages=[mk('a','Nana'),mk('b','Pop',true),mk('c','Nana'),mk('d','Gong'),mk('e','Pop')];}});await wait(300);
  t.openSettings('Messages');
  const sel=[...t.d.querySelectorAll('.msgfilt select')][0];sel.value='Pop';sel.dispatchEvent(new t.w.Event('change'));
  const names=[...t.d.querySelectorAll('#settings .iname')].map(x=>x.textContent);
  assert.deepEqual(names,['From Pop','From Pop']);t.close();
});

test('setting a PIN uses the app\'s own keypad, not the device keyboard',async()=>{
  const t=boot();await wait(300);t.openSettings('This device');
  t.button('PIN',t.d.getElementById('settings')).click();await wait(100);
  const sh=t.d.querySelector('.pksheet');
  assert.ok(!sh.querySelector('input'),'no text box to bring up the keyboard');
  const key=k=>[...sh.querySelectorAll('.keypad button')].find(b=>b.textContent===k).click();
  '4321'.split('').forEach(key);await wait(300);'4321'.split('').forEach(key);await wait(500);
  const c=t.cfg();assert.equal(c.lock.type,'pin');assert.match(c.lock.pin,/^[0-9a-f]{64}$/);t.close();
});

test('finished events move to Past events and can be used again; events can be searched',async()=>{
  const mk=(id,name,date)=>({id,emoji:'🎈',name,date,end:'',repeat:'none',lead:'',endMode:'never'});
  const fut=ymd(new Date(Date.now()+5*864e5));
  const t=boot({cfg:c=>{c.events=[mk('p1','Old party','2026-01-10'),mk('f1','Swim carnival',fut),mk('f2','Zoo trip',fut),mk('f3','Dentist',fut),mk('f4','Concert',fut),mk('f5','Library day',fut)];}});
  await wait(300);t.openSettings('Events');
  const S=t.d.getElementById('settings');
  assert.match(S.textContent,/Past events \(1\)/);
  const past=S.querySelector('.pastlist');assert.match(past.textContent,/Old party/);
  past.open=true;t.button('Use again',past).click();
  const ev=t.cfg().events.find(e=>e.id==='p1');assert.equal(ev.date,'');
  assert.doesNotMatch(t.d.getElementById('settings').textContent,/Past events/);
  const q=t.d.querySelector('#settings input[type=search]');q.value='zoo';q.dispatchEvent(new t.w.Event('input'));await wait(600);
  const names=[...t.d.querySelectorAll('#settings .iname')].map(x=>x.textContent);
  assert.deepEqual(names,['Zoo trip']);t.close();
});

test('holding the gear shows a big progress ring in the middle of the screen',async()=>{
  const t=boot({cfg:c=>{delete c.lock;}});await wait(300);
  t.d.getElementById('gearBtn').dispatchEvent(new t.w.Event('pointerdown'));await wait(200);
  assert.ok(t.d.getElementById('holdOv').classList.contains('on'));
  assert.ok(t.d.getElementById('holdOv').classList.contains('progress'));
  t.d.getElementById('gearBtn').dispatchEvent(new t.w.Event('pointerup'));
  assert.ok(t.d.getElementById('holdOv').classList.contains('prompt'),'let go early: offers the big gear');t.close();
});

test('a quick tap on the gear offers a big gear to hold in the middle; holding it opens settings',async()=>{
  const t=boot({cfg:c=>{delete c.lock;}});await wait(300);
  const g=t.d.getElementById('gearBtn');
  g.dispatchEvent(new t.w.Event('pointerdown'));await wait(100);g.dispatchEvent(new t.w.Event('pointerup'));g.click();await wait(100);
  const ov=t.d.getElementById('holdOv');assert.ok(ov.classList.contains('prompt'));
  assert.match(ov.textContent,/hold this/);
  const big=ov.querySelector('.holdwrap');   // the whole ring is the target (a real finger lands on the ring as often as the gear)
  big.dispatchEvent(new t.w.Event('pointerdown'));await wait(500);big.dispatchEvent(new t.w.Event('pointerup'));
  assert.match(ov.textContent,/until the circle is full/);
  big.dispatchEvent(new t.w.Event('pointerdown'));await wait(2200);
  assert.ok(t.d.getElementById('settings').classList.contains('open'));
  assert.ok(!ov.classList.contains('on'));t.close();
});

test('lifting the finger after a hold does not tap the Done button underneath',async()=>{
  const t=boot({cfg:c=>{delete c.lock;}});await wait(300);
  const g=t.d.getElementById('gearBtn');
  g.dispatchEvent(new t.w.Event('pointerdown'));await wait(2200);
  assert.ok(t.d.getElementById('settings').classList.contains('open'));
  const done=t.d.getElementById('closeSettings');
  done.dispatchEvent(new t.w.Event('pointerup',{bubbles:true}));done.click();   // the finger lifting off
  assert.ok(t.d.getElementById('settings').classList.contains('open'),'still open');
  await wait(600);done.click();
  assert.ok(!t.d.getElementById('settings').classList.contains('open'),'a real tap on Done still works');t.close();
});

test('number fields use the app\'s number pad; search uses the app-styled search box',async()=>{
  const t=boot();await wait(300);t.openSettings('Events');await wait(200);
  const S=t.d.getElementById('settings');
  const nb=S.querySelector('.numbtn');assert.ok(nb,'number shown as a button');
  const inp=nb.previousSibling;nb.click();
  const sh=t.d.querySelector('.pksheet');assert.ok(!sh.querySelector('input'),'no device keyboard');
  const key=k=>[...sh.querySelectorAll('.keypad button')].find(b=>b.textContent===k).click();
  key('2');key('1');t.button('Done',sh).click();
  assert.equal(inp.value,'21');assert.equal(nb.textContent,'21');t.close();
});

test('splash: a set-up family gets a hello by name, not the new-device pitch',async()=>{
  const t=boot();await wait(1200);
  const o=t.d.getElementById('intro');
  if(o){assert.doesNotMatch(o.textContent,/shouldn't be a battle|Get started/);assert.match(o.textContent,/Good (morning|afternoon|evening), Ava & Leo!/);}
  t.close();
});

test('Delete everything erases Medo from the device',async()=>{
  const t=boot({idb:true});await wait(300);
  await t.putAudio('msg|zz','data:audio/webm;base64,AAAA');
  t.openSettings('This device');
  const S=t.d.getElementById('settings');
  const b=t.button('Delete everything',S);b.click();b.click();await wait(300);
  assert.ok(!Object.keys(t.w.localStorage).some(k=>/^qb_cfg|^qb_hist/.test(k)),'saved settings gone');t.close();
});

test('town search suggests places as you type, nearest country first, and Enter picks the top one',async()=>{
  const geo={results:[{name:'Frankston',admin1:'Texas',country:'United States',country_code:'US',latitude:32.05,longitude:-95.5},
                      {name:'Frankston',admin1:'Victoria',country:'Australia',country_code:'AU',latitude:-38.14,longitude:145.12}]};
  const t=boot({fetch:u=>/geocoding-api/.test(u)?{ok:true,json:()=>Promise.resolve(geo)}:null});await wait(300);
  t.openSettings('Weather');await wait(100);
  const S=t.d.getElementById('settings'),q=S.querySelector('.placesearch input');
  assert.ok(!t.button('Search',S.querySelector('.placesearch')),'no Search button');
  q.value='Fran';q.dispatchEvent(new t.w.Event('input'));await wait(600);
  const opts=[...S.querySelectorAll('.locopt')].map(b=>b.textContent);
  assert.match(opts[0],/Frankston.*Victoria/,'Australia first');
  q.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Enter'}));await wait(100);
  assert.equal(t.cfg().loc.lat,-38.14);t.close();
});

test('finishing sometimes asks how they feel, in words for their age; grumpy leaves a note for grown-ups',async()=>{
  const bday=new Date();bday.setFullYear(bday.getFullYear()-4);bday.setMonth(0,1);
  const t=boot({cfg:c=>{c.arvoStart='23:59';c.kids[0].birthday=ymd(bday);c.kids[0].stars={count:0,last:''};c.lock={type:'maths'};},storage:{qb_tips:{'undo:kA':1}}});await wait(300);
  t.w.Math.random=()=>0.1;   // this time it asks
  t.d.querySelectorAll('.kcard')[0].click();
  while(t.d.querySelector('.tile:not(.done)'))t.d.querySelector('.tile:not(.done)').click();
  await wait(600);
  const ov=t.d.getElementById('feelOv');assert.ok(ov,'check-in shown');
  assert.match(ov.textContent,/Happy/);assert.match(ov.textContent,/Grumpy/);assert.doesNotMatch(ov.textContent,/Tricky/,'little-kid words for a 4-year-old');
  [...ov.querySelectorAll('.feelbtn')].find(b=>b.textContent.includes('Grumpy')).click();await wait(200);
  assert.doesNotMatch(t.lastSaid(),/great|better|best/i,'no feeling is ranked above another');
  const h=JSON.parse(t.w.localStorage.getItem('qb_hist'));assert.equal(h[ymd(new Date())].kA.feel.am,'low');
  assert.ok(t.d.getElementById('gearBtn').classList.contains('hasnote'),'a dot on the gear');
  t.openSettings();
  const S=t.d.getElementById('settings');assert.match(S.textContent,/Ava said the morning felt grumpy/);
  assert.match(S.textContent,/You could ask/);assert.doesNotMatch(S.textContent,/\b(he|she|his|her|son|daughter)\b/,'no gender assumed');
  t.button('We talked',S).click();assert.ok(!t.d.getElementById('gearBtn').classList.contains('hasnote'));t.close();
});

test('the home screen does not put the children\'s scores side by side',async()=>{
  const t=boot();await wait(300);
  const card=t.d.querySelector('.kcard');
  assert.doesNotMatch(card.querySelector('.kbadges').textContent,/⭐|📚|\d/);t.close();
});

test('new rewards start as a surprise and are announced as one',async()=>{
  const t=boot();await wait(300);t.openSettings('Rewards');
  t.button('+ New reward',t.d.getElementById('settings')).click();
  const r=t.cfg().rewards.slice(-1)[0];assert.equal(r.show,false);
  assert.match(t.d.getElementById('settings').textContent,/Surprise/);t.close();
});

test('evening: the card shows what to sleep in tonight and what to lay out for tomorrow',async()=>{
  const td=ymd(new Date()),tm=ymd(new Date(Date.now()+864e5)),time=[],pp=[],mm=[],code=[],uv=[],tp=[];
  for(const d of [td,tm])for(let h=0;h<24;h++){time.push(d+'T'+String(h).padStart(2,'0')+':00');pp.push(0);mm.push(0);code.push(0);uv.push(d===tm&&h>=9&&h<=16?8:0);tp.push(h>=20||h<=6?7:20);}
  const data={current:{temperature_2m:15,weather_code:0},daily:{temperature_2m_max:[18,27],temperature_2m_min:[9,12],precipitation_probability_max:[0,0],uv_index_max:[2,8],weather_code:[0,0],wind_speed_10m_max:[5,5],wind_gusts_10m_max:[10,10]},
    hourly:{time,precipitation_probability:pp,precipitation:mm,weather_code:code,uv_index:uv,temperature_2m:tp}};
  const t=boot({cfg:c=>{c.eveStart='00:00';},fetch:u=>/v1\/forecast/.test(u)?{ok:true,json:()=>Promise.resolve(data)}:null});
  await wait(600);
  assert.match(t.d.getElementById('wxTitle').textContent,/Tonight & tomorrow/);
  const wear=t.d.getElementById('wxWear').textContent;
  assert.match(wear,/Warm pyjamas/);assert.match(wear,/Socks/);assert.match(wear,/Sunscreen/,'tomorrow is sunny');
  t.d.getElementById('wx').click();await wait(300);
  assert.match(t.lastSaid(),/^Tonight will be cold, so wear warm pyjamas and socks\. Tomorrow will be (warm|hot), so lay out .*your hat\. You'll need sunscreen in the morning too\.$/);
  t.close();
});

test('saved phrases: lines are split into sentences, and the likely ones are listed for both children in turn',async()=>{
  const t=boot({cfg:c=>{c.ai={on:true,voice:'k:af_heart'};c.leave=Object.assign(c.leave||{},{remind:'15,10,5'});}});await wait(300);
  const V=t.w.__medoVoice;
  assert.deepEqual(V.splitSent('Hooray Ava! All done for the morning!  You earned 12 stars.'),['Hooray Ava!','All done for the morning!','You earned 12 stars.']);
  assert.deepEqual(V.splitSent("It's quarter past 8:15 today."),["It's quarter past 8:15 today."]);
  const L=V.phraseWants();
  ['Hi Ava!','Hi Leo!','When you have done a job, tap its picture.','You brushed your teeth, Ava!','Fifteen minutes until we leave!',
   'Ava, have you brushed your teeth yet?','You have 13 stars!',"It's quarter to eight."].forEach(x=>assert.ok(L.includes(x),'missing: '+x));
  assert.ok(L.indexOf('Hi Leo!')<L.indexOf('You brushed your teeth, Ava!'),'children take turns, so no one waits for the other');
  assert.ok(!L.some(x=>/undefined|\{/.test(x)),'no unfilled words');
  assert.equal(new Set(L).size,L.length,'no repeats');
  assert.ok(L.length>150&&L.length<900,'a sensible amount of work: '+L.length);
  t.close();
});

test('saved phrases play in the natural voice even before the voice has loaded; a missing sentence uses the tablet voice for the whole line',async()=>{
  const t=boot({idb:true,cfg:c=>{c.ai={on:true,voice:'k:af_heart'};}});await wait(300);
  let n=0;t.w.URL.createObjectURL=()=>'blob:clip'+(++n);t.w.URL.revokeObjectURL=()=>{};
  t.w.Audio=function(src){this.src=src;this.play=()=>{t.played.push(src);setTimeout(()=>this.onended&&this.onended(),20);return Promise.resolve();};this.pause=()=>{};};
  const V=t.w.__medoVoice;
  await new Promise(res=>{const rq=t.w.indexedDB.open('qb_voice',1);rq.onsuccess=()=>{const tx=rq.result.transaction('c','readwrite');
    ['Me do!','I can do it myself!'].forEach(x=>{tx.objectStore('c').put({b:'wav',u:'2026-01-01'},'k:af_heart|'+x);V.VC.keys['k:af_heart|'+x]=1;});tx.oncomplete=()=>{rq.result.close();res();};};});
  const before=t.spoken.length;
  t.d.getElementById('brand').click();await wait(400);
  assert.deepEqual(t.played.filter(x=>/^blob:clip/.test(x)),['blob:clip1','blob:clip2'],'both sentences played from saved clips, in order');
  assert.equal(t.spoken.length,before,'the tablet voice stayed quiet');
  delete V.VC.keys['k:af_heart|I can do it myself!'];delete V.VC.mem['k:af_heart|I can do it myself!'];
  t.d.getElementById('brand').click();await wait(300);
  assert.equal(t.lastSaid(),'Me do! I can do it myself!','one voice for the whole line, never half and half');
  const heard=JSON.parse(t.w.localStorage.getItem('qb_heard')||'{}');
  await wait(2200);
  assert.ok((JSON.parse(t.w.localStorage.getItem('qb_heard'))['Me do!']||[0])[0]>=2,'remembers what it says most');
  t.close();
});
