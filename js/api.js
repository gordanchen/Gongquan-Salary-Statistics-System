(() => {
  const pending = new Map();
  const bridge = () => document.getElementById('gasBridge');
  function id(){return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if(!msg || msg.source !== 'gongquan-salary-api' || !msg.requestId) return;
    const task = pending.get(msg.requestId);
    if(!task) return;
    clearTimeout(task.timer); pending.delete(msg.requestId);
    if(msg.payload && msg.payload.ok) task.resolve(msg.payload.result);
    else task.reject(new Error(msg.payload?.error || '操作失敗'));
  });
  window.GQ_API = {
    call(action, payload={}, timeout=20000){
      const url = String(window.GQ_CONFIG?.API_URL || '');
      if(!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) return Promise.reject(new Error('尚未設定 API 網址'));
      return new Promise((resolve,reject)=>{
        const requestId=id();
        const form=document.createElement('form');
        form.method='POST'; form.action=url; form.target='gasBridge'; form.style.display='none';
        const fields={requestId,action,payload:JSON.stringify(payload||{}),origin:location.origin};
        Object.entries(fields).forEach(([k,v])=>{const i=document.createElement('input');i.type='hidden';i.name=k;i.value=v;form.appendChild(i)});
        document.body.appendChild(form);
        const timer=setTimeout(()=>{pending.delete(requestId);form.remove();reject(new Error('連線逾時，請稍後再試'))},timeout);
        pending.set(requestId,{resolve:(v)=>{form.remove();resolve(v)},reject:(e)=>{form.remove();reject(e)},timer});
        form.submit();
      });
    }
  };
})();
