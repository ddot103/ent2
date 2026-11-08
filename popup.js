(() => {
  if (window.__ent2ExtPopupInitialized) return;
  window.__ent2ExtPopupInitialized = true;

  const ENT2_URL = 'https://playentry.org/ent2';
  const HOME_URL = 'https://playentry.org';
  const FORCE_RELOAD_KEY = 'ent2_user_index_force_refresh_ts';
  const THEME_KEY = 'ent2_theme_mode';
  const LEGACY_THEME_KEY = 'ent2_popup_theme';

  const getStorage = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return null;
  };

  const readSettings = () => {
    const storage = getStorage();
    const fallback = { ent2_enabled: true, ent2_mobile_enabled: true, ent2_user_cache_daily: true, ent2OnlyMode: true };

    if (!storage) {
      const raw = localStorage.getItem('ent2-ext-settings');
      return raw ? Object.assign(fallback, JSON.parse(raw)) : fallback;
    }

    return new Promise((resolve) => {
      storage.get(fallback, (res) => resolve(Object.assign(fallback, res)));
    });
  };

  const writeSettings = (updates) => {
    const storage = getStorage();
    const next = Object.assign({}, updates);

    try {
      localStorage.setItem('ent2-ext-settings', JSON.stringify(next));
      if (Object.prototype.hasOwnProperty.call(next, 'ent2_user_cache_daily')) {
        localStorage.setItem('ent2_user_cache_daily', String(next.ent2_user_cache_daily !== false));
      }
    } catch (_) {}

    if (!storage) {
      return Promise.resolve(next);
    }

    return new Promise((resolve) => {
      storage.set(next, () => resolve(next));
    });
  };

  const setToggle = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!value;
  };

  const applyPopupTheme = (theme) => {
    const selected = theme === 'light' || theme === 'light-mode' ? 'light' : 'ash';
    document.body.dataset.theme = selected;
    const label = document.getElementById('popup-theme-label');
    const button = document.getElementById('popup-theme-toggle');
    if (label) label.textContent = selected === 'ash' ? '화이트' : '애시';
    if (button) {
      button.setAttribute('aria-label', `${selected === 'ash' ? '화이트' : '애시'} 테마로 변경`);
      button.title = `${selected === 'ash' ? '화이트' : '애시'} 테마로 변경`;
    }
  };

  const readPopupTheme = () => {
    const storage = getStorage();
    if (!storage) {
      return Promise.resolve(localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY) || 'ash');
    }
    return new Promise((resolve) => {
      storage.get([THEME_KEY, LEGACY_THEME_KEY], (res) => {
        resolve(res[THEME_KEY] || res[LEGACY_THEME_KEY] || 'ash');
      });
    });
  };

  const savePopupTheme = (theme) => {
    const storage = getStorage();
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {}
    if (!storage) return;
    storage.set({ [THEME_KEY]: theme }, () => {});
  };

  const openTab = (url) => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
      return;
    }
    window.open(url, '_blank');
  };

  const bindToggle = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('change', async () => {
      const settings = await readSettings();
      settings[key] = !!el.checked;
      await writeSettings(settings);
    });
  };

  const setReloadMark = async () => {
    const stamp = Date.now();
    const storage = getStorage();

    if (storage) {
      storage.set({ [FORCE_RELOAD_KEY]: stamp }, () => {});
    } else {
      localStorage.setItem(FORCE_RELOAD_KEY, String(stamp));
    }

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ url: 'https://playentry.org/ent2*' }, (tabs) => {
        tabs.forEach((tab) => {
          if (tab && typeof tab.id === 'number') {
            chrome.tabs.reload(tab.id);
          }
        });
      });
    }
  };

  const openBtn = document.getElementById('btn-ent2-open');
  const mainBtn = document.getElementById('btn-ent2-main');
  const homeBtn = document.getElementById('btn-ent2-home');
  const reloadBtn = document.getElementById('btn-reload-index');
  const themeBtn = document.getElementById('popup-theme-toggle');

  if (openBtn) openBtn.addEventListener('click', () => openTab(ENT2_URL));
  if (mainBtn) mainBtn.addEventListener('click', () => openTab(ENT2_URL));
  if (homeBtn) homeBtn.addEventListener('click', () => openTab(HOME_URL));
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const nextTheme = document.body.dataset.theme === 'ash' ? 'light' : 'ash';
    applyPopupTheme(nextTheme);
    savePopupTheme(nextTheme);
  });
  if (reloadBtn) reloadBtn.addEventListener('click', async () => {
    await setReloadMark();
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: ENT2_URL });
    }
  });

  bindToggle('toggle-ent2-enabled', 'ent2_enabled');
  bindToggle('toggle-ent2-mobile', 'ent2_mobile_enabled');
  bindToggle('toggle-ent2-user-cache', 'ent2_user_cache_daily');

  readPopupTheme().then(applyPopupTheme);

  (async () => {
    const settings = await readSettings();
    setToggle('toggle-ent2-enabled', settings.ent2_enabled !== false);
    setToggle('toggle-ent2-mobile', settings.ent2_mobile_enabled !== false);
    setToggle('toggle-ent2-user-cache', settings.ent2_user_cache_daily !== false);
  })();
})();
