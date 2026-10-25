(() => {
  "use strict";
  // Presentation and installation only. The chess logic and local progress remain unchanged.
  const $ = selector => document.querySelector(selector);
  const tabs = [...document.querySelectorAll(".iphone-tabs button")];
  const mobile = () => matchMedia("(max-width: 920px)").matches;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
  const banner = $("#iphoneInstallBanner");
  const dialog = $("#iphoneInstallDialog");

  function syncNavigation(){
    const onAcademy = !$("#academy").hidden;
    const inProgress = !$("#modal").hidden && $("#modalTitle")?.textContent === "Мой прогресс";
    const current = inProgress ? "stats" : (onAcademy ? "lessons" : "trainer");
    for(const button of tabs){
      const active = button.dataset.action === current;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    }
    const libraryButton = $(".mobile-library");
    if(libraryButton){
      libraryButton.setAttribute("aria-label",onAcademy?"Вернуться к списку уроков":"Выбрать дебют");
    }
  }

  function closeInstall(){
    dialog?.classList.remove("open");
    dialog?.setAttribute("aria-hidden","true");
    document.body.style.removeProperty("overflow");
  }
  function openInstall(){
    if(!dialog) return;
    banner.hidden = true;
    dialog.classList.add("open");
    dialog.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
    $("#iphoneInstallClose")?.focus();
  }
  $("#iphoneInstallHow")?.addEventListener("click",openInstall);
  $("#iphoneInstallDismiss")?.addEventListener("click",()=>{
    banner.hidden = true;
    try{sessionStorage.setItem("firstmove.ios.install.dismissed","1");}catch{}
  });
  $("#iphoneInstallClose")?.addEventListener("click",closeInstall);
  $("#iphoneInstallDialog")?.addEventListener("click",e=>{if(e.target === dialog)closeInstall();});
  document.addEventListener("keydown",e=>{if(e.key === "Escape" && dialog?.classList.contains("open"))closeInstall();});

  async function copyLink(){
    const link=location.origin + location.pathname;
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(link);
        $("#iphoneInstallCopy").textContent="Ссылка скопирована";
        return;
      }
    } catch{}
    window.prompt("Скопируй ссылку:",link);
  }
  $("#iphoneInstallCopy")?.addEventListener("click",copyLink);

  function updateInstallStatus(text, ready=false){
    const label=$("#iphonePwaStatus");
    if(label){label.textContent=text;label.dataset.ready=String(ready);}
  }
  async function registerOffline(){
    if(!("serviceWorker" in navigator) || !window.isSecureContext){
      updateInstallStatus("Офлайн-доступ доступен после открытия по HTTPS.");
      return;
    }
    try {
      const registration=await navigator.serviceWorker.register("./service-worker.js",{scope:"./",updateViaCache:"none"});
      await navigator.serviceWorker.ready;
      updateInstallStatus("Офлайн-копия установлена",true);
      if(registration.waiting && navigator.serviceWorker.controller){
        updateInstallStatus("Доступно обновление приложения",true);
      }
    }catch(e){
      updateInstallStatus("Не удалось сохранить офлайн-копию. Проверь интернет.");
      console.warn("Первый ход: не удалось подготовить offline cache",e);
    }
  }

  const academy = $("#academy"), modal = $("#modal");
  new MutationObserver(syncNavigation).observe(academy,{attributes:true,attributeFilter:["hidden"]});
  new MutationObserver(syncNavigation).observe(modal,{attributes:true,attributeFilter:["hidden"]});
  $(".top-nav") && new MutationObserver(syncNavigation).observe($(".top-nav"),{attributes:true,subtree:true,attributeFilter:["class"]});
  document.addEventListener("click",e=>{
    const btn=e.target.closest("button[data-action]");
    if(!btn)return;
    if(["trainer","lessons","stats"].includes(btn.dataset.action))requestAnimationFrame(syncNavigation);
  });
  addEventListener("resize",syncNavigation);

  // Make installation discoverable only on an actual iPhone/iPad browser, not on desktop.
  if(isIOS() && mobile() && !standalone()){
    let dismissed = false;
    try{dismissed = sessionStorage.getItem("firstmove.ios.install.dismissed")==="1";}catch{}
    banner.hidden = dismissed;
  }
  else banner.hidden=true;
  syncNavigation();
  if(location.protocol==="https:" || location.hostname==="localhost" || location.hostname==="127.0.0.1") {
    void registerOffline();
  }else updateInstallStatus("Открой по HTTPS для автономного режима.");

  let availableUpdate=null;
  async function checkUpdate(){
    try{
      const url=new URL('./version.json',location.href);url.searchParams.set('check',String(Date.now()));
      const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);
      const info=await response.json();if(typeof info.build!=='string'||typeof info.version!=='string')throw new Error('Invalid release metadata');
      const current=document.querySelector('meta[name="firstmove-build"]')?.content;
      if(current===info.build){toast('Установлена актуальная база '+info.version+'.');return;}
      availableUpdate=info;
      openModal('Доступно обновление '+info.version,'<p>Новая база: '+Number(info.lines||0)+' веток. Сохранённый прогресс и собственные линии останутся на устройстве. Текущая незавершённая позиция начнётся заново.</p><div class="modal-actions"><button class="primary" data-action="apply-app-update">Обновить приложение</button><button class="secondary" data-action="close">Позже</button></div>');
    }catch(e){toast('Не удалось проверить обновление. Подключись к интернету; текущая версия и прогресс сохранены.');}
  }
  async function applyUpdate(){
    try{const r=await navigator.serviceWorker?.getRegistration();if(r){await r.update();r.waiting?.postMessage({type:'SKIP_WAITING'});}}catch{}
    const url=new URL(location.href);url.searchParams.set('v',availableUpdate?.build||String(Date.now()));location.replace(url.href);
  }
  window.IPHONE_APP={syncNavigation,standalone,openInstall,checkUpdate,applyUpdate,get offlineStatus(){return $("#iphonePwaStatus")?.textContent;}};
})();
