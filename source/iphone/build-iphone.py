#!/usr/bin/env python3
"""Build a standalone iPhone PWA from the tested Mac desktop HTML without modifying it."""
from pathlib import Path
import hashlib, json, shutil

base=Path(__file__).parent
src=base/'source'
dist=base/'dist'
icons=dist/'icons'
icons.mkdir(parents=True,exist_ok=True)
mac=base.parent/'Шахматный тренажёр.html'
html=mac.read_text()
assert 'window.TRAINER' in html and 'const LocalEngine=' in html, 'Mac source invalid'
html=html.replace('<meta name="viewport" content="width=device-width,initial-scale=1">',
                  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover>',1)
meta='''<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#121619">
<meta name="application-name" content="Первый ход">
<meta name="apple-mobile-web-app-title" content="Первый ход">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" sizes="180x180" href="./icons/icon-180.png">
<link rel="icon" sizes="192x192" type="image/png" href="./icons/icon-192.png">
'''
html=html.replace('</head>',meta+'<style>'+ (src/'ios.css').read_text()+'</style></head>',1)
tabs='''<nav class="iphone-tabs" aria-label="Разделы приложения">
<button type="button" data-action="trainer" class="active" aria-current="page" aria-label="Дебюты">
<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20h11M6 17c1-2 3-3 5-4l-2-3-3-1 3-5 5-1 4 4c3 4 2 8 1 10H6z"/><path d="M9 7l3-1"/></svg><span>Дебюты</span></button>
<button type="button" data-action="lessons" aria-current="false" aria-label="Уроки">
<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6c-2.5-1.7-5.5-1.9-9-1v14c3.5-.9 6.5-.7 9 1 2.5-1.7 5.5-1.9 9-1V5c-3.5-.9-6.5-.7-9 1z"/><path d="M12 6v14"/></svg><span>Уроки</span></button>
<button type="button" data-action="stats" aria-current="false" aria-label="Мой прогресс">
<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V12h4v8M10 20V4h4v16M16 20v-9h4v9M2 20h20"/></svg><span>Прогресс</span></button></nav>'''
banner='''<div class="iphone-install-banner" id="iphoneInstallBanner" hidden>
  <div class="install-info"><div class="install-title">Первый ход — как приложение</div><div class="install-text">Добавь значок на экран Домой. Дебюты и уроки доступны офлайн.</div></div>
  <button type="button" id="iphoneInstallHow">Как установить</button>
  <button type="button" id="iphoneInstallDismiss" class="dismiss" aria-label="Скрыть предложение">×</button>
</div>
<div class="iphone-install-dialog" id="iphoneInstallDialog" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="iphoneInstallTitle">
  <div class="panel">
    <h2 id="iphoneInstallTitle">Установить на iPhone</h2>
    <p>Это веб-приложение: оно открывается с домашнего экрана без вкладок Safari и не требует App Store.</p>
    <div class="steps">
      <p><strong>1.</strong> Открой ссылку в <strong>Safari</strong> (не во встроенном браузере мессенджера).</p>
      <p><strong>2.</strong> Нажми <strong>«Поделиться»</strong> → <strong>«На экран Домой»</strong>.</p>
      <p><strong>3.</strong> Оставь включённым <strong>«Открыть как веб‑приложение»</strong> и нажми «Добавить».</p>
      <p><strong>4.</strong> Один раз открой приложение при интернете — файлы сохранятся для автономной работы.</p>
    </div>
    <p id="iphonePwaStatus" role="status" style="font-size:11px;color:#c1dc9b">Подготовка автономного режима…</p>
    <p style="font-size:11px">Прогресс Mac не передаётся автоматически. Экспортируй его в Mac-приложении: «Мой прогресс → Экспорт JSON», а на iPhone выбери «Импорт JSON».</p>
    <div class="install-actions"><button id="iphoneInstallCopy" type="button" class="secondary install-back">Копировать ссылку</button><button id="iphoneInstallClose" type="button" class="primary">Понятно</button></div>
  </div>
</div>'''
script=(src/'ios.js').read_text().replace('</script','<\\/script')
html=html.replace('</body>',tabs+banner+'<script>'+script+'</script></body>',1)
assert 'id="academy"' in html and 'id="iphoneInstallDialog"' in html
(dist/'index.html').write_text(html)
manifest={
 'name':'Первый ход — шахматный тренажёр',
 'short_name':'Первый ход',
 'description':'Дебюты, 28 уроков, 56 упражнений, ручной соперник и офлайн-анализ Stockfish.',
 'lang':'ru','start_url':'./index.html','scope':'./','id':'./',
 'display':'standalone','background_color':'#121619','theme_color':'#121619',
 'categories':['education','games'],
 'icons':[
  {'src':'./icons/icon-192.png','sizes':'192x192','type':'image/png','purpose':'any'},
  {'src':'./icons/icon-512.png','sizes':'512x512','type':'image/png','purpose':'any'}
 ]
}
(dist/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
for sz in [180,192,512]:
 shutil.copy2(base/'icons'/('icon-%s.png'%sz),icons/('icon-%s.png'%sz))
sha=hashlib.sha256(html.encode()).hexdigest()[:12]
(dist/'service-worker.js').write_text((src/'service-worker.template.js').read_text().replace('__BUILD_HASH__',sha))
(dist/'.nojekyll').write_text('')
(dist/'README.txt').write_text('Первый ход для iPhone — версия '+sha+'\nОткрой этот HTTPS-сайт в Safari, затем Поделиться → На экран Домой → Открыть как веб-приложение.\nПосле первой полной загрузки все функции доступны без интернета.\nНа телефоне прогресс хранится отдельно; перенос с Mac через Экспорт/Импорт JSON.\n')
print(json.dumps({'built':str(dist),'htmlBytes':len(html.encode()),'cacheVersion':sha,'files':sorted(p.name for p in dist.iterdir())},ensure_ascii=False,indent=2))
