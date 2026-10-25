// Local Stockfish 19 Lite. Worker and WASM are embedded; no server or network is used.
// One active request; cancelled searches terminate their worker so late output cannot leak.
const LocalEngine=(()=>{
  let worker=null,ready=false,job=null,urls=null,serial=0;
  const abortError=()=>Object.assign(new Error('Расчёт отменён.'),{name:'AbortError'});
  function dropWorker(){if(worker)worker.terminate();worker=null;ready=false;}
  function cancel(){const old=job;job=null;if(old){clearTimeout(old.watchdog);old.reject(abortError());dropWorker();}}
  function fail(error){const old=job;job=null;if(old){clearTimeout(old.watchdog);old.reject(error);}dropWorker();}
  function bytes(id){const raw=atob(document.getElementById(id).textContent.trim());return Uint8Array.from(raw,c=>c.charCodeAt(0));}
  function resources(){if(!urls){
    const b64=document.getElementById('stockfishWasm').textContent.trim();
    const prefix="const EMBEDDED_WASM=Uint8Array.from(atob("+JSON.stringify(b64)+"),c=>c.charCodeAt(0));self.fetch=(url)=>String(url)==='firstmove://stockfish.wasm'?Promise.resolve(new Response(EMBEDDED_WASM,{headers:{'Content-Type':'application/wasm'}})):Promise.reject(new Error('Unexpected engine resource'));\n";
    urls={js:URL.createObjectURL(new Blob([prefix,bytes('stockfishSource')],{type:'text/javascript'})),wasm:'firstmove://stockfish.wasm'};
  }return urls;}
  function boot(){const u=resources(),w=new Worker(u.js+'#'+encodeURIComponent(u.wasm));worker=w;
    w.onerror=e=>{if(worker!==w)return;e.preventDefault();fail(new Error('Локальный движок не запустился: '+(e.message||'ошибка Worker/WASM')));};
    w.onmessage=e=>{if(worker!==w||typeof e.data!=='string')return;for(const line of e.data.split(/\r?\n/))receive(line.trim());};
    w.postMessage('uci');
  }
  function receive(line){
    if(line==='uciok'){worker.postMessage('setoption name Hash value 16');worker.postMessage('setoption name MultiPV value 3');worker.postMessage('isready');return;}
    if(line==='readyok'){ready=true;if(job&&!job.searching)start();return;}
    const j=job;if(!j?.searching)return;
    if(line.startsWith('info ')&&line.includes(' pv ')){
      const depth=Number(line.match(/\bdepth (\d+)/)?.[1]||0),rank=Number(line.match(/\bmultipv (\d+)/)?.[1]||1),s=line.match(/\bscore (cp|mate) (-?\d+)/),pv=line.split(' pv ')[1]?.trim().split(/\s+/)||[];
      if(depth&&pv.length&&s&&!/\b(upperbound|lowerbound)\b/.test(line)){j.rows.set(rank,{depth,rank,score:{type:s[1],value:Number(s[2])},pv});j.onprogress?.({depth});}return;
    }
    if(line.startsWith('bestmove ')){
      const best=line.split(/\s+/)[1];try{
        const clone=new Chess(j.fen),move=parseMove(clone,best);if(!move)throw Error('Движок не вернул законный ход для этой позиции.');
        const rows=[...j.rows.values()].sort((a,b)=>a.rank-b.rank),main=rows.find(r=>r.pv[0]===best);
        const variations=rows.map(r=>{const g=new Chess(j.fen),line=[];for(const uci of r.pv.slice(0,12)){const m=parseMove(g,uci);if(!m)break;line.push(m);}return {...r,moves:line};}).filter(r=>r.moves.length);
        const result={fen:j.fen,bestmove:best,move,score:main?.score||null,depth:main?.depth||0,variations,elapsed:Math.round(performance.now()-j.started),requestedMs:j.ms,engine:'Stockfish 19 Lite'};
        clearTimeout(j.watchdog);job=null;j.resolve(result);
      }catch(err){fail(err);}return;
    }
  }
  function parseMove(g,uci){if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci||''))return null;try{return g.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});}catch{return null;}}
  function start(){if(!job||!ready||job.searching)return;const j=job;j.searching=true;j.started=performance.now();clearTimeout(j.watchdog);j.watchdog=setTimeout(()=>{if(job===j)fail(new Error('Расчёт превысил время ожидания. Повтори попытку.'));},j.ms+7000);
    worker.postMessage(j.position);worker.postMessage('go movetime '+j.ms);
  }
  function analyze({fen,startFen=fen,moves=[],ms=700},onprogress){
    cancel();return new Promise((resolve,reject)=>{try{
      const check=new Chess(startFen);for(const m of moves)if(!parseMove(check,m))throw Error('Некорректная история позиции.');
      if(check.fen()!==fen)throw Error('История ходов не соответствует позиции.');
      if(check.isGameOver())throw Error('В этой позиции партия завершена.');
      const duration=Math.min(3000,Math.max(150,Number(ms)||700));
      job={id:++serial,fen,ms:duration,position:'position fen '+startFen+(moves.length?' moves '+moves.join(' '):''),rows:new Map(),resolve,reject,onprogress,searching:false,watchdog:setTimeout(()=>fail(new Error('Движок не успел загрузиться. Повтори попытку.')),15000)};
      if(!worker)boot();else start();
    }catch(e){fail(e);reject(e);}});
  }
  return {analyze,cancel,parseMove,get active(){return !!job;},get ready(){return ready;},dispose(){cancel();dropWorker();if(urls){URL.revokeObjectURL(urls.js);URL.revokeObjectURL(urls.wasm);urls=null;}}};
})();
