// ent2 User Search & Autocomplete Module
if (typeof ent2DataJsonCache === 'undefined') {
  var ent2DataJsonCache = null;
  var ent2DataJsonLowerMap = null;
  var ent2DataEntries = null;
  var ent2DbLoadingPromise = null;
}

const ENT2_USER_INDEX_CACHE_KEY = 'ent2_user_index_cache_v1';
const ENT2_USER_INDEX_CACHE_CHUNK_PREFIX = 'ent2_user_index_cache_chunk_';
const ENT2_USER_INDEX_IDB_DB = 'ent2_user_index_db';
const ENT2_USER_INDEX_IDB_STORE = 'user_index';
const ENT2_USER_INDEX_CACHE_ENABLED_KEY = 'ent2_user_cache_daily';
const ENT2_USER_INDEX_REFRESH_KEY = 'ent2_user_index_force_refresh_ts';
const ENT2_USER_INDEX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ENT2_USER_INDEX_CACHE_SAFE_BYTES = 10 * 1024 * 1024;
const ENT2_USER_INDEX_CACHE_VERSION = 3;

function isEnt2UserIndexCacheEnabled() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const value = localStorage.getItem(ENT2_USER_INDEX_CACHE_ENABLED_KEY);
      if (value !== null) return value !== 'false';
      return true;
    }
  } catch (_) {}

  try {
    const raw = localStorage.getItem(ENT2_USER_INDEX_CACHE_ENABLED_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch (_) {
    return true;
  }
}

function setEnt2UserIndexCacheEnabled(enabled) {
  try {
    localStorage.setItem(ENT2_USER_INDEX_CACHE_ENABLED_KEY, String(!!enabled));
  } catch (_) {}

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [ENT2_USER_INDEX_CACHE_ENABLED_KEY]: !!enabled });
    }
  } catch (_) {}
}

function getEnt2CacheDayKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return d.toISOString().slice(0, 10);
}

function getEnt2CacheDayFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const direct = payload.dayKey || payload.d || payload.savedDay || null;
  if (direct) return String(direct);
  const ts = Number(payload.savedAt || payload.t || 0);
  if (!ts) return null;
  return getEnt2CacheDayKey(new Date(ts));
}

async function readEnt2UserIndexRefreshFlag() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get([ENT2_USER_INDEX_REFRESH_KEY], (items) => {
          resolve(Number(items?.[ENT2_USER_INDEX_REFRESH_KEY] || 0));
        });
      });
      if (result) return result;
    }
  } catch (_) {}

  try {
    const raw = Number(localStorage.getItem(ENT2_USER_INDEX_REFRESH_KEY) || 0);
    return Number.isFinite(raw) ? raw : 0;
  } catch (_) {
    return 0;
  }
}

function clearEnt2UserIndexRefreshFlag() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove([ENT2_USER_INDEX_REFRESH_KEY]);
    }
  } catch (_) {}

  try {
    localStorage.removeItem(ENT2_USER_INDEX_REFRESH_KEY);
  } catch (_) {}
}

function normalizeEnt2ProfileImageMeta(profileImage) {
  const empty = { filename: '', imageType: '' };
  if (!profileImage) return empty;

  if (typeof profileImage === 'string') {
    const raw = profileImage.split('?')[0].trim();
    if (!raw) return empty;
    try {
      const url = new URL(raw, window.location.href);
      const pathname = url.pathname || raw;
      const filenameWithExt = pathname.split('/').filter(Boolean).pop() || '';
      const finalName = filenameWithExt.includes('.')
        ? filenameWithExt.slice(0, filenameWithExt.lastIndexOf('.'))
        : filenameWithExt;
      const ext = filenameWithExt.includes('.')
        ? filenameWithExt.slice(filenameWithExt.lastIndexOf('.') + 1).toLowerCase()
        : 'png';
      return { filename: finalName, imageType: ext || 'png' };
    } catch (_) {
      const last = raw.split('/').filter(Boolean).pop() || '';
      const filenameWithExt = last.includes('.') ? last : `${last}.png`;
      const finalName = filenameWithExt.includes('.')
        ? filenameWithExt.slice(0, filenameWithExt.lastIndexOf('.'))
        : filenameWithExt;
      const ext = filenameWithExt.includes('.')
        ? filenameWithExt.slice(filenameWithExt.lastIndexOf('.') + 1).toLowerCase()
        : 'png';
      return { filename: finalName, imageType: ext || 'png' };
    }
  }

  if (typeof profileImage === 'object') {
    const obj = profileImage;
    const filenameRaw = String(obj.filename || obj.name || '').trim();
    if (filenameRaw) {
      const cleanName = filenameRaw.includes('.')
        ? filenameRaw.slice(0, filenameRaw.lastIndexOf('.'))
        : filenameRaw;
      const ext = filenameRaw.includes('.')
        ? filenameRaw.slice(filenameRaw.lastIndexOf('.') + 1).toLowerCase()
        : String(obj.imageType || obj.type || 'png');
      return { filename: cleanName, imageType: ext || 'png' };
    }

    const urlValue = String(obj.imageUrl || obj.url || '').trim();
    if (urlValue) return normalizeEnt2ProfileImageMeta(urlValue);
  }

  return empty;
}

function buildEnt2CompactCachePayload(users) {
  const safeUsers = Array.isArray(users) ? users : [];
  const compactMap = {};

  for (const user of safeUsers) {
    const nickname = String(user?.nickname || user?.name || user?.displayName || '').trim();
    const id = String(user?.id || user?._id || user?.userId || user?.user_id || '').trim();
    if (!nickname || !id) continue;

    const profileImage = user?.profileImage || user?.avatar || user?.profile_image || null;
    const profileMeta = normalizeEnt2ProfileImageMeta(profileImage);
    const follower = Number.isFinite(Number(user?.follower)) ? Number(user.follower) : null;
    const following = Number.isFinite(Number(user?.following)) ? Number(user.following) : null;
    const created = user?.created || user?.createdAt || user?.joinedAt || null;
    const lower = nickname.toLowerCase();
    if (!compactMap[lower]) {
      compactMap[lower] = {
        n: nickname,
        i: id,
        p: profileMeta.filename || '',
        t: profileMeta.imageType || 'png',
        f: follower,
        g: following,
        c: created ? String(created) : ''
      };
    }
  }

  return {
    v: ENT2_USER_INDEX_CACHE_VERSION,
    d: getEnt2CacheDayKey(),
    savedAt: Date.now(),
    t: Date.now(),
    c: Object.keys(compactMap).length,
    users: compactMap
  };
}

function canPersistEnt2UserIndexCache(payload) {
  try {
    return new Blob([JSON.stringify(payload)]).size <= ENT2_USER_INDEX_CACHE_SAFE_BYTES;
  } catch (e) {
    return false;
  }
}

function openEnt2UserIndexDatabase() {
  return new Promise((resolve) => {
    try {
      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(ENT2_USER_INDEX_IDB_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ENT2_USER_INDEX_IDB_STORE)) {
          db.createObjectStore(ENT2_USER_INDEX_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

async function readEnt2UserIndexCacheFromIdb() {
  try {
    const db = await openEnt2UserIndexDatabase();
    if (!db) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction(ENT2_USER_INDEX_IDB_STORE, 'readonly');
      const store = tx.objectStore(ENT2_USER_INDEX_IDB_STORE);
      const req = store.get(ENT2_USER_INDEX_CACHE_KEY);
      req.onsuccess = () => {
        const value = req.result || null;
        if (value && value.v !== undefined && value.v !== ENT2_USER_INDEX_CACHE_VERSION && value.v !== 2) {
          resolve(null);
          return;
        }
        resolve(value);
      };
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

async function writeEnt2UserIndexCacheToIdb(payload) {
  try {
    const db = await openEnt2UserIndexDatabase();
    if (!db || !payload) return false;
    await new Promise((resolve) => {
      const tx = db.transaction(ENT2_USER_INDEX_IDB_STORE, 'readwrite');
      const store = tx.objectStore(ENT2_USER_INDEX_IDB_STORE);
      const req = store.put(payload, ENT2_USER_INDEX_CACHE_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
    return true;
  } catch (_) {
    return false;
  }
}

function splitEnt2UserIndexCachePayload(payload) {
  if (!payload || !payload.users || typeof payload.users !== 'object') return [];

  const entries = Object.entries(payload.users);
  const chunkSize = 15000;
  const chunks = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    const map = Object.fromEntries(entries.slice(i, i + chunkSize));
    chunks.push({
      v: payload.v,
      d: payload.d || getEnt2CacheDayKey(),
      savedAt: payload.savedAt || Date.now(),
      t: payload.t || payload.savedAt || Date.now(),
      c: Object.keys(map).length,
      idx: chunks.length,
      total: Math.ceil(entries.length / chunkSize),
      users: map
    });
  }
  return chunks;
}

function mergeEnt2UserIndexCacheChunks(chunks) {
  if (!Array.isArray(chunks) || !chunks.length) return null;
  const ordered = [...chunks].sort((a, b) => (Number(a.idx || 0) - Number(b.idx || 0)));
  const mergedUsers = {};
  for (const chunk of ordered) {
    if (!chunk || !chunk.users || typeof chunk.users !== 'object') continue;
    Object.assign(mergedUsers, chunk.users);
  }
  if (!Object.keys(mergedUsers).length) return null;

  const payload = ordered[0];
  return {
    v: payload.v,
    d: payload.d,
    savedAt: payload.savedAt,
    t: payload.t,
    c: Object.keys(mergedUsers).length,
    users: mergedUsers
  };
}

function clearEnt2UserIndexCacheArtifacts() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (items) => {
        const keys = Object.keys(items || {}).filter((key) => key === ENT2_USER_INDEX_CACHE_KEY || key.startsWith(ENT2_USER_INDEX_CACHE_CHUNK_PREFIX));
        if (keys.length) chrome.storage.local.remove(keys);
      });
    }
  } catch (_) {}

  try {
    Object.keys(localStorage).forEach((key) => {
      if (key === ENT2_USER_INDEX_CACHE_KEY || key.startsWith(ENT2_USER_INDEX_CACHE_CHUNK_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (_) {}
}

async function readEnt2UserIndexCache() {
  if (!isEnt2UserIndexCacheEnabled()) return null;

  try {
    if (typeof indexedDB !== 'undefined') {
      const idbValue = await readEnt2UserIndexCacheFromIdb();
      if (idbValue && idbValue.users && typeof idbValue.users === 'object') {
        return idbValue;
      }
    }
  } catch (_) {}

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          const chunkEntries = Object.entries(items || {}).filter(([key]) => key.startsWith(ENT2_USER_INDEX_CACHE_CHUNK_PREFIX));
          const chunkValues = chunkEntries.map(([, value]) => value).filter(Boolean);
          const merged = mergeEnt2UserIndexCacheChunks(chunkValues);
          if (merged) {
            resolve(merged);
            return;
          }

          const cached = items?.[ENT2_USER_INDEX_CACHE_KEY] || null;
          if (!cached || cached.v === undefined) {
            resolve(null);
            return;
          }
          if (cached.v !== ENT2_USER_INDEX_CACHE_VERSION && cached.v !== 2) {
            chrome.storage.local.remove([ENT2_USER_INDEX_CACHE_KEY]);
            resolve(null);
            return;
          }
          resolve(cached);
        });
      });
      if (result) return result;
    }
  } catch (e) {
    console.warn('[ent2] cache read from chrome.storage.local failed:', e);
  }

  try {
    const raw = localStorage.getItem(ENT2_USER_INDEX_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.chunked) {
        const chunkKeys = Object.keys(localStorage).filter((key) => key.startsWith(ENT2_USER_INDEX_CACHE_CHUNK_PREFIX));
        if (chunkKeys.length) {
          const chunks = chunkKeys.map((key) => {
            try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
          }).filter(Boolean);
          const merged = mergeEnt2UserIndexCacheChunks(chunks);
          if (merged) return merged;
        }
      }
      if (!parsed || parsed.v === undefined) return null;
      if (parsed.v !== ENT2_USER_INDEX_CACHE_VERSION && parsed.v !== 2) {
        localStorage.removeItem(ENT2_USER_INDEX_CACHE_KEY);
        return null;
      }
      return parsed;
    }

    const chunkKeys = Object.keys(localStorage).filter((key) => key.startsWith(ENT2_USER_INDEX_CACHE_CHUNK_PREFIX));
    if (chunkKeys.length) {
      const chunks = chunkKeys.map((key) => {
        try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
      }).filter(Boolean);
      const merged = mergeEnt2UserIndexCacheChunks(chunks);
      if (merged) return merged;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function writeEnt2UserIndexCache(payload) {
  try {
    if (!isEnt2UserIndexCacheEnabled()) return;

    if (!payload) {
      console.warn('[ent2] user index cache payload is empty; skipping cache write.');
      return;
    }

    if (typeof indexedDB !== 'undefined') {
      try {
        writeEnt2UserIndexCacheToIdb(payload).then((ok) => {
          if (ok) return;
        }).catch(() => {});
        return;
      } catch (_) {}
    }

    const chunks = canPersistEnt2UserIndexCache(payload) ? null : splitEnt2UserIndexCachePayload(payload);

    if (chunks && chunks.length) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(null, (items) => {
            const keysToRemove = Object.keys(items || {}).filter((key) => key === ENT2_USER_INDEX_CACHE_KEY || key.startsWith(ENT2_USER_INDEX_CACHE_CHUNK_PREFIX));
            if (keysToRemove.length) chrome.storage.local.remove(keysToRemove);
          });
        }
      } catch (_) {}

      try {
        Object.keys(localStorage).forEach((key) => {
          if (key === ENT2_USER_INDEX_CACHE_KEY || key.startsWith(ENT2_USER_INDEX_CACHE_CHUNK_PREFIX)) {
            localStorage.removeItem(key);
          }
        });
      } catch (_) {}

      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          for (const chunk of chunks) {
            const key = `${ENT2_USER_INDEX_CACHE_CHUNK_PREFIX}${String(chunk.idx).padStart(3, '0')}`;
            const serialized = JSON.stringify(chunk);
            chrome.storage.local.set({ [key]: chunk }, () => {
              if (chrome.runtime && chrome.runtime.lastError) {
                try { localStorage.setItem(key, serialized); } catch (_) {}
              }
            });
            try { localStorage.setItem(key, serialized); } catch (_) {}
          }
        }
      } catch (e) {
        console.warn('[ent2] chunked cache write failed:', e);
      }

      try {
        localStorage.setItem(ENT2_USER_INDEX_CACHE_KEY, JSON.stringify({
          v: payload.v,
          d: payload.d,
          savedAt: payload.savedAt,
          t: payload.t,
          c: payload.c,
          chunked: true,
          chunks: chunks.length
        }));
      } catch (_) {}
      return;
    }

    if (!canPersistEnt2UserIndexCache(payload)) {
      console.warn('[ent2] user index cache is too large to persist safely; skipping cache write to avoid quota errors.');
      return;
    }

    const serialized = JSON.stringify(payload);

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [ENT2_USER_INDEX_CACHE_KEY]: payload }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn('[ent2] chrome cache write failed, falling back to localStorage:', chrome.runtime.lastError.message);
            try {
              localStorage.setItem(ENT2_USER_INDEX_CACHE_KEY, serialized);
            } catch (_) {}
          }
        });
      }
    } catch (e) {
      console.warn('[ent2] chrome cache write exception:', e);
    }

    try {
      localStorage.setItem(ENT2_USER_INDEX_CACHE_KEY, serialized);
    } catch (_) {
      try {
        sessionStorage.setItem(ENT2_USER_INDEX_CACHE_KEY, serialized);
      } catch (_) {}
    }
  } catch (e) {
    console.warn('[ent2] user index cache write failed:', e);
  }
}

function hydrateEnt2UserIndexFromCache(users) {
  if (!users) return false;

  const entries = Array.isArray(users)
    ? users
    : Object.entries(users).map(([lowerKey, value]) => {
        const meta = value && typeof value === 'object' ? value : { i: value };
        const nickname = String(meta.n || lowerKey || '').trim();
        const rawId = meta.i ?? meta.id ?? value ?? '';
        const id = String(rawId).trim();
        const follower = Number.isFinite(Number(meta.f)) ? Number(meta.f) : null;
        const following = Number.isFinite(Number(meta.g)) ? Number(meta.g) : null;
        const created = meta.c || null;
        const updated = meta.u || null;
        const profileFile = String(meta.p || '').trim();
        const profileType = String(meta.t || '').trim();
        const profileImage = profileFile ? { filename: profileFile, imageType: profileType || 'png' } : null;
        return {
          nickname,
          id,
          follower,
          following,
          created,
          updated,
          profileImage,
          lower: nickname ? nickname.toLowerCase() : String(lowerKey || '').toLowerCase()
        };
      }).filter((entry) => entry.id && entry.nickname);

  if (!entries.length) return false;

  ent2DataJsonCache = Object.fromEntries(
    entries.map((user) => [String(user.nickname), String(user.id)])
  );
  buildEnt2DataIndex(entries);
  return true;
}

function buildEnt2DataIndex(data) {
  ent2DataJsonLowerMap = new Map();
  ent2DataEntries = [];
  const list = Array.isArray(data) ? data : Object.values(data || {});
  for (const user of list) {
    const nickname = user && (user.nickname || user.name || user.displayName);
    const id = user && (user.id || user._id || user.userId || user.user_id);
    if (!nickname || !id) continue;

    const normalized = {
      nickname: String(nickname),
      id: String(id),
      lower: String(nickname).toLowerCase(),
      follower: Number.isFinite(Number(user.follower)) ? Number(user.follower) : null,
      following: Number.isFinite(Number(user.following)) ? Number(user.following) : null,
      created: user.created || user.createdAt || user.joinedAt || null,
      profileImage: user.profileImage || user.avatar || user.profile_image || null,
      updated: user.updated || user.lastUpdated || null
    };

    ent2DataJsonLowerMap.set(normalized.lower, { originalKey: normalized.nickname, id: normalized.id, ...normalized });
    ent2DataEntries.push(normalized);
  }
}

async function loadEnt2ChunkUsers(base, file) {
  const res = await fetch(base + file, { cache: 'no-cache' });
  if (!res.ok) return [];

  const raw = await res.json();
  const users = [];
  for (const key in raw) {
    const user = raw[key];
    if (!user || typeof user.nickname !== 'string' || !user.nickname) continue;
    users.push({
      id: String(user.id || key),
      nickname: user.nickname,
      name: user.nickname,
      lower: user.nickname.toLowerCase(),
      follower: Number.isFinite(Number(user.follower)) ? Number(user.follower) : null,
      following: Number.isFinite(Number(user.following)) ? Number(user.following) : null,
      created: user.created || user.createdAt || user.joinedAt || null,
      profileImage: user.profileImage || user.avatar || user.profile_image || null,
      updated: user.updated || user.lastUpdated || null
    });
  }
  return users;
}

async function processEnt2ChunkFiles(base, files, onProgress, concurrency = 8) {
  const results = [];
  let nextIndex = 0;
  let finished = 0;
  const total = files.length || 1;
  const workerCount = Math.max(1, Math.min(concurrency, files.length || 1));

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= files.length) return;
      const file = files[index];
      try {
        const chunkUsers = await loadEnt2ChunkUsers(base, file);
        results.push(...chunkUsers);
      } catch (_) {
        // ignore failed chunk fetches; they are non-critical for the index build
      } finally {
        finished += 1;
        if (typeof onProgress === 'function') {
          onProgress(`청크 로딩 중... (${finished}/${files.length})`, Math.round(28 + (finished / total) * 62));
        }
      }
    }
  };

  await Promise.allSettled(Array.from({ length: workerCount }, worker));

  const merged = new Map();
  for (const user of results) {
    const id = String(user.id);
    const prev = merged.get(id);
    if (prev && String(prev.updated || '') >= String(user.updated || '')) continue;
    merged.set(id, user);
  }

  return [...merged.values()];
}

async function getOrFetchEnt2DataJson(onProgress, forceRefresh = false) {
  const notify = (message, percent = null, ready = false) => {
    if (typeof onProgress === 'function') {
      onProgress({ message, percent, ready });
    }
  };

  const reloadSignal = await readEnt2UserIndexRefreshFlag();
  if (!forceRefresh && reloadSignal) {
    forceRefresh = true;
    clearEnt2UserIndexRefreshFlag();
  }

  if (!forceRefresh && ent2DataJsonCache && ent2DataEntries && ent2DataEntries.length > 0) {
    notify(`DB 준비 완료 (${ent2DataEntries.length.toLocaleString()}명)`, 100, true);
    return ent2DataJsonCache;
  }

  if (!forceRefresh) {
    const cached = await readEnt2UserIndexCache();
    if (cached && cached.users && typeof cached.users === 'object') {
      const cacheDay = getEnt2CacheDayFromPayload(cached);
      const todayKey = getEnt2CacheDayKey();
      const hasValidDay = cacheDay && cacheDay === todayKey;
      const hasUsers = Object.keys(cached.users).length > 0;
      if (hasValidDay && hasUsers) {
        hydrateEnt2UserIndexFromCache(cached.users);
        notify(`캐시 로드 완료 (${ent2DataEntries.length.toLocaleString()}명)`, 100, true);
        return ent2DataJsonCache;
      }
      if (cacheDay && cacheDay !== todayKey) {
        console.info('[ent2] cached user index is from a previous day; reloading for the new day.');
      }
    }
  }

  if (ent2DbLoadingPromise && !forceRefresh) return ent2DbLoadingPromise;

  ent2DbLoadingPromise = (async () => {
    const base = 'https://raw.githubusercontent.com/ddot103/Entryuser/refs/heads/main/files/';
    const api = 'https://api.github.com/repos/ddot103/Entryuser/contents/files?ref=main';
    let files = [];

    notify('청크 인덱스 확인 중...', 8, false);

    try {
      const res = await fetch(api, { cache: 'no-cache' });
      if (res.ok) {
        files = (await res.json()).map((f) => f.name).filter((name) => /^users_chunk_\d+\.json$/.test(name)).sort();
      }
    } catch (_) {}

    if (!files.length) {
      for (let i = 1; i <= 300; i += 10) {
        const names = Array.from({ length: 10 }, (_, step) => `users_chunk_${String(i + step).padStart(3, '0')}.json`);
        const checks = await Promise.all(names.map((name) => fetch(base + name, { method: 'HEAD' }).then((r) => (r.ok ? name : null)).catch(() => null)));
        files.push(...checks.filter(Boolean));
        if (i > 30 && !checks.some(Boolean)) break;
      }
      files = [...new Set(files)].sort();
    }

    notify(files.length ? `청크 목록 확인 중... (${files.length}개)` : '청크 목록이 비어있습니다. 확인 중...', files.length ? 22 : 12, false);

    if (!files.length) {
      notify('청크 인덱스 없음 (fallback)', 100, false);
      return {};
    }

    const users = await processEnt2ChunkFiles(base, files, (message, percent) => notify(message, percent, false), 8);
    ent2DataJsonCache = Object.fromEntries(users.map((u) => [u.nickname, u.id]));
    buildEnt2DataIndex(users);

    const compactPayload = buildEnt2CompactCachePayload(users);
    writeEnt2UserIndexCache(compactPayload);

    notify(`청크 인덱스 준비 완료 (${ent2DataEntries.length.toLocaleString()}명)`, 100, true);
    return ent2DataJsonCache;
  })();

  try {
    return await ent2DbLoadingPromise;
  } finally {
    if (!forceRefresh) {
      ent2DbLoadingPromise = null;
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function resolveEnt2AvatarUrl(profileImage) {
  if (!profileImage) return 'https://playentry.org/img/DefaultCardUserThmb.svg';

  if (typeof profileImage === 'string' && profileImage.trim()) {
    return normalizeSafeEnt2AssetUrl(profileImage.split('?')[0], 'https://playentry.org/img/DefaultCardUserThmb.svg');
  }

  if (typeof profileImage === 'object') {
    if (profileImage.imageUrl && typeof profileImage.imageUrl === 'string') {
      return normalizeSafeEnt2AssetUrl(profileImage.imageUrl.split('?')[0], 'https://playentry.org/img/DefaultCardUserThmb.svg');
    }
    if (profileImage.url && typeof profileImage.url === 'string') {
      return normalizeSafeEnt2AssetUrl(profileImage.url.split('?')[0], 'https://playentry.org/img/DefaultCardUserThmb.svg');
    }
    if (profileImage.filename) {
      const filename = String(profileImage.filename);
      const imageType = profileImage.imageType || 'png';
      const basePath = filename.startsWith('avatar/') ? 'avatar' : 'uploads';
      if (basePath === 'avatar') {
        return normalizeSafeEnt2AssetUrl(`https://playentry.org/uploads/avatar/${filename.slice(0, 2)}/${filename.slice(2, 4)}/image/${filename}.png`, 'https://playentry.org/img/DefaultCardUserThmb.svg');
      }
      return normalizeSafeEnt2AssetUrl(`https://playentry.org/uploads/${filename.slice(0, 2)}/${filename.slice(2, 4)}/${filename}.${imageType}`, 'https://playentry.org/img/DefaultCardUserThmb.svg');
    }
  }

  return 'https://playentry.org/img/DefaultCardUserThmb.svg';
}

function searchInEnt2DataJson(queryVal, limit = 50) {
  if (!queryVal) return [];
  const qTrim = queryVal.trim();
  if (!qTrim) return [];
  const qLower = qTrim.toLowerCase();
  const starts = [];
  const includes = [];
  const seen = new Set();

  if (ent2DataEntries) {
    for (const item of ent2DataEntries) {
      if (seen.has(item.id)) continue;
      const match = {
        nickname: item.nickname,
        id: item.id,
        lower: item.lower,
        follower: item.follower,
        following: item.following,
        created: item.created,
        profileImage: item.profileImage,
        matchType: 'includes'
      };

      if (item.lower === qLower) {
        starts.unshift({ ...match, matchType: 'exact' });
        seen.add(item.id);
      } else if (item.lower.startsWith(qLower)) {
        starts.push({ ...match, matchType: 'prefix' });
        seen.add(item.id);
      } else if (item.lower.includes(qLower)) {
        includes.push(match);
        seen.add(item.id);
      }
    }
  }

  const combined = [...starts, ...includes].slice(0, limit);
  return combined;
}

async function fetchUserListFallbackByNickname(queryVal) {
  try {
    const gql = `
      query SELECT_USER_LIST($query: String, $pageParam: PageParam) {
        userList(query: $query, pageParam: $pageParam) {
          total
          list {
            id
            nickname
            username
            profileImage { id filename imageType }
          }
        }
      }
    `;
    const res = await fetch('https://playentry.org/graphql/SELECT_USER_LIST', {
      method: 'POST',
      headers: typeof getPlayEntryFetchHeaders === 'function' ? getPlayEntryFetchHeaders() : { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: gql,
        variables: { query: queryVal, pageParam: { display: 8, sort: 'created' } }
      })
    });
    const data = await res.json();
    const list = data?.data?.userList?.list || [];
    if (!list.length) return null;

    const normalized = queryVal.trim().toLowerCase();
    const exactMatch = list.find((u) => {
      const nickname = (u.nickname || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      return nickname === normalized || username === normalized;
    }) || list[0];

    return {
      id: String(exactMatch.id),
      nickname: exactMatch.nickname || exactMatch.username || queryVal,
      username: exactMatch.username || null,
      profileImage: exactMatch.profileImage || null,
      source: 'live_user_list'
    };
  } catch (e) {
    console.warn('[ent2] userList fallback failed:', e);
    return null;
  }
}

async function checkEnt2NicknameExists(nickname) {
  try {
    const gql = `
      query CHECK_NICKNAME($nickname: String!) {
        checkNickname(nickname: $nickname) {
          status
          result
        }
      }
    `;
    const res = await fetch('https://playentry.org/graphql/CHECK_NICKNAME', {
      method: 'POST',
      headers: typeof getPlayEntryFetchHeaders === 'function' ? getPlayEntryFetchHeaders() : { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query: gql, variables: { nickname } })
    });
    const data = await res.json();
    const payload = data?.data?.checkNickname;
    const errors = Array.isArray(data?.errors) ? data.errors : [];
    const firstError = errors[0] || {};
    const errorStatusCode = Number(firstError?.statusCode ?? firstError?.extensions?.statusCode ?? 0);
    const statusValue = payload?.status ?? payload?.result ?? null;

    if (errorStatusCode === 435) return true;
    if (errorStatusCode === 500 || errorStatusCode === 503) return false;

    if (typeof statusValue === 'boolean') return statusValue;
    if (statusValue === 'available' || statusValue === 'empty' || statusValue === 'not_exists') return false;
    if (statusValue === 'taken' || statusValue === 'exists' || statusValue === 'duplicate') return true;
    if (typeof payload === 'object' && payload !== null && Object.keys(payload).length > 0) return true;

    return false;
  } catch (e) {
    return false;
  }
}

function showEnt2CustomNotice(message, tone = 'info') {
  const existing = document.querySelector('.ent2-inline-notice');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.className = 'ent2-inline-notice';
  wrap.style.position = 'fixed';
  wrap.style.right = '22px';
  wrap.style.bottom = '22px';
  wrap.style.zIndex = '999999';
  wrap.style.maxWidth = '420px';
  wrap.style.padding = '14px 18px';
  wrap.style.borderRadius = '14px';
  wrap.style.boxShadow = '0 18px 34px rgba(15,23,42,0.18)';
  wrap.style.fontSize = '13px';
  wrap.style.fontWeight = '700';
  wrap.style.lineHeight = '1.5';
  wrap.style.border = '1px solid rgba(148,163,184,0.22)';
  wrap.style.color = '#f8fafc';
  wrap.style.background = tone === 'warning' ? '#f59e0b' : '#1f2937';
  wrap.style.backdropFilter = 'blur(10px)';
  wrap.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '8px';
  closeBtn.style.right = '10px';
  closeBtn.style.border = 'none';
  closeBtn.style.background = 'transparent';
  closeBtn.style.color = '#fff';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '15px';
  closeBtn.style.fontWeight = '800';
  closeBtn.onclick = () => wrap.remove();
  wrap.style.position = 'fixed';
  wrap.style.paddingRight = '32px';
  wrap.appendChild(closeBtn);

  document.body.appendChild(wrap);

  setTimeout(() => {
    wrap.style.opacity = '0';
    wrap.style.transform = 'translateY(8px)';
    wrap.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    setTimeout(() => wrap.remove(), 260);
  }, 2600);
}

async function performEnt2UserSearch(queryTerm) {
  if (!queryTerm) return null;
  const cleanQuery = queryTerm.trim();
  if (!cleanQuery) return null;

  await getOrFetchEnt2DataJson();
  const matches = searchInEnt2DataJson(cleanQuery, 1);
  if (matches.length > 0) {
    return { query: cleanQuery, id: matches[0].id, nickname: matches[0].nickname, source: 'chunk_index', follower: matches[0].follower, following: matches[0].following, created: matches[0].created, profileImage: matches[0].profileImage };
  }

  if (/^[0-9a-fA-F]{24}$/.test(cleanQuery)) {
    return { query: cleanQuery, id: cleanQuery, nickname: cleanQuery, source: 'direct_id' };
  }

  const serverMatch = await fetchUserListFallbackByNickname(cleanQuery);
  if (serverMatch) {
    return { ...serverMatch, query: cleanQuery };
  }

  const nicknameTaken = await checkEnt2NicknameExists(cleanQuery);
  if (nicknameTaken) {
    const retryMatch = await fetchUserListFallbackByNickname(cleanQuery);
    if (retryMatch) {
      return { ...retryMatch, query: cleanQuery };
    }
  }

  return null;
}

function renderEnt2UserSearchTab(container, isDark, profileIdParam, navTo) {
  if (!container) return;
  container.innerHTML = `
    <div style="background:${isDark ? '#171b23' : '#ffffff'}; border:1px solid ${isDark ? 'rgba(148,163,184,0.14)' : '#dfe7f5'}; border-radius:24px; box-shadow:0 18px 42px rgba(15,23,42,0.08); padding:20px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; flex-wrap:wrap;">
        <div>
          <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:${isDark ? '#93c5fd' : '#5b6dba'}; font-weight:800; margin-bottom:4px;">Search</div>
          <h2 style="margin:0; font-size:20px; font-weight:800;">유저 검색</h2>
        </div>
      </div>

      <div id="ent2-user-index-status-wrap">
        <div id="ent2-user-index-status" style="margin-bottom:12px; padding:12px 14px; border:1px solid ${isDark ? 'rgba(148,163,184,0.14)' : '#e5edf8'}; border-radius:14px; background:${isDark ? '#101827' : '#f8fbff'};">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; font-size:11px; color:${isDark ? '#dbeafe' : '#475569'}; font-weight:700;">
            <span>데이터 인덱스</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span id="ent2-user-index-state" style="color:#3182f6;">준비 중</span>
              <button id="ent2-user-index-close-btn" type="button" style="border:none; background:transparent; color:${isDark ? '#cbd5e1' : '#64748b'}; font-size:11px; font-weight:800; cursor:pointer; padding:0;">닫기</button>
            </div>
          </div>
          <div style="height:6px; background:${isDark ? '#1f2937' : '#e5edf8'}; border-radius:999px; overflow:hidden;">
            <div id="ent2-user-index-progress" style="height:100%; width:0%; background:linear-gradient(90deg, #3b82f6, #60a5fa); border-radius:999px; transition:width 0.2s ease;"></div>
          </div>
          <div id="ent2-user-index-text" style="margin-top:8px; font-size:11.5px; color:${isDark ? '#cbd5e1' : '#64748b'};">인덱스 로딩 중...</div>
        </div>
      </div>

      <button id="ent2-user-index-reopen-btn" type="button" style="display:none; margin-bottom:12px; border:1px dashed ${isDark ? 'rgba(148,163,184,0.2)' : '#cbd5e1'}; background:${isDark ? '#101827' : '#f8fbff'}; color:${isDark ? '#dbeafe' : '#475569'}; border-radius:10px; padding:8px 12px; font-size:11px; font-weight:700; cursor:pointer;">데이터 인덱스 열기</button>

      <div style="position:relative;">
        <input id="ent2-user-search-input" type="text" placeholder="닉네임 또는 24자리 ID 검색" autocomplete="off" style="width:100%; padding:16px 118px 16px 16px; border-radius:16px; border:2px solid #4f7cff; background:${isDark ? '#101827' : '#f8fbff'}; color:${isDark ? '#f2f4f6' : '#111827'}; font-size:14.5px; font-weight:600; box-sizing:border-box; outline:none; box-shadow:0 12px 24px rgba(79,124,255,0.10);">
        <button id="ent2-user-search-btn" type="button" style="position:absolute; right:8px; top:8px; bottom:8px; padding:0 18px; background:#3182f6; color:#fff; border:none; border-radius:12px; font-size:13px; font-weight:800; cursor:pointer; box-shadow:0 8px 18px rgba(49,130,246,0.28);">검색</button>
      </div>

      <div id="ent2-autocomplete-box" style="display:none; margin-top:12px; border:1px solid ${isDark ? 'rgba(148,163,184,0.14)' : '#e5edf8'}; border-radius:16px; overflow:hidden; background:${isDark ? '#111827' : '#ffffff'}; max-height:320px; overflow-y:auto; box-shadow:0 14px 28px rgba(15,23,42,0.08);"></div>
      <div id="ent2-profile-display-area" style="margin-top:14px;"></div>
    </div>
  `;

  const inputEl = container.querySelector('#ent2-user-search-input');
  const btnEl = container.querySelector('#ent2-user-search-btn');
  const box = container.querySelector('#ent2-autocomplete-box');
  const displayArea = container.querySelector('#ent2-profile-display-area');
  const stateEl = container.querySelector('#ent2-user-index-state');
  const progressEl = container.querySelector('#ent2-user-index-progress');
  const textEl = container.querySelector('#ent2-user-index-text');
  const indexStatusWrap = container.querySelector('#ent2-user-index-status-wrap');
  const reopenBtn = container.querySelector('#ent2-user-index-reopen-btn');
  const closeBtn = container.querySelector('#ent2-user-index-close-btn');

  const setIndexPanelVisible = (visible) => {
    if (indexStatusWrap) indexStatusWrap.style.display = visible ? 'block' : 'none';
    if (reopenBtn) reopenBtn.style.display = visible ? 'none' : 'inline-block';
  };

  const updateIndexStatus = (message = '인덱스 로딩 중...', percent = 0, ready = false) => {
    if (stateEl) {
      stateEl.textContent = ready ? '준비 완료' : '준비 중';
      stateEl.style.color = ready ? '#22c55e' : '#3182f6';
    }
    if (progressEl) progressEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if (textEl) textEl.textContent = message;
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', () => setIndexPanelVisible(false));
  }
  if (reopenBtn) {
    reopenBtn.addEventListener('click', () => setIndexPanelVisible(true));
  }

  const handleProgressUpdate = (payload) => {
    const info = typeof payload === 'string'
      ? { message: payload, percent: payload.includes('준비 완료') || payload.includes('없음') ? 100 : 65, ready: payload.includes('준비 완료') || payload.includes('없음') }
      : payload || { message: '인덱스 로딩 중...', percent: 0, ready: false };

    const nextPercent = typeof info.percent === 'number' ? info.percent : (info.ready ? 100 : 64);
    updateIndexStatus(info.message || '인덱스 로딩 중...', nextPercent, !!info.ready);
  };

  updateIndexStatus('인덱스 로딩 중...', 8, false);

  getOrFetchEnt2DataJson(handleProgressUpdate).catch(() => {
    updateIndexStatus('인덱스 로딩 실패', 100, false);
  });

  const hideAutoBox = () => {
    if (box) box.style.display = 'none';
  };

  const triggerUserExplore = async (userId, userNickname, avatarUrl) => {
    hideAutoBox();
    if (!userId) return;

    if (typeof logEnt2SearchHistory === 'function') {
      await logEnt2SearchHistory({
        id: userId,
        nickname: userNickname || userId,
        query: userNickname || userId,
        avatar: avatarUrl || 'https://playentry.org/img/DefaultCardUserThmb.svg'
      });
    }

    const targetProfilePath = `/ent2/profile/${userId}`;
    if (navTo) navTo(targetProfilePath);
    else if (window.history) {
      window.history.pushState({}, '', targetProfilePath);
      if (typeof handleEnt2PageRoute === 'function') handleEnt2PageRoute();
    }

    if (displayArea) {
      loadEnt2FullUserProfile(displayArea, isDark, userId, navTo);
    }
  };

  const fetchAutocomplete = async (q) => {
    const queryVal = (q || '').trim();
    if (!queryVal) {
      hideAutoBox();
      return;
    }

    await getOrFetchEnt2DataJson(handleProgressUpdate);
    const localMatches = searchInEnt2DataJson(queryVal, 50);

    if (localMatches.length > 0) {
      const headerHtml = `
        <div style="padding:10px 16px; font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; border-bottom:1px solid ${isDark ? '#2a3749' : '#e2e8f0'}; background:${isDark ? '#1a2332' : '#f8fafc'}; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:10; backdrop-filter:blur(8px);">
          <span>실시간 검색 미리보기 (${localMatches.length}개)</span>
          <span style="font-size:10px; color:${isDark ? '#64748b' : '#94a3b8'};">1.시작 / 2.포함</span>
        </div>
      `;

      const itemsHtml = localMatches.map((u) => {
        const avatarUrl = resolveEnt2AvatarUrl(u.profileImage);
        let matchBadge = '<span style="font-size:10px; background:rgba(139,92,246,0.15); color:#8b5cf6; padding:1px 6px; border-radius:4px; margin-left:6px; font-weight:700;">포함</span>';
        if (u.matchType === 'exact') matchBadge = '<span style="font-size:10px; background:#4f7cff; color:#fff; padding:1px 6px; border-radius:4px; margin-left:6px; font-weight:700;">정확</span>';
        else if (u.matchType === 'prefix') matchBadge = '<span style="font-size:10px; background:rgba(0,122,255,0.15); color:#007aff; padding:1px 6px; border-radius:4px; margin-left:6px; font-weight:700;">시작</span>';

        return `
          <div class="ent2-auto-item" data-id="${escapeHtml(u.id)}" data-nickname="${escapeHtml(u.nickname || '')}" data-avatar="${escapeHtml(avatarUrl)}" style="padding:12px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; transition:background 0.15s; border-bottom:1px solid ${isDark ? '#2a3749' : '#f1f5f9'};">
            <div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
              <img src="${escapeHtml(avatarUrl)}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; flex-shrink:0; border:1px solid ${isDark ? '#334155' : '#e2e8f0'};" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
              <div style="overflow:hidden;">
                <div style="font-size:14px; font-weight:700; color:${isDark ? '#f8fafc' : '#0f172a'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center;">
                  <span>${escapeHtml(u.nickname)}</span>${matchBadge}
                </div>
                <div style="font-size:11px; color:${isDark ? '#94a3b8' : '#64748b'}; margin-top:2px;">ID: ${escapeHtml(u.id)}</div>
              </div>
            </div>
            <span style="font-size:11.5px; font-weight:700; color:#007aff; background:rgba(0,122,255,0.1); padding:4px 12px; border-radius:8px; flex-shrink:0; display:inline-flex; align-items:center; gap:4px;">
              <span>프로필 탐색</span>
              <svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </span>
          </div>
        `;
      }).join('');

      box.innerHTML = headerHtml + itemsHtml;
      box.querySelectorAll('.ent2-auto-item').forEach((item) => {
        item.addEventListener('mouseenter', () => { item.style.background = isDark ? '#0f172a' : '#f8fafc'; });
        item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
        item.addEventListener('click', () => {
          const id = item.getAttribute('data-id');
          const nick = item.getAttribute('data-nickname');
          const av = item.getAttribute('data-avatar');
          triggerUserExplore(id, nick, av);
        });
      });
      box.style.display = 'block';
      return;
    }

    try {
      const graphqlQueryStr = `
        query SELECT_USER_LIST($query: String, $pageParam: PageParam) {
          userList(query: $query, pageParam: $pageParam) {
            total
            list {
              id
              nickname
              username
              profileImage { id filename imageType }
            }
          }
        }
      `;

      const res = await fetch('https://playentry.org/graphql/SELECT_USER_LIST', {
        method: 'POST',
        headers: typeof getPlayEntryFetchHeaders === 'function' ? getPlayEntryFetchHeaders() : { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: graphqlQueryStr,
          variables: { query: queryVal, pageParam: { display: 8, sort: 'created' } }
        })
      });

      const data = await res.json();
      const userList = data?.data?.userList?.list || [];

      if (userList.length === 0) {
        box.innerHTML = `<div style="padding:16px; text-align:center; font-size:12.5px; color:${isDark ? '#94a3b8' : '#64748b'};">일치하는 유저가 없습니다.</div>`;
        box.style.display = 'block';
        return;
      }

      box.innerHTML = userList.map((u) => `
        <div class="ent2-auto-item" data-id="${escapeHtml(u.id)}" data-nickname="${escapeHtml(u.nickname || '')}" style="padding:12px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer;">
          <div>
            <div style="font-size:14px; font-weight:700; color:${isDark ? '#f8fafc' : '#0f172a'};">${escapeHtml(u.nickname || '익명')}</div>
            <div style="font-size:11px; color:${isDark ? '#94a3b8' : '#64748b'};">ID: ${escapeHtml(u.id)}</div>
          </div>
          <span style="font-size:11.5px; font-weight:700; color:#007aff; background:rgba(0,122,255,0.1); padding:4px 12px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
            <span>프로필 탐색</span>
            <svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </span>
        </div>
      `).join('');

      box.querySelectorAll('.ent2-auto-item').forEach((item) => {
        item.onclick = () => {
          const id = item.getAttribute('data-id');
          const nick = item.getAttribute('data-nickname');
          triggerUserExplore(id, nick, null);
        };
      });

      box.style.display = 'block';
    } catch (error) {
      console.error('[ent2] Autocomplete fallback error:', error);
    }
  };

  const renderPreview = async () => {
    const q = (inputEl.value || '').trim();
    if (!q) {
      hideAutoBox();
      return;
    }
    await fetchAutocomplete(q);
  };

  inputEl.addEventListener('input', () => {
    clearTimeout(inputEl._timer);
    inputEl._timer = setTimeout(renderPreview, 150);
  });

  btnEl.addEventListener('click', async () => {
    const query = inputEl.value.trim();
    if (!query) return;

    if (displayArea) {
      displayArea.innerHTML = `<div style="padding:24px; text-align:center; color:#007aff; font-weight:700; font-size:13.5px;">EntryUser DB 탐색 중...</div>`;
    }

    const res = await performEnt2UserSearch(query);
    if (res && res.id) {
      triggerUserExplore(res.id, res.nickname, res.avatar || res.profileImage);
    } else {
      const nicknameExists = await checkEnt2NicknameExists(query);
      if (nicknameExists) {
        showEnt2CustomNotice('존재하는 계정이지만 찾지 못했어요', 'warning');
      } else {
        showEnt2CustomNotice('그 이름을 가진 계정은 존재하지 않아요', 'info');
      }

      if (displayArea) {
        displayArea.innerHTML = `
          <div style="padding:20px; background:${nicknameExists ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'}; border:1px solid ${nicknameExists ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}; border-radius:16px; color:${nicknameExists ? '#d97706' : '#ef4444'}; font-size:13px; font-weight:700; text-align:center; display:flex; align-items:center; justify-content:center; gap:8px;">
            <svg style="width:18px; height:18px; color:${nicknameExists ? '#d97706' : '#ef4444'};" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <span>${nicknameExists ? '존재하는 계정이지만 찾지 못했어요' : '그 이름을 가진 계정은 존재하지 않아요'}</span>
          </div>
        `;
      }
    }
  });

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const query = inputEl.value.trim();
      if (!query) return;
      btnEl.click();
    }
  });

  if (profileIdParam) {
    inputEl.value = profileIdParam;
    if (displayArea) {
      loadEnt2FullUserProfile(displayArea, isDark, profileIdParam, navTo);
    }
  }
}
