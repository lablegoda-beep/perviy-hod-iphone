'use strict';
// Additional repertoire UI. Historical ids, storage key and user-imported lines are not changed.
const LINE_SETS={all:'Все варианты',new:'Только новые',early:'Ранние отклонения',deeper:'Продолжения знакомых линий',base:'Старая база'};
const GROUP_LABELS={base:'Базовая линия',extended:'Новая развилка',deeper:'Продолжение',early:'Ранний ответ'};
let branchQuery='',branchScope='all';
function lineAvailable(line,side){return !line.trainSides||line.trainSides.includes(side);}
function eligibleLines(course,side){return course.lines.filter(l=>lineAvailable(l,side));}
function lineInSet(line,set){return set==='all'||set==='new'&&!!line.edition||set==='base'&&!line.edition||set===line.group;}
function poolForCourse(course,side,set){const all=eligibleLines(course,side),chosen=all.filter(l=>lineInSet(l,set));return chosen.length?chosen:all;}
function populateExpandedVariation(){
 const available=eligibleLines(S.course,S.side);let html='<option value="mix">Смешивать: '+esc(LINE_SETS[S.lineSet]||LINE_SETS.all)+'</option>';
 for(const group of ['base','extended','deeper','early']){const lines=available.filter(l=>(l.group||'base')===group);if(!lines.length)continue;html+='<optgroup label="'+esc(GROUP_LABELS[group])+' · '+lines.length+'">'+lines.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+'</option>').join('')+'</optgroup>';}
 $('variation').innerHTML=html;$('variation').value=S.variation;
 const total=available.length,fresh=available.filter(l=>l.edition).length;
 $('lineSet').value=S.lineSet||'all';
 $('poolMeta').textContent=total+' веток за '+(S.side==='w'?'белых':'чёрных')+' · '+fresh+' новых. В миксе: '+poolForCourse(S.course,S.side,S.lineSet).length+'.';
 $('practiceNew').disabled=fresh===0||S.manual;
 $('lineSet').disabled=S.manual;
}
function renderExpandedBranches(){
 if(S.mode==='exam'&&!S.done){$('branchDescription').textContent='В экзамене будущие продолжения скрыты до завершения линии.';$('branchList').innerHTML='';$('branchTools').hidden=true;return;}
 $('branchTools').hidden=false;
 const all=eligibleLines(S.course,S.side),query=branchQuery.trim().toLocaleLowerCase('ru-RU');
 const lines=all.filter(l=>lineInSet(l,branchScope)&&(!query||(l.name+' '+l.idea+' '+(l.sourceName||'')).toLocaleLowerCase('ru-RU').includes(query)));
 $('branchDescription').textContent='Показано '+lines.length+' из '+all.length+'. Старые результаты сохранены. Новые ветки и продолжения учитываются отдельно.';
 $('branchList').innerHTML=lines.map(l=>{const r=record(l,S.side),group=GROUP_LABELS[l.group||'base'],n=l.sans.length,done=r.clean||0;return '<article class="branch-item '+(S.active.id===l.id?'current':'')+'"><div class="branch-badges"><span>'+esc(group)+'</span>'+(l.trainSides?.length===1?'<span>Только за '+(l.trainSides[0]==='w'?'белых':'чёрных')+'</span>':'')+(done?'<span class="branch-complete">✓ '+done+' чистых</span>':'')+'</div><h3>'+esc(l.name)+'</h3><p>'+esc(l.idea)+'</p>'+(l.engineFromPly?'<p class="source-caption">После '+l.seedPlies+' полуходов — ограниченный расчёт Stockfish. Это учебная линия, не единственный правильный путь.</p>':'')+'<button data-line="'+esc(l.id)+'">Учить эту ветку →</button><small>'+Math.ceil(n/2)+' ходов · '+n+' полуходов</small></article>';}).join('')||'<div class="empty-state"><strong>Подходящих веток нет</strong><p>Измени поиск или выбери другой набор.</p></div>';
}
function startNewVariations(){
 const pool=eligibleLines(S.course,S.side).filter(l=>l.edition);if(!pool.length)return toast('Для этого собственного дебюта пока нет новых веток.');
 begin(S.course.id,{variation:'mix',lineSet:'new',opponent:'auto',side:S.side,mode:S.mode==='exam'?'train':S.mode,avoid:S.active.id});
 toast('Новые ветки: соперник будет менять ответы.');
}
actions['practice-new']=startNewVariations;
actions['install-app']=()=>{
 if(window.IPHONE_APP?.openInstall){closeModal();window.IPHONE_APP.openInstall();return;}
 openModal('«Первый ход» на устройстве','<p>На Mac приложение уже запускается значком «Первый ход» на рабочем столе.</p><p>На iPhone открой веб-версию в Safari, затем «Поделиться» → «На экран Домой» → «Добавить». Установку на телефоне нужно подтвердить на самом iPhone.</p><p><a href="https://lablegoda-beep.github.io/perviy-hod-iphone/" target="_blank" rel="noopener">Открыть версию для iPhone →</a></p><p>Не удаляй старое приложение для обновления: при подключении к интернету используй «Проверить обновление». Для переноса прогресса между устройствами — экспорт/импорт JSON.</p>');
};
$('lineSet').addEventListener('change',e=>begin(S.course.id,{lineSet:e.target.value,variation:'mix',side:S.side,mode:S.mode,opponent:'auto'}));
$('branchSearch').addEventListener('input',e=>{branchQuery=e.target.value;renderExpandedBranches();});
$('branchScope').addEventListener('change',e=>{branchScope=e.target.value;renderExpandedBranches();});
const priorStats=actions.stats;
actions.stats=()=>{priorStats();const panel=document.createElement('section');panel.className='repertoire-release';panel.innerHTML='<h3>Расширенный репертуар · '+esc(REPERTOIRE_INFO.version)+'</h3><p>'+REPERTOIRE_INFO.total+' веток в 18 курсах · '+REPERTOIRE_INFO.added+' новых. Старые '+REPERTOIRE_INFO.legacy+' линий и их результаты сохранены. Уроки работают как прежде.</p><div class="modal-actions"><button class="secondary" data-action="install-app">Установка на устройство</button>'+(window.IPHONE_APP?'<button class="secondary" data-action="check-app-update">Проверить обновление</button>':'')+'</div><p class="small muted">Короткая подсказка движка не доказывает, что это единственный или безошибочный вариант. Произвольные ответы разбираются в режиме «Соперник → Вручную».</p>';$('modalBody').append(panel);};
actions['check-app-update']=()=>window.IPHONE_APP?.checkUpdate?.();
window.TRAINER.repertoireInfo=REPERTOIRE_INFO;
window.TRAINER.eligibleLines=eligibleLines;
window.TRAINER.poolForCourse=poolForCourse;

function syncRepertoireControls(){
 if(!S)return;const available=eligibleLines(S.course,S.side),fresh=available.filter(l=>l.edition).length;
 $('lineSet').value=S.lineSet||'all';$('lineSet').disabled=!!S.manual;for(const option of $('lineSet').options)option.disabled=!available.some(l=>lineInSet(l,option.value));
 $('practiceNew').disabled=!fresh||!!S.manual;
 $('poolMeta').textContent='База '+REPERTOIRE_INFO.version+' · '+available.length+' веток за '+(S.side==='w'?'белых':'чёрных')+' · '+fresh+' новых. '+(S.variation==='mix'?'В миксе: '+S.pool.length+'.':'Выбрана одна линия.');
}

actions['apply-app-update']=()=>window.IPHONE_APP?.applyUpdate?.();
