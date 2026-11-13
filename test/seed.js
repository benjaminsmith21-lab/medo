// builds a believable 30-day history for two kids
module.exports=function(){
  const p=n=>String(n).padStart(2,'0');const ymd=d=>d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
  const td=new Date();const day=n=>{const d=new Date(td.getFullYear(),td.getMonth(),td.getDate()-n);return d;};
  const am=['toilet','dress','breakfast','teeth','hair','shoes'],pm=['reading','dishes','pyjamas'];
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const hist={};
  for(let n=29;n>=1;n--){
    const d=day(n),key=ymd(d);hist[key]={_wx:{uv:Math.floor(rnd()*11),rain:Math.floor(rnd()*100)}};
    [['kA',0.92],['kB',0.75]].forEach(([id,rate])=>{
      const done=[];am.concat(pm).forEach(q=>{if(rnd()<(q==='hair'?rate-0.3:rate))done.push(q);});
      if(id==='kA'&&n<=6&&!done.includes('teeth'))done.push('teeth'); // Ava: teeth 6 days running
      const all=am.concat(pm).every(q=>done.includes(q));
      const rec={am,pm,done,star:all,read:done.includes('reading')};
      if(done.length){rec.t0=400+Math.floor(rnd()*50);if(am.every(q=>done.includes(q)))rec.amAt=rec.t0+8+Math.floor(rnd()*30);}
      hist[key][id]=rec;
    });
  }
  const created=ymd(day(29));
  const cfg={v:8,kids:[{id:'kA',name:'Ava',emoji:'🦊',reads:{count:40,last:'',prev:''},stars:{count:12,last:'',prev:''}},{id:'kB',name:'Leo',emoji:'🐢',reads:{count:10,last:'',prev:''},stars:{count:3,last:'',prev:''}}],
    steps:['toilet','dress','breakfast','teeth','hair','shoes'].map(i=>({id:i,emoji:{toilet:'🚽',dress:'👕',breakfast:'🥣',teeth:'🪥',hair:'🪮',shoes:'👟'}[i],label:{toilet:'Toilet & wash hands',dress:'Get dressed',breakfast:'Eat breakfast',teeth:'Brush teeth',hair:'Brush hair',shoes:'Shoes & hat'}[i]})).concat([{id:'reading',emoji:'📖',label:'Reading',period:'pm'},{id:'dishes',emoji:'🍽️',label:'Put dishes away',period:'pm'},{id:'pyjamas',emoji:'🛌',label:'Get pyjamas ready',period:'pm'}]),
    days:{},voice:true,arvoStart:'23:59',holidays:{on:false,state:'VIC',lead:14},specials:{},events:[],
    rewards:[
      {id:'r1',emoji:'🦷',prize:'Sticker',kids:['kA'],type:'quest',quest:'teeth',n:7,frame:'row',repeat:'every',show:true,created},
      {id:'r2',emoji:'🍕',prize:"Choose what's for dinner",kids:[],type:'allday',n:3,frame:'week',repeat:'every',show:true,created},
      {id:'r3',emoji:'🏞️',prize:'Trip to the park',kids:[],type:'stars',n:10,frame:'since',repeat:'every',show:true,created}]};
  for(let i=0;i<7;i++)cfg.days[i]={leave:'',kids:[am.concat(pm),am.concat(pm)]};
  return {cfg,hist,ymd};
};
