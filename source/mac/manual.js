// Manual-opponent analysis is intentionally separate from graded repertoire practice.
let analysisSerial=0;
const positionSignature=fen=>fen.split(' ').slice(0,4).join(' ');
function manualBookRows(){
  if(!S?.manual)return [];
  const key=positionSignature(S.game.fen()),rows=[];
  const sorted=[S.active,...S.course.lines.filter(l=>l.id!==S.active.id)];
  for(const line of sorted)for(let ply=0;ply<line.history.length;ply++){
    const move=line.history[ply];if(positionSignature(move.before)!==key)continue;
    if(!rows.some(r=>r.move.san===move.san))rows.push({line,ply,move});
  }
  return rows;
}
function engineForPosition(){return S?.engineStatus==='ready'&&S.engineResult?.fen===S.game.fen()?S.engineResult:null;}
function manualTarget(){return engineForPosition()?.move||manualBookRows()[0]?.move||null;}
function invalidateAnalysis(){analysisSerial++;LocalEngine.cancel();if(S){S.engineResult=null;S.engineStatus='idle';S.engineError='';}}
function engineRequestFromGame(game,ms=700){const h=game.history({verbose:true});return {fen:game.fen(),startFen:h[0]?.before||game.fen(),moves:h.map(m=>m.from+m.to+(m.promotion||'')),ms};}
async function analyzeManual({opponent=false,ms=700}={}){
  if(!S?.manual||S.free||S.done||S.game.isGameOver()||S.mode==='exam')return;
  if(S.game.turn()!==S.side&&!opponent)return;
  const owner=S,revision=epoch,fen=S.game.fen();
  invalidateAnalysis();const ticket=analysisSerial;
  S.engineStatus='thinking';S.engineFen=fen;render();
  const current=()=>S===owner&&S.manual&&!S.free&&epoch===revision&&analysisSerial===ticket&&S.game.fen()===fen;
  try{const result=await LocalEngine.analyze(engineRequestFromGame(S.game,ms));
    if(!current())return;
    if(!legalMove(result.move.from,result.move.to,result.move.promotion))throw Error('Ответ движка не соответствует позиции.');
    S.engineResult=result;S.engineStatus='ready';S.engineError='';render();
  }catch(e){if(e.name==='AbortError'||!current())return;S.engineStatus='error';S.engineResult=null;S.engineError=e.message;render();}
}
function updateManual(){
  if(!S.manual||S.free)return;
  S.busy=false;S.done=S.game.isGameOver();
  if(S.done){S.selected=null;S.hint=0;render();return;}
  const rows=manualBookRows();if(rows.length)S.active=rows[0].line;
  render();
  if(!rows.length&&S.game.turn()===S.side&&S.mode!=='exam')void analyzeManual();
}
function manualAttempt(from,to,promotion,source='user'){
  if(S.view!==null||S.free||S.done||S.game.isGameOver())return false;
  const m=legalMove(from,to,promotion);
  if(!m){S.selected=null;S.feedback='Этот ход невозможен по правилам. Выбери доступное поле; под шахом сначала защити короля.';S.feedbackType='bad';render();return false;}
  const own=m.color===S.side;
  invalidateAnalysis();S.game.move({from,to,promotion:promotion||'q'});
  S.selected=null;S.hint=0;S.pending=null;S.feedbackType='';
  S.feedback=(own?'Твой ход: ':'Ход соперника: ')+m.san+'. '+(own?'Теперь сделай любой законный ход за соперника.':'Подсказка учитывает именно этот ответ.');
  S.manualLast={san:m.san,color:m.color,source};updateManual();return true;
}
function undoManual(){
  if(!S.manual||!movesPlayed().length)return;
  invalidateAnalysis();clearTimeout(timer);epoch++;
  const last=S.game.undo();S.done=false;S.view=null;S.selected=null;S.hint=0;S.pending=null;
  S.feedback='Отменён ход '+last.san+'. Можно попробовать другое продолжение.';S.feedbackType='';updateManual();
}
function setOpponentMode(value){
  const manual=value==='manual';if(manual===!!S.manual)return;
  if(!manual&&movesPlayed().length){openModal('Вернуться к учебной линии?','<p>Автоматические ответы работают по дебютной базе. Учебная линия начнётся заново; текущий разбор можно предварительно сохранить в PGN.</p><div class="modal-actions"><button class="secondary" data-action="export-pgn">Сохранить PGN</button><button class="primary" data-action="confirm-auto">Начать учебную линию</button><button class="secondary" data-action="close">Остаться в разборе</button></div>');return;}
  if(!manual){db.prefs.opponent='auto';save();begin(S.course.id,{opponent:'auto',mode:S.mode,side:S.side,variation:S.variation});return;}
  clearTimeout(timer);timer=null;epoch++;invalidateAnalysis();
  S.manual=true;S.free=false;S.done=false;S.busy=false;S.view=null;S.selected=null;S.hint=0;S.reviewKey=null;S.pending=null;
  if(S.mode==='exam')S.mode='learn';
  db.prefs.opponent='manual';db.prefs.mode=S.mode;save();
  S.feedback='Ручной соперник включён. Позиция сохранена. За соперника делай любые законные ходы; подсказки — за твою сторону.';S.feedbackType='';updateManual();
}
function manualOpponentHelp(){
  if(!S.manual||S.done||S.free||S.view!==null||S.game.turn()===S.side)return;
  const m=manualTarget();if(m)manualAttempt(m.from,m.to,m.promotion,'opponent-help');
  else if(S.engineStatus!=='thinking')void analyzeManual({opponent:true});
}
function engineScoreLabel(result){
  if(!result?.score)return 'Оценка пока не определена';
  const {type,value}=result.score;
  if(type==='mate'){const side=result.fen.split(' ')[1],winner=value>0?side:side==='w'?'b':'w';return (winner==='w'?'Белые':'Чёрные')+' могут поставить мат за '+Math.abs(value)+' ход. по расчёту';}
  const white=result.fen.split(' ')[1]==='w'?value:-value;
  return 'За белых: '+(white>=0?'+':'')+(white/100).toFixed(2)+' · оценка приблизительная';
}
function engineMoveText(m){
  if(m.san.includes('#'))return 'Этот ход ставит мат в текущей позиции.';
  if(m.san.startsWith('O-O'))return moveDetail(m)+' Дальнейшее продолжение рассчитано движком.';
  if(m.captured)return 'В предлагаемом продолжении ты берёшь '+(m.captured==='q'?'ферзя':m.captured==='r'?'ладью':m.captured==='b'?'слона':m.captured==='n'?'коня':'пешку')+' на '+m.to+'. Проверь ответ соперника в линии расчёта.';
  if(m.san.includes('+'))return 'Предложенный ход даёт шах. Ниже — один из рассчитанных ответов соперника.';
  return 'Движок сравнил продолжения из текущей позиции. Это рекомендация ограниченного поиска, а не единственный допустимый ход.';
}
function manualInstruction(hint){
  if(S.view!==null)return {title:'Просмотр сыгранной позиции',detail:'«К текущей позиции» продолжает разбор без изменения ходов.',icon:'‹',kind:'neutral'};
  if(S.done)return {title:terminalText(),detail:'Можно отменить последний ход и исследовать другой вариант.',icon:'✓',kind:'guided'};
  if(hint){const m=hint.move;return {title:hint.level>=2?moveInstruction(m):PIECE_NAME[m.piece].charAt(0).toUpperCase()+PIECE_NAME[m.piece].slice(1)+' на '+m.from,detail:hint.level>=2?moveDetail(m):'Фигура подсвечена. Поле назначения попробуй вспомнить сам.',icon:pieceSvg({type:m.piece,color:m.color}),kind:'guided'};}
  if(S.game.turn()!==S.side){const m=manualTarget();return {title:'Сделай ход за соперника',detail:S.engineStatus==='thinking'?'Рассчитывается вариант за соперника. Ты можешь сделать другой ход.':m?'Любой законный ход. Кнопка ниже предложит '+m.san+' — следовать ему не обязательно.':'Ходи '+(S.side==='w'?'чёрными':'белыми')+' как угодно по правилам — даже неожиданно.',icon:'↔',kind:'opponent'};}
  if(S.engineStatus==='thinking')return {title:'Считаю ответ на этот ход…',detail:'Stockfish работает на устройстве. Можно не ждать и сделать свой ход.',icon:'…',kind:'waiting'};
  if(S.engineStatus==='error')return {title:'Подсказка пока недоступна',detail:'Нажми «Повторить расчёт» или продолжай вручную. Старый ход не используется.',icon:'!',kind:'opponent'};
  return {title:'Твой ход — '+(S.side==='w'?'белые':'чёрные'),detail:'Тренировка: выбери продолжение сам или воспользуйся подсказкой.',icon:'?',kind:'neutral'};
}
function renderManualGuide(){
  const m=manualTarget(),rows=manualBookRows(),result=engineForPosition(),own=S.game.turn()===S.side;
  const visible=own&&!S.done&&S.view===null&&(S.mode==='learn'||S.hint>=2);
  let label='СВОБОДНЫЕ ОТВЕТЫ',title='',text='';
  if(S.view!==null){title='Просмотр позиции';text='Подсказки относятся только к текущей позиции. Вернись из истории, чтобы увидеть их.';}
  else if(S.done){title='Партия завершена';text=terminalText();}
  else if(!own){title='Ты управляешь соперником';text='Сделай за него любой законный ход. Можно продолжить по дебюту или специально проверить неожиданный ответ.';}
  else if(S.engineStatus==='thinking'){title='Рассчитываю позицию';text='Продолжение в дебютной базе не требуется: движок ищет ответ на реальную расстановку фигур.';label='ЛОКАЛЬНЫЙ РАСЧЁТ';}
  else if(S.engineStatus==='error'&&!m){title='Расчёт не получен';text=S.engineError+' Старые подсказки скрыты. Можно повторить расчёт или ходить вручную.';label='ДВИЖОК НЕДОСТУПЕН';}
  else if(visible&&m){title=moveInstruction(m);text=result?engineMoveText(m):explain(m,(rows[0]?.ply||0)+1);label=result?'РЕКОМЕНДАЦИЯ STOCKFISH':'ХОД ИЗ РЕПЕРТУАРА';}
  else if(S.hint===1&&m){title=PIECE_NAME[m.piece]+' с '+m.from;text='Фигура подсвечена. Направление появится по следующей подсказке.';label='ПОДСКАЗКА 1 ИЗ 2';}
  else{title='Как ты ответишь?';text='Любой законный ход принимается. Этот разбор не засчитывается как экзамен по дебютному репертуару.';}
  $('coachEyebrow').textContent=label;$('coachTitle').textContent=title;$('coachText').textContent=text;
  const choices=visible?(result?[result.move.san]:rows.map(r=>r.move.san)):[];
  $('expectedMoves').innerHTML=choices.map(san=>'<button class="expected-chip" data-expected="'+esc(san)+'" title="Сыграть предложенный ход">'+esc(san)+'</button>').join('');
  const book=rows.length&&!result;for(const el of [$('yourPlan').parentElement,$('opponentPlan').parentElement,$('courseWarning').closest('.caution')])el.hidden=!book||S.view!==null||!own;
  if(book){$('yourPlan').textContent=S.side==='w'?S.course.whitePlan:S.course.blackPlan;$('opponentPlan').textContent=S.side==='w'?S.course.blackPlan:S.course.whitePlan;$('courseWarning').textContent=S.course.warning;}
  $('engineResult').hidden=!result||!visible;
  if(result&&visible){$('engineResult').innerHTML='<div class="eyebrow">'+esc(engineScoreLabel(result))+'</div><p class="engine-search-meta">Stockfish 19 Lite · глубина '+result.depth+' · '+(result.elapsed/1000).toFixed(1)+' с</p><strong>Возможное продолжение</strong>'+result.variations.filter(v=>v.moves[0]?.san===result.move.san).slice(0,1).map(v=>'<div class="engine-pv"><span>'+v.rank+'</span><p>'+esc(formatEngineLine(v.moves,result.fen))+'</p></div>').join('')+'<small>Это варианты расчёта, не предсказание ходов соперника. Другой твой ход не объявляется ошибкой.</small>';}
}
function formatEngineLine(moves,fen){let n=Number(fen.split(' ')[5]),side=fen.split(' ')[1],out=[];for(const m of moves.slice(0,6)){out.push((side==='w'?n+'. ':out.length===0?n+'… ':'')+m.san);if(side==='b')n++;side=side==='w'?'b':'w';}return out.join(' ');}
function renderManualControls(){
  const manual=!!S.manual&&!S.free;
  document.querySelectorAll('[data-opponent]').forEach(b=>{b.classList.toggle('active',(b.dataset.opponent==='manual')===manual);b.setAttribute('aria-pressed',String((b.dataset.opponent==='manual')===manual));});
  $('manualNote').hidden=!manual;$('manualTools').hidden=!manual;$('engineResult').hidden=!manual||$('engineResult').hidden;
  $('depth').disabled=manual;$('variation').disabled=manual;
  const exam=document.querySelector('[data-mode="exam"]');exam.disabled=manual;exam.title=manual?'Экзамен доступен с автоматическим соперником из репертуара':'';
  if(!manual){$('manualStatus').hidden=true;$('coachFootnote').innerHTML='Тренируем репертуар, а не оценку движка.<br>Ход вне базы не обязательно плохой.';return;}
  $('manualStatus').hidden=false;
  const result=engineForPosition(),rows=manualBookRows(),m=manualTarget(),own=S.game.turn()===S.side;
  $('manualStatus').textContent=S.done?'Разбор завершён':S.engineStatus==='thinking'?'Stockfish: расчёт…':S.engineStatus==='error'?'Движок: повтори расчёт':result?'Подсказка: Stockfish':rows.length?'Подсказка: дебютная база':'Вне дебютной базы';
  $('manualStatus').className='manual-status '+(S.engineStatus==='error'?'error':result?'engine':'');
  $('opponentMeta').textContent='Ходы соперника задаёшь ты';$('yourMeta').textContent='За твою сторону — подсказки; принимаются любые законные ходы';
  $('turnPill').textContent=S.view!==null?'Просмотр':S.done?'Разбор завершён':own?'Твой ход':'Ход за соперника';$('turnPill').className='live-pill'+(!own?' opponent-pill':'');
  $('hintButton').disabled=!myTurn()||!m||S.mode==='exam';$('showButton').disabled=!myTurn()||!m||S.mode==='exam';
  $('sessionScore').textContent='Ручной разбор · без оценки репертуара';$('sessionProgress').textContent=movesPlayed().length+' полуходов';$('progressBar').style.width='0%';
  $('undoManual').disabled=!movesPlayed().length;
  $('opponentHelp').disabled=own||S.done||S.view!==null||S.engineStatus==='thinking';
  $('opponentHelp').textContent=!own&&m?'Сыграть '+m.san+' за соперника':'Подсказать за соперника';
  $('retryEngine').hidden=S.engineStatus!=='error';
  $('coachFootnote').innerHTML='Соперником управляешь ты. Вне базы подсказки рассчитывает локальный Stockfish 19 Lite.<br>Ограниченный поиск, не гарантия единственного лучшего хода.';
  if(S.done){$('completion').hidden=false;$('completion').innerHTML='<div class="eyebrow">СВОБОДНЫЙ РАЗБОР</div><h2>'+esc(terminalText())+'</h2><p>Разбор не изменяет оценку знания дебютов. Можно отменить последний ход или сохранить партию.</p><div class="completion-buttons"><button class="primary" data-action="manual-undo">Отменить последний ход</button><button class="secondary" data-action="export-pgn">Сохранить PGN</button></div>';}
}
Object.assign(actions,{
  'opponent-auto':()=>setOpponentMode('auto'),'opponent-manual':()=>setOpponentMode('manual'),
  'manual-undo':undoManual,'opponent-help':manualOpponentHelp,
  'retry-engine':()=>analyzeManual({opponent:S.game.turn()!==S.side}),
  'confirm-auto':()=>{db.prefs.opponent='auto';save();begin(S.course.id,{opponent:'auto',mode:'learn',side:S.side,variation:S.variation});}
});
Object.assign(window.TRAINER,{setOpponentMode,undoManual,analyzeManual,manualBookRows,manualTarget,LocalEngine});
