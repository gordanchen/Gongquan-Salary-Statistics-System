(() => {
  let seq = 0;

  function makeCallbackName() {
    seq += 1;
    return `__gq_jsonp_${Date.now().toString(36)}_${seq}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function apiUrl() {
    const url = String(window.GQ_CONFIG?.API_URL || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(url)) {
      throw new Error('API 網址尚未正確設定');
    }
    return url.split('?')[0];
  }

  window.GQ_API = {
    call(action, payload = {}, timeout = 20000) {
      return new Promise((resolve, reject) => {
        let base;
        try {
          base = apiUrl();
        } catch (err) {
          reject(err);
          return;
        }

        const callback = makeCallbackName();
        const script = document.createElement('script');
        let finished = false;

        const cleanup = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          try { delete window[callback]; } catch (_) { window[callback] = undefined; }
          script.remove();
        };

        window[callback] = (response) => {
          if (finished) return;
          cleanup();
          if (response && response.ok) {
            resolve(response.result);
          } else {
            reject(new Error(response?.error || '操作失敗'));
          }
        };

        const params = new URLSearchParams({
          action: String(action || ''),
          payload: JSON.stringify(payload || {}),
          callback,
          _: String(Date.now())
        });

        const url = `${base}?${params.toString()}`;
        if (url.length > 7000) {
          cleanup();
          reject(new Error('這次資料內容較長，請縮短通知文案後再儲存。'));
          return;
        }

        script.async = true;
        script.src = url;
        script.onerror = () => {
          if (finished) return;
          cleanup();
          reject(new Error('API 連線失敗，請確認部署網址與網路狀態'));
        };

        const timer = setTimeout(() => {
          if (finished) return;
          cleanup();
          reject(new Error(`API 等待超過 ${Math.round(timeout / 1000)} 秒，請稍後再試`));
        }, timeout);

        document.head.appendChild(script);
      });
    }
  };
})();
