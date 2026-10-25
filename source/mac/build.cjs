const fs=require('fs'),path=require('path');
process.chdir(__dirname);
const {Chess}=require('./vendor/chess.cjs');
const courses=require('./src/openings.cjs');
const academy=require('./src/lessons.cjs');
const eco=[];
for(const x of ['a','b','c','d','e']){const p='data/'+x+'.tsv';if(fs.existsSync(p)){for(const row of fs.readFileSync(p,'utf8').trim().split('\n').slice(1)){const [code,name,pgn]=row.split('\t');if(pgn)eco.push({code,name,pgn});}}}
let plyCount=0;
for(const c of courses){c.lines.forEach((l,i)=>{const game=new Chess();try{game.loadPgn(l.moves);}catch(e){throw new Error(c.id+'/'+l.name+': '+e.message)}l.id=c.id+'-'+i;l.history=game.history({verbose:true}).map(m=>({san:m.san,from:m.from,to:m.to,promotion:m.promotion||'',before:m.before,after:m.after,piece:m.piece,color:m.color,captured:m.captured||''}));l.sans=l.history.map(m=>m.san);l.pgn=game.pgn();plyCount+=l.sans.length;let best=null;for(const e of eco){if(l.moves.replace(/\s/g,'').startsWith(e.pgn.replace(/\s/g,''))&&(!best||e.pgn.length>best.pgn.length))best=e;}l.eco=best?best.code:'';});}
fs.writeFileSync('data/repertoire.json',JSON.stringify(courses));
console.log(JSON.stringify({courses:courses.length,lines:courses.reduce((s,c)=>s+c.lines.length,0),validatedPlies:plyCount,ecoEntries:eco.length}));
if(fs.existsSync('src/shell.html')&&fs.existsSync('src/app.js')&&fs.existsSync('src/style.css')){
 const escScript=s=>s.replace(/<\/script/gi,'<\\/script');
 const vendor='const Chess = (()=>{ const exports={};\n'+fs.readFileSync('vendor/chess.cjs','utf8')+'\nreturn exports.Chess; })();';
 let html=fs.readFileSync('src/shell.html','utf8').replace('/* STYLES */',fs.readFileSync('src/style.css','utf8')+'\n'+fs.readFileSync('src/academy.css','utf8')).replace('/* SCRIPT */',escScript(vendor)+'\nconst COURSES = '+JSON.stringify(courses).replace(/</g,'\\u003c')+';\nconst ACADEMY_DATA = '+JSON.stringify(academy).replace(/</g,'\\u003c')+';\n'+escScript(fs.readFileSync('src/engine.js','utf8'))+'\n'+escScript(fs.readFileSync('src/app.js','utf8'))+'\n'+escScript(fs.readFileSync('src/manual.js','utf8'))+'\n'+escScript(fs.readFileSync('src/academy.js','utf8'))+'\nbegin(db.prefs.course,{first:true});if(location.hash===\"#lessons\")Academy.home();');
 const assets=[['stockfishSource','stockfish-19-lite-single.js'],['stockfishWasm','stockfish-19-lite-single.wasm']].map(([id,f])=>'<script type="application/octet-stream" id="'+id+'">'+fs.readFileSync('vendor/stockfish/'+f).toString('base64')+'</script>').join('');
 html=html.replace('<!-- ENGINE_ASSETS -->',assets);
 html=html.replace('STOCKFISH_GPL_BODY',fs.readFileSync('vendor/stockfish/COPYING','utf8').replaceAll('&','&amp;').replaceAll('<','&lt;'));
 const license=fs.readFileSync('vendor/chess.LICENSE','utf8');
 html=html.replace('LICENSE_TEXT',license.replaceAll('&','&amp;').replaceAll('<','&lt;'));
 fs.writeFileSync('Шахматный тренажёр.html',html);
 console.log('ACADEMY_OK',academy.lessons.length,'lessons',academy.lessons.flatMap(l=>l.exercises).length,'exercises');
 console.log('BUILD_OK',Buffer.byteLength(html),'bytes');
}
