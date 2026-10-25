'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
process.chdir(path.join(__dirname,'..'));
const {Chess}=require('../vendor/chess.cjs'),originals=require('../src/openings.cjs'),seeds=require('../src/opening-expansion-seeds.cjs');
const dir='data/expanded';fs.mkdirSync(dir,{recursive:true});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const history=pgn=>{const g=new Chess();g.loadPgn(pgn);return g.history();};
const canonical=g=>g.history().map((m,i)=>(i%2===0?Math.floor(i/2+1)+'. ':'')+m).join(' ');
const sourceCommit=JSON.parse(fs.readFileSync(dir+'/upstream-commit.json','utf8')).sha;
const references=[];
for(const letter of 'abcde')for(const row of fs.readFileSync(dir+'/'+letter+'.tsv','utf8').trim().split('\n').slice(1)){
 const [eco,name,pgn]=row.split('\t');references.push({eco,name,pgn,sans:history(pgn)});
}
const known=new Map(references.map(r=>[r.sans.join(' '),r]));
const cachePath=dir+'/analysis-cache.json';let cache={};try{cache=JSON.parse(fs.readFileSync(cachePath,'utf8'));}catch{}
class Engine{
 constructor(){this.proc=null;this.buf='';this.job=null;this.ready=false;}
 start(){return new Promise((resolve,reject)=>{
  this.boot={resolve,reject};this.proc=spawn(process.execPath,['vendor/stockfish/stockfish-19-lite-single.js']);
  this.proc.stdout.on('data',chunk=>{this.buf+=chunk;let n;while((n=this.buf.indexOf('\n'))>=0){const line=this.buf.slice(0,n).trim();this.buf=this.buf.slice(n+1);this.line(line);}});
  this.proc.stderr.on('data',d=>console.error('ENGINE',d.toString().slice(0,300)));
  this.proc.on('exit',code=>{if(code&&this.job)this.job.reject(Error('Engine exited '+code));});
  this.bootTimer=setTimeout(()=>reject(Error('Engine initialization timeout')),20000);this.proc.stdin.write('uci\n');
 });}
 line(s){
  if(s==='uciok')this.proc.stdin.write('setoption name Threads value 1\nsetoption name Hash value 32\nsetoption name MultiPV value 1\nisready\n');
  if(s==='readyok'&&!this.ready){this.ready=true;clearTimeout(this.bootTimer);this.boot.resolve();}
  const j=this.job;if(!j)return;
  if(s.startsWith('info ')&&s.includes(' pv ')&&!/\b(upperbound|lowerbound)\b/.test(s)){
   const depth=Number(s.match(/\bdepth (\d+)/)?.[1]||0);if(depth>=j.depth){j.depth=depth;j.pv=s.split(' pv ')[1].split(/\s+/);const m=s.match(/\bscore (cp|mate) (-?\d+)/);if(m)j.score={type:m[1],value:Number(m[2])};}
  }
  if(s.startsWith('bestmove ')){clearTimeout(j.timer);this.job=null;const best=s.split(' ')[1];j.resolve({depth:j.depth,score:j.score,pv:j.pv[0]===best?j.pv:[best],ms:300,engine:'Stockfish.js 19.0.1 Lite Single'});}
 }
 async analyze(g){
  const key=g.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||'')).join(' ');if(cache[key])return cache[key];
  const r=await new Promise((resolve,reject)=>{const j={resolve,reject,pv:[],depth:0,score:null};j.timer=setTimeout(()=>reject(Error('Search timeout')),15000);this.job=j;this.proc.stdin.write('position startpos'+(key?' moves '+key:'')+'\ngo movetime 300\n');});
  cache[key]=r;return r;
 }
 close(){if(this.proc){this.proc.stdin.write('quit\n');setTimeout(()=>this.proc?.kill(),200).unref();}}
}
(async()=>{
 let planned=0;for(const [id,rows]of Object.entries(seeds))for(const s of rows){try{history(s.moves);planned++;}catch(e){throw Error(id+' / '+s.name+': '+e.message);}}
 console.log('SEEDS_VALID',planned,'REFERENCE_ROWS',references.length);
 const baseline=originals.flatMap(c=>c.lines.map((l,i)=>({id:c.id+'-'+i,course:c.id,moves:l.moves,sans:history(l.moves),name:l.name})));
 fs.writeFileSync(dir+'/legacy-line-map.json',JSON.stringify(baseline,null,2));
 const engine=new Engine();await engine.start();const output={},audit={createdAt:new Date().toISOString(),referenceCommit:sourceCommit,engine:'Stockfish.js 19.0.1 Lite Single',referenceLicense:'CC0',legacyLines:baseline.length,generated:[],duplicates:[]};let done=0;
 try{
  for(const c of originals){
   output[c.id]=[];const seen=new Set(c.lines.map(l=>history(l.moves).join(' ')));
   const tasks=[...c.lines.map((l,i)=>({name:'Продолжение: '+l.name,moves:l.moves,idea:l.idea+' Разбор продолжается дальше прежнего конца линии.',group:'deeper',legacyBase:c.id+'-'+i,notes:l.notes||{}})),...(seeds[c.id]||[])];
   for(const seed of tasks){
    const g=new Chess();g.loadPgn(seed.moves);const seedSans=g.history(),seedPlies=seedSans.length;
    const desired=seed.group==='deeper'?Math.min(36,Math.max(24,seedPlies+8)):Math.min(32,Math.max(20,seedPlies+6)),searches=[];
    while(g.history().length<desired&&!g.isGameOver()){
     const analysis=await engine.analyze(g);let consumed=0;
     for(const uci of analysis.pv){if(g.history().length>=desired||g.isGameOver())break;if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))break;try{g.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});consumed++;}catch{break;}}
     if(!consumed)throw Error('No legal continuation for '+c.id+'/'+seed.name);
     searches.push({depth:analysis.depth,ms:analysis.ms,score:analysis.score,plies:consumed});
    }
    const sans=g.history(),sig=sans.join(' ');if(seen.has(sig)){audit.duplicates.push({course:c.id,name:seed.name});continue;}seen.add(sig);
    let reference=null;for(let i=seedSans.length;i>=2;i--){reference=known.get(seedSans.slice(0,i).join(' '));if(reference)break;}
    const line={id:c.id+'-x-'+hash(sig).slice(0,12),name:seed.name,moves:canonical(g),idea:seed.idea,notes:{...(seed.notes||{})},group:seed.group,edition:'1.4',seedPlies,engineFromPly:seedPlies+1,sourceKind:'editorial-seed-local-engine',sourceName:reference?.name||'Учебная расстановка',sourceEco:reference?.eco||'',sourceUrl:'https://github.com/lichess-org/chess-openings/tree/'+sourceCommit,engine:'Stockfish 19 Lite',analysis:searches,trainSides:seed.trainSides||['w','b']};
    if(seed.legacyBase)line.legacyBase=seed.legacyBase;
    line.notes[seedPlies+1]='Отсюда — учебное продолжение ограниченного расчёта Stockfish, а не единственный правильный вариант. '+(line.notes[seedPlies+1]||'Сравни угрозы, развитие и безопасность королей.');
    if(seed.genericPlan){line.whitePlan='Оцени реальную структуру: сначала угрозы, затем развитие, борьба за центр и безопасность короля. Не повторяй автоматически план исходного дебюта.';line.blackPlan='Развивай фигуры, оспаривай центр и проверяй угрозы. Расстановка соперника уже отличается от основной линии.';line.warning='Это раннее отклонение, а не основная схема выбранного дебюта. Название курса осталось прежним для удобства тренировки.';}
    if(line.trainSides.length===1)line.warning=(line.warning?line.warning+' ':'')+'Ветка тренируется только '+(line.trainSides[0]==='w'?'за белых':'за чёрных')+': не нужно заучивать рискованный ход соперника как собственную рекомендацию.';
    output[c.id].push(line);audit.generated.push({course:c.id,id:line.id,name:line.name,group:line.group,seedPlies,plies:sans.length,side:line.trainSides.join(''),referenceName:line.sourceName});
    if(++done%20===0){console.log('GENERATED',done,c.id,seed.name);fs.writeFileSync(cachePath,JSON.stringify(cache));}
   }
   console.log('COURSE_DONE',c.id,'old',c.lines.length,'new',output[c.id].length);
  }
  fs.writeFileSync(dir+'/repertoire-extra.json',JSON.stringify(output));fs.writeFileSync(cachePath,JSON.stringify(cache));
  audit.total=baseline.length+audit.generated.length;audit.uniqueSequences=new Set([...baseline.map(l=>l.sans.join(' ')),...Object.values(output).flat().map(l=>history(l.moves).join(' '))]).size;
  fs.writeFileSync(dir+'/generation-report.json',JSON.stringify(audit,null,2));
  console.log('EXPANSION_COMPLETE',JSON.stringify({old:baseline.length,new:audit.generated.length,total:audit.total,uniqueSequences:audit.uniqueSequences,courses:Object.fromEntries(originals.map(c=>[c.id,c.lines.length+output[c.id].length]))}));
 }finally{engine.close();fs.writeFileSync(cachePath,JSON.stringify(cache));}
})().catch(e=>{console.error('EXPANSION_FAILED',e.stack);process.exit(1);});
