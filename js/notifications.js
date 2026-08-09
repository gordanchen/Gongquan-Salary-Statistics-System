(() => {
  const $ = id => document.getElementById(id);
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const DAYS = [['1','一'],['2','二'],['3','三'],['4','四'],['5','五'],['6','六'],['0','日']];
  let ready = false, os = null, cfg = null, stateGetter = null;

  function basePath(){
    const p = location.pathname;
    return p.endsWith('/') ? p : p.slice(0, p.lastIndexOf('/') + 1);
  }

  function api(action,payload={}){
    return GQ_API.call(action,payload,20000);
  }

async function loadSDK(){
  const appId = String(
    window.GQ_CONFIG?.ONESIGNAL_APP_ID || ''
  );

  if(!appId || appId.includes('PASTE_YOUR')){
    return false;
  }

  window.OneSignalDeferred =
    window.OneSignalDeferred || [];

  // SDK 還沒載入才新增 script
  if(!document.querySelector(
    'script[data-gq-onesignal]'
  )){
    const s = document.createElement('script');

    s.src =
      'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

    s.defer = true;
    s.dataset.gqOnesignal = '1';

    document.head.appendChild(s);
  }

  // 已經成功初始化過
  if(ready && os){
    return true;
  }

  return new Promise(resolve => {
    let finished = false;

    const finish = value => {
      if(finished) return;
      finished = true;
      resolve(value);
    };

    window.OneSignalDeferred.push(
      async function(OneSignal){

        try{

          await OneSignal.init({
            appId:
              window.GQ_CONFIG.ONESIGNAL_APP_ID,

            safari_web_id:
              'web.onesignal.auto.1b5ff574-1f63-4acf-ab26-dadb313db610',

            notifyButton: {
              enable: false
            },

            serviceWorkerPath:
              'onesignal/OneSignalSDKWorker.js',

            serviceWorkerParam: {
              scope:
                '/Gongquan-Salary-Statistics-System/onesignal/'
            }
          });

          // 先標記成功
          os = OneSignal;
          ready = true;

          console.log(
            'OneSignal 初始化完成'
          );

          console.log(
            'Permission:',
            OneSignal.Notifications.permission
          );

          console.log(
            'Push supported:',
            OneSignal.Notifications.isPushSupported()
          );

          console.log(
            'Opted in:',
            OneSignal.User
              ?.PushSubscription
              ?.optedIn
          );

          console.log(
            'Subscription ID:',
            OneSignal.User
              ?.PushSubscription
              ?.id
          );

          OneSignal.User.PushSubscription
            .addEventListener(
              'change',
              async event => {

                console.log(
                  'Push subscription changed:',
                  event
                );

                const sid =
                  event?.current?.id || '';

                if(
                  sid &&
                  event?.current?.optedIn
                ){
                  try{
                    await api(
                      'registerPushDevice',
                      {
                        subscriptionId: sid,
                        label: deviceLabel()
                      }
                    );
                  }catch(e){
                    console.warn(
                      'registerPushDevice failed',
                      e
                    );
                  }
                }

                renderStatus();
              }
            );

          finish(true);

        }catch(e){

          console.error(
            'OneSignal 初始化失敗：',
            e
          );

          // 讓下一次可以重新嘗試
          ready = false;
          os = null;

          const oldScript =
            document.querySelector(
              'script[data-gq-onesignal]'
            );

          if(oldScript){
            oldScript.remove();
          }

          finish(false);
        }
      }
    );

    setTimeout(()=>{
      finish(ready && !!os);
    },10000);
  });
}

  function deviceLabel(){
    if(isIOS()) return 'iPhone / iPad';
    if(/Android/i.test(navigator.userAgent)) return 'Android';
    return 'Web';
  }

  async function init(getState){
    stateGetter=getState;
    loadSDK().then(()=>renderStatus());
    try{cfg=await api('getNotificationConfig');renderStatus()}catch(e){console.warn(e)}
  }

  async function getPermissionState(){
    if(!ready || !os) return {supported:false,permission:false,optedIn:false,subscriptionId:''};
    const supported=!!os.Notifications.isPushSupported();
    return {supported,permission:!!os.Notifications.permission,optedIn:!!os.User.PushSubscription.optedIn,subscriptionId:os.User.PushSubscription.id||''};
  }

  async function renderStatus(){
    const badge=$('notifyStatus'); if(!badge) return;
    const appId=String(window.GQ_CONFIG?.ONESIGNAL_APP_ID || '');
    if(!appId || appId.includes('PASTE_YOUR')){
      badge.textContent='尚未完成通知設定'; badge.className='notify-badge off';
      if($('notifySummary')) $('notifySummary').textContent='完成一次通知服務設定後，即可在 iPhone 主畫面 App 接收工作提醒。';
      return;
    }
    const p=await getPermissionState();
    if(p.permission && p.optedIn){badge.textContent='通知已開啟';badge.className='notify-badge on'}
    else if(p.supported){badge.textContent='通知尚未開啟';badge.className='notify-badge pending'}
    else{badge.textContent='此裝置暫不支援';badge.className='notify-badge off'}
    if($('notifySummary') && cfg){
      const count=(cfg.rules||[]).filter(r=>r.enabled).length;
      $('notifySummary').textContent=`${count} 組提醒規則・通知內容與時間可在 App 或資料表調整`;
    }
  }

  async function enable(){
    const ok=await loadSDK();
    if(!ok) return showNotice('通知服務尚未完成設定','請先完成通知服務 App ID 設定，再回來開啟通知。');
    if(isIOS() && !isStandalone()){
      return showNotice('請先加入主畫面','iPhone 需先把「恭權薪資統計系統」加入主畫面，再從主畫面開啟 App 後才能授權通知。');
    }
    if(!os.Notifications.isPushSupported()) return showNotice('此裝置暫不支援通知','請改用支援 Web Push 的瀏覽器或裝置。');
    try{
      await os.Notifications.requestPermission();
      if(!os.Notifications.permission) return showNotice('通知尚未開啟','你目前沒有允許通知。之後可到系統設定或 App 的通知中心重新開啟。');
      await os.User.PushSubscription.optIn();
      
      const sid = await waitForSubscriptionId(15000);

if(!sid){
  throw new Error(
    '通知權限已開啟，但通知裝置仍在建立中，請稍後再試。'
  );
}
      
      await api('registerPushDevice',{subscriptionId:sid,label:deviceLabel()});
      const welcomeKey='gq_notify_welcome_v1';
      if(!localStorage.getItem(welcomeKey)){
        try{
          await api('sendWelcomeNotification',{subscriptionId:sid,delaySeconds:10});
          localStorage.setItem(welcomeKey,'1');
          window.toast?.('通知已開啟，10 秒後會收到確認通知');
        }catch(e){
          // 後端尚未設定推播金鑰時，退回前景本機測試；真正背景通知仍需完成後端設定。
          setTimeout(async()=>{
            try{
              const reg=await navigator.serviceWorker.ready;
              await reg.showNotification('恭權薪資通知已開啟 🎉',{body:'工作提醒已啟用，之後會在重要時間陪你一起掌握工作節奏。',icon:'./icons/icon-192.png',badge:'./icons/icon-192.png'});
            }catch(_){}
          },10000);
          localStorage.setItem(welcomeKey,'1');
        }
      }
      await refreshConfig();
      renderStatus();
      openCenter();
    }catch(e){showNotice('通知設定未完成',e.message||String(e))}
  }

  async function disable(){
    if(!ready||!os) return;
    try{await os.User.PushSubscription.optOut();renderStatus();openCenter()}catch(e){showNotice('無法關閉通知',e.message||String(e))}
  }

  async function waitForSubscriptionId(timeoutMs = 15000){
  if(!ready || !os) return '';

  const currentId = os.User?.PushSubscription?.id || '';
  if(currentId) return currentId;

  return new Promise(resolve => {
    let finished = false;

    const finish = (id='') => {
      if(finished) return;
      finished = true;

      clearTimeout(timer);

      try{
        os.User.PushSubscription.removeEventListener('change', handler);
      }catch(_){}

      resolve(id || '');
    };

    const handler = event => {
      const id =
        event?.current?.id ||
        os.User?.PushSubscription?.id ||
        '';

      if(id) finish(id);
    };

    try{
      os.User.PushSubscription.addEventListener('change', handler);
    }catch(_){}

    const timer = setTimeout(() => {
      finish(os.User?.PushSubscription?.id || '');
    }, timeoutMs);
  });
}

async function test(){
  const ok = await loadSDK();

  if(!ok){
    return showNotice(
      '通知服務尚未完成',
      '通知服務目前無法初始化，請稍後再試。'
    );
  }

  if(isIOS() && !isStandalone()){
    return showNotice(
      '請從主畫面開啟',
      'iPhone 請先將恭權薪資加入主畫面，再從主畫面的 App 開啟。'
    );
  }

  try{
    if(!os.Notifications.permission){
      await os.Notifications.requestPermission();
    }

    if(!os.Notifications.permission){
      return showNotice(
        '通知權限尚未開啟',
        '請先允許恭權薪資傳送通知。'
      );
    }

    if(!os.User.PushSubscription.optedIn){
      await os.User.PushSubscription.optIn();
    }

    window.showBusy?.(
      '正在準備測試通知…',
      '正在確認這台裝置的通知連線'
    );

    const sid = await waitForSubscriptionId(15000);

    if(!sid){
      window.hideBusy?.();

      return showNotice(
        '通知裝置尚未完成註冊',
        '系統通知權限已開啟，但推播裝置仍在建立中。請關閉此視窗後約 10 秒再試一次。'
      );
    }

    await api('registerPushDevice',{
      subscriptionId:sid,
      label:deviceLabel()
    });

    await api('sendTestNotification',{
      subscriptionId:sid
    });

    window.hideBusy?.();
    window.toast?.('測試通知已送出');

    renderStatus();

  }catch(e){
    window.hideBusy?.();

    showNotice(
      '測試通知失敗',
      e.message || String(e)
    );
  }
}

  async function refreshConfig(){cfg=await api('getNotificationConfig');return cfg}

  function ruleTimeText(r){
    if(r.mode==='dynamic') return r.type==='breakSoon'?'休息結束前提醒':'依休息結束時間提醒';
    if(r.mode==='random') return `${r.startTime}–${r.endTime} 隨機`;
    return r.startTime||'--:--';
  }
  function dayText(r){if(r.mode==='dynamic')return'每次休息';const set=new Set(String(r.days||'').split(','));return DAYS.filter(([d])=>set.has(d)).map(x=>x[1]).join('、')||'未設定'}

  async function openCenter(){
    try{if(!cfg)await refreshConfig()}catch(e){}
    const p=await getPermissionState();
    const rules=cfg?.rules||[];
    window.showModal('通知與提醒',`<div class="notify-center">
      <div class="notify-permission-card">
        <div><b>${p.permission&&p.optedIn?'通知已開啟':'開啟工作提醒'}</b><small>${p.permission&&p.optedIn?'重要工作時間會依設定推播提醒':'只會在你按下開啟後詢問一次系統授權，不會每次進 App 都詢問。'}</small></div>
        <button id="notifyToggle" class="${p.permission&&p.optedIn?'pill-btn':'primary'}">${p.permission&&p.optedIn?'關閉通知':'開啟通知'}</button>
      </div>
      ${p.permission&&p.optedIn?'<button id="notifyTest" class="pill-btn wide">傳送測試通知</button>':''}
      <div class="notify-rule-list">${rules.map(r=>`<button class="notify-rule" data-rule="${esc(r.id)}"><span class="notify-rule-icon">${r.icon||'🔔'}</span><span><b>${esc(r.name)}</b><small>${dayText(r)}・${ruleTimeText(r)}</small></span><i class="${r.enabled?'on':'off'}">${r.enabled?'開啟':'關閉'}</i></button>`).join('')}</div>
      <div class="notice">提醒文案會從每組 4～6 句中隨機選擇；隨機時段也會每天重新抽選。休息提醒則依你實際設定的休息時間自動計算。</div>
    </div>`);
    $('notifyToggle').onclick=()=>p.permission&&p.optedIn?disable():enable();
    if($('notifyTest'))$('notifyTest').onclick=test;
    document.querySelectorAll('[data-rule]').forEach(b=>b.onclick=()=>editRule(b.dataset.rule));
  }

  function editRule(id){
    const r=(cfg?.rules||[]).find(x=>x.id===id);if(!r)return;
    const dynamic=r.mode==='dynamic';
    const messages=(r.messages||[]).join('\n');
    const daySet=new Set(String(r.days||'').split(','));
    window.showModal('編輯提醒',`<div class="modal-form">
      <label class="switch-line"><span><b>${esc(r.name)}</b><small>啟用此提醒</small></span><input id="nrEnabled" type="checkbox" ${r.enabled?'checked':''}></label>
      ${dynamic?`<div class="notice">${r.type==='breakSoon'?'此提醒會在休息結束前 '+Math.abs(Number(r.offsetMinutes||-5))+' 分鐘發送。':'此提醒會在休息結束時發送。'}</div>`:`
      <div class="form-field"><span>提醒星期</span><div class="day-picks">${DAYS.map(([d,n])=>`<label><input type="checkbox" name="nrDay" value="${d}" ${daySet.has(d)?'checked':''}><span>${n}</span></label>`).join('')}</div></div>
      <label class="form-field">時間方式<select id="nrMode"><option value="fixed" ${r.mode==='fixed'?'selected':''}>固定時間</option><option value="random" ${r.mode==='random'?'selected':''}>隨機時間區間</option></select></label>
      <div class="two"><label class="form-field">開始時間<input id="nrStart" type="time" value="${esc(r.startTime||'')}"></label><label class="form-field">結束時間<input id="nrEnd" type="time" value="${esc(r.endTime||r.startTime||'')}"></label></div>`}
      <label class="form-field">隨機通知內容（每行一則）<textarea id="nrMessages" rows="8">${esc(messages)}</textarea></label>
      <button id="saveNotifyRule" class="primary wide">儲存提醒</button>
    </div>`);
    $('saveNotifyRule').onclick=async()=>{
      const payload={id:r.id,enabled:$('nrEnabled').checked,messages:$('nrMessages').value.split('\n').map(x=>x.trim()).filter(Boolean)};
      if(!dynamic){payload.days=[...document.querySelectorAll('input[name="nrDay"]:checked')].map(x=>x.value).join(',');payload.mode=$('nrMode').value;payload.startTime=$('nrStart').value;payload.endTime=$('nrEnd').value}
      try{
        window.showBusy?.('正在儲存提醒…','更新通知時間與文案');
        cfg=await api('saveNotificationRule',payload);
        window.hideBusy?.();window.toast?.('提醒已更新');openCenter();renderStatus();
      }catch(e){window.hideBusy?.();showNotice('儲存失敗',e.message||String(e))}
    };
  }

  function showNotice(title,text){window.showModal(title,`<div class="notice">${esc(text)}</div><button class="primary wide" onclick="closeModal()">知道了</button>`)}

  window.GQ_NOTIFICATIONS={init,openCenter,enable,test,renderStatus};
})();
