// ent2 Storage & Global Helper Utility Module
if (typeof Ent2Storage === 'undefined') {
    var Ent2Storage = {
        get: async (key, defaultValue = null) => {
            return new Promise((resolve) => {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get([key], (result) => {
                        resolve(result[key] !== undefined ? result[key] : defaultValue);
                    });
                } else {
                    try {
                        const item = localStorage.getItem(key);
                        resolve(item ? JSON.parse(item) : defaultValue);
                    } catch (e) {
                        resolve(defaultValue);
                    }
                }
            });
        },
        set: async (key, value) => {
            return new Promise((resolve) => {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ [key]: value }, () => resolve());
                } else {
                    try {
                        localStorage.setItem(key, JSON.stringify(value));
                    } catch (e) {}
                    resolve();
                }
            });
        }
    };
}

function getCSRFToken() {
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (metaToken) return metaToken;
    const cookieMatch = document.cookie.match(/csrfToken=([^;]+)/);
    if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
    return null;
}

function getPlayEntryFetchHeaders() {
    const headers = {
        'Content-Type': 'application/json',
        'x-client-type': 'Client'
    };
    const csrf = getCSRFToken();
    if (csrf) headers['csrf-token'] = csrf;
    return headers;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function isSafeImageOrLinkUrl(rawUrl) {
    if (!rawUrl) return false;
    const value = String(rawUrl).trim();
    if (!value) return false;
    if (/^(javascript:|vbscript:|data:|filesystem:)/i.test(value)) return false;
    try {
        const url = new URL(value, window.location.href);
        const protocol = url.protocol.toLowerCase();
        return ['http:', 'https:', 'mailto:'].includes(protocol) || value.startsWith('/');
    } catch (e) {
        return false;
    }
}

function normalizeSafeEnt2AssetUrl(rawUrl, fallback = '') {
    if (!rawUrl) return fallback;
    const value = String(rawUrl).trim();
    if (!value) return fallback;
    if (!isSafeImageOrLinkUrl(value)) return fallback;
    try {
        const url = new URL(value, window.location.href);
        return url.toString();
    } catch (e) {
        return value.startsWith('/') ? `https://playentry.org${value}` : value;
    }
}

function stripUnsafeHtmlAttributes(doc) {
    if (!doc || !doc.querySelectorAll) return;
    doc.querySelectorAll('*').forEach((el) => {
        Array.from(el.attributes || []).forEach((attr) => {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on')) {
                el.removeAttribute(attr.name);
                return;
            }
            if (['src', 'href', 'xlink:href', 'data-src'].includes(name)) {
                const value = attr.value.trim();
                if (value && !isSafeImageOrLinkUrl(value)) {
                    el.removeAttribute(attr.name);
                }
            }
        });
    });
    doc.querySelectorAll('script, style, iframe, object, embed, svg').forEach((el) => {
        el.remove();
    });
}
