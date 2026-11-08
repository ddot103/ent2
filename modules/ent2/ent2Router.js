// ent2 Page Router & Application Layout Shell

const ENT2_THEME_STORAGE_KEY = 'ent2_theme_mode';
const ENT2_LEGACY_POPUP_THEME_KEY = 'ent2_popup_theme';
let ent2ThemeSyncInitialized = false;
let ent2ThemeTransitionId = 0;
let ent2OriginalDocumentTitle = null;
let ent2OriginalFavicons = null;
let ent2CreatedFavicon = null;

function setEnt2DocumentMetadata(active) {
    if (active) {
        if (ent2OriginalDocumentTitle === null) {
            ent2OriginalDocumentTitle = document.title;
            ent2OriginalFavicons = [...document.querySelectorAll('link[rel~="icon"]')].map((link) => ({
                link,
                href: link.getAttribute('href')
            }));
        }
        document.title = 'ent2 - 유저검색';
        const iconUrl = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
            ? chrome.runtime.getURL('logo.png')
            : '/ent2-extension/logo.png';
        const iconLinks = [...document.querySelectorAll('link[rel~="icon"]')];
        if (iconLinks.length) {
            iconLinks.forEach((link) => link.setAttribute('href', iconUrl));
        } else {
            ent2CreatedFavicon = document.createElement('link');
            ent2CreatedFavicon.rel = 'icon';
            ent2CreatedFavicon.href = iconUrl;
            document.head.appendChild(ent2CreatedFavicon);
        }
        return;
    }

    if (ent2OriginalDocumentTitle !== null) {
        document.title = ent2OriginalDocumentTitle;
        ent2OriginalFavicons?.forEach(({ link, href }) => {
            if (href === null) link.removeAttribute('href');
            else link.setAttribute('href', href);
        });
        if (ent2CreatedFavicon) {
            ent2CreatedFavicon.remove();
            ent2CreatedFavicon = null;
        }
        ent2OriginalDocumentTitle = null;
        ent2OriginalFavicons = null;
    }
}

function normalizeEnt2Theme(theme) {
    return theme === 'light' ? 'light' : 'ash';
}

function getEnt2StoredTheme() {
    const sharedTheme = localStorage.getItem(ENT2_THEME_STORAGE_KEY);
    if (sharedTheme) return normalizeEnt2Theme(sharedTheme);
    const legacyTheme = localStorage.getItem('theme');
    return legacyTheme === 'light' ? 'light' : 'ash';
}

function renderEnt2Theme(theme, animate = true) {
    const selectedTheme = normalizeEnt2Theme(theme);
    const root = document.getElementById('ent2-app-root');
    const transitionId = ++ent2ThemeTransitionId;
    localStorage.setItem(ENT2_THEME_STORAGE_KEY, selectedTheme);
    const applyTheme = () => {
        localStorage.setItem('theme', selectedTheme === 'light' ? 'light' : 'dark');
        document.documentElement.classList.toggle('dark', selectedTheme === 'ash');
        if (root) {
            root.dataset.stateKey = '';
            handleEnt2PageRoute();
        }
    };

    if (!root || !animate) {
        applyTheme();
        return;
    }

    root.classList.add('ent2-theme-fading');
    window.setTimeout(() => {
        if (transitionId !== ent2ThemeTransitionId) return;
        applyTheme();
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => root.classList.remove('ent2-theme-fading'));
        });
    }, 140);
}

function initializeEnt2ThemeSync() {
    if (ent2ThemeSyncInitialized) return;
    ent2ThemeSyncInitialized = true;

    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get([ENT2_THEME_STORAGE_KEY, ENT2_LEGACY_POPUP_THEME_KEY], (stored) => {
        if (chrome.runtime && chrome.runtime.lastError) {
            console.warn('[ent2] Theme settings could not be read:', chrome.runtime.lastError.message);
            return;
        }
        const existingSiteTheme = localStorage.getItem('theme');
        const savedTheme = stored[ENT2_THEME_STORAGE_KEY]
            || stored[ENT2_LEGACY_POPUP_THEME_KEY]
            || (existingSiteTheme === 'light' ? 'light' : 'ash');
        const selectedTheme = normalizeEnt2Theme(savedTheme);
        const previousTheme = getEnt2StoredTheme();
        localStorage.setItem(ENT2_THEME_STORAGE_KEY, selectedTheme);
        localStorage.setItem('theme', selectedTheme === 'light' ? 'light' : 'dark');
        if (!stored[ENT2_THEME_STORAGE_KEY]) {
            chrome.storage.local.set({ [ENT2_THEME_STORAGE_KEY]: selectedTheme });
        }
        if (previousTheme !== selectedTheme && window.location.pathname.startsWith('/ent2')) {
            renderEnt2Theme(selectedTheme, false);
        }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local' || !changes[ENT2_THEME_STORAGE_KEY]) return;
        const selectedTheme = normalizeEnt2Theme(changes[ENT2_THEME_STORAGE_KEY].newValue);
        if (selectedTheme === getEnt2StoredTheme()) return;
        renderEnt2Theme(selectedTheme, true);
    });
}

function getEntrySiteHeader() {
    const headers = document.querySelectorAll('header');
    for (const h of headers) {
        if (!h.closest('#ent2-app-root')) {
            return h;
        }
    }
    return null;
}

function getEnt2ThemeMode() {
    return getEnt2StoredTheme() === 'ash';
}

function handleEnt2PageRoute() {
    const path = window.location.pathname;

    if (!path.startsWith('/ent2')) {
        setEnt2DocumentMetadata(false);
        const existingRoot = document.getElementById('ent2-app-root');
        if (existingRoot) {
            existingRoot.style.display = 'none';
            existingRoot.dataset.stateKey = '';
        }
        const siteHeader = getEntrySiteHeader();
        if (siteHeader) {
            siteHeader.style.display = '';
        }
        const nextApp = document.getElementById('next-app') || document.getElementById('__next');
        if (nextApp) {
            nextApp.style.display = '';
        }
        return;
    }

    setEnt2DocumentMetadata(true);

    const siteHeader = getEntrySiteHeader();
    if (siteHeader) {
        siteHeader.style.display = 'none';
    }

    const nextApp = document.getElementById('next-app') || document.getElementById('__next');
    if (nextApp) {
        nextApp.style.display = 'none';
    }

    let root = document.getElementById('ent2-app-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'ent2-app-root';
        root.style.position = 'fixed';
        root.style.top = '0';
        root.style.left = '0';
        root.style.width = '100vw';
        root.style.height = '100vh';
        root.style.zIndex = '999999';
        root.style.overflowY = 'auto';
        root.style.boxSizing = 'border-box';
        root.style.display = 'flex';
        root.style.flexDirection = 'column';

        if (document.body) {
            document.body.appendChild(root);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (!document.getElementById('ent2-app-root')) {
                    document.body.appendChild(root);
                }
            });
        }
    } else {
        root.style.top = '0';
        root.style.height = '100vh';
        root.style.width = '100vw';
        root.style.display = 'flex';
    }

    let currentTab = 'user';
    let profileIdParam = null;

    if (path.startsWith('/ent2/comm')) {
        currentTab = 'comm';
    } else if (path.startsWith('/ent2/project') || path.startsWith('/ent2/explore')) {
        currentTab = 'project';
    } else if (path.startsWith('/ent2/history') || path.startsWith('/ent2/secret')) {
        currentTab = 'history';
    } else {
        currentTab = 'user';
        if (path.startsWith('/ent2/profile')) {
            const parts = path.split('/ent2/profile/').filter(Boolean);
            if (parts.length > 0) {
                profileIdParam = parts[0].split('/')[0].split('?')[0];
            }
        }
    }

    if (!profileIdParam) {
        const urlParams = new URLSearchParams(window.location.search);
        profileIdParam = urlParams.get('id');
    }

    const isDark = getEnt2ThemeMode() || document.documentElement.classList.contains('dark');
    const stateKey = `${currentTab}_${profileIdParam || ''}_${isDark ? 'dark' : 'light'}`;

    if (root.dataset.stateKey === stateKey && root.querySelector('#ent2-tab-content-area')) {
        return; // Avoid unnecessary re-rendering loop
    }

    renderEnt2AppUI(root, currentTab, profileIdParam);
}

function renderEnt2AppUI(container, currentTab, profileIdParam) {
    container.scrollTop = 0;
    const isDark = getEnt2ThemeMode() || document.documentElement.classList.contains('dark');
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    container.dataset.stateKey = `${currentTab}_${profileIdParam || ''}_${isDark ? 'dark' : 'light'}`;
    container.style.background = isDark ? '#2c2d32' : '#eef2fb';
    container.style.color = isDark ? '#edf2f7' : '#191f28';
    container.style.borderTop = isDark ? '1px solid rgba(148, 163, 184, 0.12)' : '1px solid rgba(15, 23, 42, 0.06)';

    if (!document.getElementById('ent2-responsive-styles-v5')) {
        const style = document.createElement('style');
        style.id = 'ent2-responsive-styles-v5';
        style.textContent = `
            #ent2-app-root .ent2-app-frame {
                --ent2-bg: #2c2d32;
                --ent2-surface: #323339;
                --ent2-raised: #414248;
                --ent2-ink: #f5f6f7;
                --ent2-muted: #a4a6ad;
                --ent2-line: rgba(255,255,255,.09);
                --ent2-accent: #32d27d;
                --ent2-accent-soft: rgba(50,210,125,.13);
                --ent2-shadow: 0 18px 48px rgba(0,0,0,.2);
                min-height: 100vh;
                background: var(--ent2-bg) !important;
                color: var(--ent2-ink) !important;
                font-family: Inter, 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            #ent2-app-root .ent2-app-frame[data-theme="light"] {
                --ent2-bg: #eef2fb;
                --ent2-surface: #fcfdfe;
                --ent2-raised: #ffffff;
                --ent2-ink: #17233c;
                --ent2-muted: #71809b;
                --ent2-line: #e2e8f3;
                --ent2-accent: #3182f6;
                --ent2-accent-soft: #e8f1ff;
                --ent2-shadow: 0 18px 48px rgba(38,63,105,.09);
            }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color:#3182f6"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color: #3182f6"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color:#3b82f6"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color: #3b82f6"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color:#4f7cff"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color: #4f7cff"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color:#60a5fa"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color: #60a5fa"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color:#007aff"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color: #007aff"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color:#2563eb"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color: #2563eb"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color:#93c5fd"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="color: #93c5fd"] {
                color: #32d27d !important;
            }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="background:#3182f6"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="background: #3182f6"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="background:#3b82f6"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="background: #3b82f6"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="background:#4f7cff"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="background: #4f7cff"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="background:#007aff"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="background: #007aff"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] .lite-cat-btn[style*="linear-gradient"] {
                background: #32d27d !important;
                color: #1b2b21 !important;
                box-shadow: 0 6px 18px rgba(50,210,125,.18) !important;
            }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="border-color:#3182f6"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="border-color: #3182f6"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="border:2px solid #4f7cff"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="border: 2px solid #4f7cff"] {
                border-color: #32d27d !important;
            }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="rgba(49,130,246"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="rgba(79,124,255"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="rgba(59,130,246"],
            #ent2-app-root .ent2-app-frame[data-theme="ash"] [style*="rgba(96,165,250"] {
                box-shadow: 0 8px 22px rgba(50,210,125,.14) !important;
            }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] #ent2-user-index-progress {
                background: linear-gradient(90deg, #32d27d, #79e7a9) !important;
            }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] #ent2-user-index-status,
            #ent2-app-root .ent2-app-frame[data-theme="ash"] #ent2-user-index-reopen-btn,
            #ent2-app-root .ent2-app-frame[data-theme="ash"] #ent2-user-search-input,
            #ent2-app-root .ent2-app-frame[data-theme="ash"] #ent2-autocomplete-box {
                border-color: rgba(255,255,255,.09) !important;
                background: #323339 !important;
                color: #f5f6f7 !important;
            }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] #ent2-user-index-status > div:first-child,
            #ent2-app-root .ent2-app-frame[data-theme="ash"] #ent2-user-index-status button,
            #ent2-app-root .ent2-app-frame[data-theme="ash"] #ent2-user-index-text { color: #a4a6ad !important; }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] .ent2-user-index-track { background: #414248 !important; }
            #ent2-app-root .ent2-app-frame[data-theme="light"] #ent2-user-index-status,
            #ent2-app-root .ent2-app-frame[data-theme="light"] #ent2-user-index-reopen-btn,
            #ent2-app-root .ent2-app-frame[data-theme="light"] #ent2-user-search-input,
            #ent2-app-root .ent2-app-frame[data-theme="light"] #ent2-autocomplete-box {
                border-color: #e2e8f3 !important;
                background: #fcfdfe !important;
                color: #17233c !important;
            }
            #ent2-app-root .ent2-app-frame[data-theme="light"] .ent2-user-index-track { background: #e2e8f3 !important; }
            #ent2-app-root .ent2-app-frame,
            #ent2-app-root .ent2-app-frame * { box-sizing: border-box; }
            #ent2-app-root .ent2-app-frame {
                transition: background-color .3s ease, color .3s ease, border-color .3s ease;
            }
            #ent2-app-root.ent2-theme-fading .ent2-app-frame {
                opacity: 0;
                transition: opacity .14s ease;
            }
            #ent2-app-root .ent2-app-frame,
            #ent2-app-root .ent2-app-frame header,
            #ent2-app-root .ent2-app-frame nav,
            #ent2-app-root .ent2-app-frame button,
            #ent2-app-root .ent2-app-frame input,
            #ent2-app-root .ent2-app-frame select,
            #ent2-app-root .ent2-app-frame textarea,
            #ent2-app-root .ent2-app-frame .ent2-page-card {
                transition-property: background-color, color, border-color, box-shadow, opacity;
                transition-duration: .28s;
                transition-timing-function: ease;
            }
            .ent2-header-wrapper {
                max-width: 1260px;
                margin: 0 auto;
                padding: 12px 30px;
                min-height: 78px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 24px;
            }
            .ent2-brand-box {
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                flex-shrink: 0;
            }
            #ent2-app-root .ent2-brand-box img {
                width: 44px !important;
                height: 44px !important;
                border-radius: 15px !important;
                box-shadow: 0 8px 24px var(--ent2-accent-soft) !important;
                border: 1px solid var(--ent2-line) !important;
            }
            .ent2-nav-tabs {
                display: flex;
                gap: 5px;
                align-items: center;
                padding: 5px;
                border: 1px solid var(--ent2-line);
                border-radius: 16px;
                background: var(--ent2-surface);
            }
            #ent2-app-root .ent2-nav-tab-btn {
                min-height: 40px;
                padding: 9px 14px !important;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                border: 1px solid transparent !important;
                border-radius: 11px !important;
                background: transparent !important;
                color: var(--ent2-muted) !important;
                box-shadow: none !important;
                font-size: 12px !important;
                font-weight: 750 !important;
                white-space: nowrap;
            }
            #ent2-app-root .ent2-nav-tab-btn:hover {
                color: var(--ent2-ink) !important;
                background: var(--ent2-raised) !important;
            }
            #ent2-app-root .ent2-nav-tab-btn[data-active="true"] {
                color: var(--ent2-accent) !important;
                border-color: var(--ent2-line) !important;
                background: var(--ent2-accent-soft) !important;
            }
            #ent2-app-root .ent2-right-tools { gap: 9px !important; }
            #ent2-app-root #ent2-theme-toggle-btn,
            #ent2-app-root #ent2-home-app-btn {
                min-height: 39px;
                padding: 0 13px !important;
                border: 1px solid var(--ent2-line) !important;
                border-radius: 12px !important;
                background: var(--ent2-surface) !important;
                color: var(--ent2-ink) !important;
                font-size: 11px !important;
                font-weight: 750 !important;
            }
            #ent2-app-root #ent2-theme-toggle-btn:hover,
            #ent2-app-root #ent2-home-app-btn:hover { border-color: var(--ent2-accent) !important; }
            .ent2-right-tools {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }
            .ent2-main-container {
                max-width: 1260px !important;
                margin: 0 auto !important;
                padding: 28px 30px 64px !important;
            }
            #ent2-app-root .ent2-welcome-banner {
                position: relative;
                overflow: hidden;
                min-height: 158px;
                margin: 0 0 22px;
                padding: 28px 32px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
                border: 1px solid var(--ent2-line);
                border-radius: 24px;
                background: linear-gradient(120deg, var(--ent2-surface) 0%, var(--ent2-raised) 100%);
                box-shadow: var(--ent2-shadow);
            }
            #ent2-app-root .ent2-welcome-banner:after {
                content: "";
                position: absolute;
                width: 240px;
                height: 240px;
                right: -74px;
                top: -128px;
                border: 34px solid var(--ent2-accent-soft);
                border-radius: 50%;
                pointer-events: none;
            }
            #ent2-app-root .ent2-welcome-copy { position: relative; z-index: 1; }
            #ent2-app-root .ent2-welcome-eyebrow {
                color: var(--ent2-accent);
                font-size: 10px;
                font-weight: 850;
                letter-spacing: .16em;
                text-transform: uppercase;
            }
            #ent2-app-root .ent2-welcome-title {
                margin-top: 5px;
                color: var(--ent2-ink);
                font-size: clamp(24px, 3vw, 34px);
                line-height: 1.2;
                font-weight: 850;
                letter-spacing: -.055em;
            }
            #ent2-app-root .ent2-welcome-description {
                margin-top: 7px;
                color: var(--ent2-muted);
                font-size: 13px;
            }
            #ent2-app-root #ent2-tab-content-area > div { gap: 16px !important; }
            #ent2-app-root #ent2-tab-content-area [style*="box-shadow"] {
                box-shadow: var(--ent2-shadow) !important;
            }
            #ent2-app-root #ent2-tab-content-area input:not([type="checkbox"]),
            #ent2-app-root #ent2-tab-content-area select,
            #ent2-app-root #ent2-tab-content-area textarea {
                border-color: var(--ent2-line) !important;
                border-radius: 13px !important;
                background: var(--ent2-bg) !important;
                color: var(--ent2-ink) !important;
                box-shadow: none !important;
            }
            #ent2-app-root #ent2-tab-content-area input:focus,
            #ent2-app-root #ent2-tab-content-area select:focus,
            #ent2-app-root #ent2-tab-content-area textarea:focus {
                border-color: var(--ent2-accent) !important;
                outline: 3px solid var(--ent2-accent-soft) !important;
            }
            #ent2-app-root #ent2-tab-content-area button {
                transition: border-color .18s ease, filter .18s ease, transform .18s ease;
            }
            #ent2-app-root #ent2-tab-content-area button:hover {
                filter: brightness(1.08);
            }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] .ent2-page-card {
                border: 1px solid rgba(255,255,255,.09) !important;
                border-radius: 22px !important;
                background: #323339 !important;
                color: #f5f6f7 !important;
                box-shadow: 0 18px 48px rgba(0,0,0,.2) !important;
            }
            #ent2-app-root .ent2-app-frame[data-theme="light"] .ent2-page-card {
                border: 1px solid #e2e8f3 !important;
                border-radius: 22px !important;
                background: #fcfdfe !important;
                color: #17233c !important;
                box-shadow: 0 18px 48px rgba(38,63,105,.09) !important;
            }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] .ent2-page-card h1,
            #ent2-app-root .ent2-app-frame[data-theme="ash"] .ent2-page-card h2,
            #ent2-app-root .ent2-app-frame[data-theme="ash"] .ent2-page-card h3 { color: #f5f6f7 !important; }
            #ent2-app-root .ent2-app-frame[data-theme="light"] .ent2-page-card h1,
            #ent2-app-root .ent2-app-frame[data-theme="light"] .ent2-page-card h2,
            #ent2-app-root .ent2-app-frame[data-theme="light"] .ent2-page-card h3 { color: #17233c !important; }
            #ent2-app-root .ent2-app-frame[data-theme="ash"] .ent2-page-card p { color: #a4a6ad !important; }
            #ent2-app-root .ent2-app-frame[data-theme="light"] .ent2-page-card p { color: #71809b !important; }
            #ent2-app-root .lite-comm-filter-panel {
                padding: 26px !important;
                border: 1px solid var(--ent2-line) !important;
                border-radius: 22px !important;
                background: var(--ent2-surface) !important;
                box-shadow: var(--ent2-shadow) !important;
            }
            #ent2-app-root .lite-comm-filter-panel h3 { color: var(--ent2-ink) !important; }
            #ent2-app-root .lite-comm-filter-panel p,
            #ent2-app-root .lite-comm-filter-panel label { color: var(--ent2-muted) !important; }
            #ent2-app-root #lite-comm-cat-group {
                padding: 5px !important;
                border-color: var(--ent2-line) !important;
                border-radius: 13px !important;
                background: var(--ent2-bg) !important;
            }
            #ent2-app-root #lite-comm-cat-group .lite-cat-btn {
                min-height: 34px;
                padding: 7px 12px !important;
                border: 1px solid transparent !important;
                border-radius: 9px !important;
                background: transparent !important;
                color: var(--ent2-muted) !important;
                box-shadow: none !important;
                font-weight: 750 !important;
            }
            #ent2-app-root #lite-comm-cat-group .lite-cat-btn[style*="linear-gradient"] {
                border-color: var(--ent2-line) !important;
                background: var(--ent2-accent-soft) !important;
                color: var(--ent2-accent) !important;
            }
            #ent2-app-root .lite-comm-controls-grid {
                gap: 16px !important;
                margin-top: 20px;
            }
            #ent2-app-root .lite-comm-controls-grid > div { min-width: 0; }
            #ent2-app-root .lite-comm-filter-panel input,
            #ent2-app-root .lite-comm-filter-panel select {
                min-height: 42px;
                padding: 10px 13px !important;
                border: 1px solid var(--ent2-line) !important;
                border-radius: 11px !important;
                background: var(--ent2-bg) !important;
                color: var(--ent2-ink) !important;
            }
            #ent2-app-root .lite-comm-filter-panel input::placeholder { color: var(--ent2-muted) !important; opacity: .8; }
            #ent2-app-root .lite-quick-tag-chip {
                padding: 6px 11px !important;
                border-color: var(--ent2-line) !important;
                border-radius: 999px !important;
                background: var(--ent2-bg) !important;
                color: var(--ent2-muted) !important;
            }
            #ent2-app-root .lite-quick-tag-chip:hover {
                border-color: var(--ent2-accent) !important;
                background: var(--ent2-accent-soft) !important;
                color: var(--ent2-accent) !important;
            }
            #ent2-app-root #lite-comm-reset-btn {
                border-color: var(--ent2-line) !important;
                border-radius: 10px !important;
                background: var(--ent2-bg) !important;
            }
            #ent2-app-root #lite-comm-apply-btn {
                border: 0 !important;
                border-radius: 10px !important;
                background: var(--ent2-accent) !important;
                color: var(--ent2-bg) !important;
                box-shadow: none !important;
            }
            #ent2-app-root #lite-comm-results-area {
                margin-top: 18px !important;
                padding: 22px !important;
                border: 1px solid var(--ent2-line) !important;
                border-radius: 22px !important;
                background: var(--ent2-surface) !important;
                box-shadow: var(--ent2-shadow) !important;
            }
            #ent2-app-root #lite-comm-results-area > div:first-child {
                min-height: 46px;
                margin-bottom: 18px !important;
                padding-bottom: 14px;
                border-bottom: 1px solid var(--ent2-line);
            }
            #ent2-app-root #lite-comm-result-title { color: var(--ent2-ink) !important; font-size: 16px !important; }
            #ent2-app-root #lite-comm-result-count {
                border-color: var(--ent2-line) !important;
                background: var(--ent2-bg) !important;
                color: var(--ent2-muted) !important;
            }
            #ent2-app-root #lite-comm-cards-grid {
                grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)) !important;
                gap: 14px !important;
            }
            #ent2-app-root .ent2-comm-result-card {
                min-width: 0;
                padding: 15px !important;
                gap: 13px !important;
                border: 1px solid var(--ent2-line) !important;
                border-radius: 17px !important;
                background: var(--ent2-bg) !important;
                box-shadow: none !important;
                transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
            }
            #ent2-app-root .ent2-comm-result-card:hover {
                transform: translateY(-2px);
                border-color: var(--ent2-accent) !important;
                box-shadow: 0 12px 26px var(--ent2-accent-soft) !important;
            }
            #ent2-app-root .ent2-comm-result-card > div:first-child {
                padding: 8px 10px !important;
                border: 1px solid var(--ent2-line) !important;
                border-radius: 10px !important;
                background: var(--ent2-surface) !important;
            }
            #ent2-app-root .ent2-comm-result-card > div[style*="aspect-ratio"] {
                border-color: var(--ent2-line) !important;
                background: var(--ent2-surface) !important;
            }
            #ent2-app-root .ent2-comm-result-card .ent2-comm-card-title {
                color: var(--ent2-ink) !important;
                font-size: 14px !important;
                line-height: 1.55 !important;
            }
            #ent2-app-root .ent2-comm-result-card .ent2-comm-card-title:hover { color: var(--ent2-accent) !important; }
            #ent2-app-root .ent2-comm-result-card > div:last-child {
                padding-top: 12px !important;
                border-color: var(--ent2-line) !important;
                color: var(--ent2-muted) !important;
            }
            #ent2-app-root .ent2-comm-result-card > div:last-child > div { color: var(--ent2-muted) !important; }
            #ent2-app-root .ent2-comm-result-card .ent2-comm-like-btn,
            #ent2-app-root .ent2-comm-result-card .ent2-comm-info-btn {
                color: var(--ent2-muted) !important;
            }
            #ent2-app-root #lite-comm-pagination { gap: 10px !important; }
            #ent2-app-root #lite-comm-pagination button {
                min-height: 38px;
                padding: 0 14px !important;
                border: 1px solid var(--ent2-line) !important;
                border-radius: 10px !important;
                background: var(--ent2-bg) !important;
                color: var(--ent2-ink) !important;
            }
            #ent2-app-root #lite-comm-pagination button:disabled { opacity: .45; cursor: not-allowed !important; }
            #ent2-app-root #lite-comm-pagination span { color: var(--ent2-muted) !important; }
            #ent2-app-root .ent2-app-footer {
                padding: 24px 0 0;
                color: var(--ent2-muted);
                font-size: 10px;
                font-weight: 650;
                text-align: center;
            }

            @media (max-width: 768px) {
                .ent2-header-wrapper {
                    padding: 12px 16px !important;
                    min-height: 0 !important;
                    display: grid !important;
                    grid-template-columns: 1fr auto !important;
                    gap: 10px 0 !important;
                }
                .ent2-brand-box {
                    grid-column: 1 !important;
                    grid-row: 1 !important;
                }
                .ent2-right-tools {
                    grid-column: 2 !important;
                    grid-row: 1 !important;
                    justify-self: end !important;
                }
                .ent2-nav-tabs {
                    grid-column: 1 / -1 !important;
                    grid-row: 2 !important;
                    width: 100% !important;
                    overflow-x: auto !important;
                    white-space: nowrap !important;
                    scrollbar-width: none !important;
                    -webkit-overflow-scrolling: touch !important;
                    display: flex !important;
                    gap: 6px !important;
                    padding-bottom: 2px !important;
                    border-radius: 13px;
                }
                .ent2-nav-tabs::-webkit-scrollbar {
                    display: none !important;
                }
                .ent2-nav-tab-btn {
                    padding: 8px 12px !important;
                    font-size: 12.5px !important;
                    border-radius: 12px !important;
                    flex-shrink: 0 !important;
                }
                .ent2-main-container {
                    margin: 0 auto !important;
                    padding: 18px 14px 40px !important;
                }
                #ent2-app-root .ent2-welcome-banner {
                    min-height: 132px;
                    padding: 22px 20px;
                    margin-bottom: 16px;
                    border-radius: 19px;
                }
                #ent2-app-root .ent2-welcome-description { max-width: 240px; font-size: 11px; }
                #ent2-app-root .lite-comm-filter-panel,
                #ent2-app-root #lite-comm-results-area { padding: 16px !important; border-radius: 17px !important; }
                #ent2-app-root .lite-comm-controls-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
                #ent2-app-root #lite-comm-cards-grid { grid-template-columns: 1fr !important; }
                .ent2-card-box {
                    padding: 18px 15px !important;
                    border-radius: 18px !important;
                }
                .ent2-search-input-box {
                    padding-right: 94px !important;
                    font-size: 13px !important;
                }
                .ent2-search-btn {
                    padding: 0 12px !important;
                    font-size: 12px !important;
                }
            }
            @media (max-width: 480px) {
                .ent2-header-wrapper { padding: 10px 12px !important; }
                #ent2-app-root .ent2-brand-box img { width: 38px !important; height: 38px !important; }
                #ent2-app-root .ent2-right-tools { gap: 5px !important; }
                #ent2-app-root #ent2-theme-toggle-btn,
                #ent2-app-root #ent2-home-app-btn { min-height: 35px; padding: 0 9px !important; }
                #ent2-app-root .ent2-welcome-banner { min-height: 120px; padding: 18px 16px; }
                #ent2-app-root .ent2-welcome-title { font-size: 24px; }
            }
            @media (prefers-reduced-motion: reduce) {
                #ent2-app-root .ent2-app-frame,
                #ent2-app-root .ent2-app-frame *,
                #ent2-app-root.ent2-theme-fading .ent2-app-frame {
                    transition-duration: .01ms !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    let ent2LogoUrl = '/ent2-extension/logo.png';
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        ent2LogoUrl = chrome.runtime.getURL('logo.png');
    }

    const svgSearch = `<svg style="width:16px; height:16px; display:inline-block; vertical-align:-2px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`;
    const svgChat = `<svg style="width:16px; height:16px; display:inline-block; vertical-align:-2px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`;
    const svgProject = `<svg style="width:16px; height:16px; display:inline-block; vertical-align:-2px;" viewBox="0 0 221 261" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="110.5" cy="110.5" r="92" stroke="currentColor" stroke-width="24" fill="none"/><path d="M158.096 104.619C162.556 106.82 162.556 113.18 158.096 115.381L89.9051 149.03C85.9176 150.998 81.25 148.096 81.25 143.65L81.25 76.3502C81.25 71.9037 85.9176 69.002 89.9051 70.9697L158.096 104.619Z" fill="currentColor"/><path d="M110.5 261L73.6939 201.75H147.306L110.5 261Z" fill="currentColor"/></svg>`;
    const svgHistory = `<svg style="width:16px; height:16px; display:inline-block; vertical-align:-2px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    const svgSun = `<svg style="width:15px; height:15px; display:inline-block; vertical-align:-2px; color:#f59e0b;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;
    const svgMoon = `<svg style="width:15px; height:15px; display:inline-block; vertical-align:-2px; color:#3182f6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`;
    const svgHome = `<svg style="width:16px; height:16px; display:inline-block; vertical-align:-2px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`;

    const pageCopy = {
        user: ['FIND YOUR ENTRY', '유저 검색', '닉네임이나 유저 ID로 프로필을 빠르게 찾아보세요.'],
        comm: ['COMMUNITY DISCOVERY', '커뮤니티 탐색', '엔트리 커뮤니티의 이야기를 조건별로 살펴보세요.'],
        project: ['PROJECT EXPLORER', '작품 탐색', '인기 작품과 다양한 프로젝트를 원하는 조건으로 찾아보세요.'],
        history: ['YOUR RECENT ACTIVITY', '검색 기록', '최근에 확인한 프로필을 다시 찾아볼 수 있습니다.']
    }[currentTab] || ['ENT2 EXTENSION', 'ent2 탐색', '엔트리의 프로필과 작품을 한곳에서 탐색하세요.'];

    container.innerHTML = `
        <div class="ent2-app-frame" data-theme="${isDark ? 'ash' : 'light'}" style="min-height:100vh; background:${isDark ? '#2c2d32' : '#eef2fb'}; color:${isDark ? '#f2f4f6' : '#16213e'};">
            <header style="background:${isDark ? 'rgba(50,51,57,0.5)' : 'rgba(255,255,255,0.85)'}; backdrop-filter:blur(10px); border-bottom:1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.18)'}; position:sticky; top:0; z-index:50;">
                <div class="ent2-header-wrapper" style="max-width:1120px; margin:0 auto; padding:10px 18px; display:flex; align-items:center; justify-content:space-between; gap:16px;">
                    <div id="ent2-brand-home-btn" class="ent2-brand-box" style="display:flex; align-items:center; gap:12px; cursor:pointer; flex-shrink:0;">
                        <img src="${ent2LogoUrl}" alt="ent2 Logo" style="width:40px; height:40px; border-radius:12px; object-fit:cover; box-shadow:0 8px 20px rgba(15,23,42,0.15); border:1px solid ${isDark ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.2)'}; background:${isDark ? '#111827' : '#f5f8ff'};">
                        <div style="display:flex; align-items:baseline; gap:8px;">
                            <span style="font-size:20px; font-weight:800; font-family:-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; letter-spacing:-0.04em; color:${isDark ? '#f8fafc' : '#172033'};">ent2</span>
                            <span style="font-size:10.5px; font-weight:800; background:${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(49,130,246,0.1)'}; color:${isDark ? '#e2e8f0' : '#3182f6'}; padding:3px 8px; border-radius:999px;">ext</span>
                        </div>
                    </div>

                    <nav class="ent2-nav-tabs" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center;">
                        <button id="ent2-tab-user-btn" class="ent2-nav-tab-btn" data-active="${currentTab === 'user'}" aria-current="${currentTab === 'user' ? 'page' : 'false'}">
                            ${svgSearch} <span style="margin-left:4px;">유저 검색</span>
                        </button>
                        <button id="ent2-tab-comm-btn" class="ent2-nav-tab-btn" data-active="${currentTab === 'comm'}" aria-current="${currentTab === 'comm' ? 'page' : 'false'}">
                            ${svgChat} <span style="margin-left:4px;">커뮤니티 탐색</span>
                        </button>
                        <button id="ent2-tab-project-btn" class="ent2-nav-tab-btn" data-active="${currentTab === 'project'}" aria-current="${currentTab === 'project' ? 'page' : 'false'}">
                            ${svgProject} <span style="margin-left:4px;">작품 탐색</span>
                        </button>
                        <button id="ent2-tab-history-btn" class="ent2-nav-tab-btn" data-active="${currentTab === 'history'}" aria-current="${currentTab === 'history' ? 'page' : 'false'}">
                            ${svgHistory} <span style="margin-left:4px;">검색 기록</span>
                        </button>
                    </nav>

                    <div class="ent2-right-tools" style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                        <button id="ent2-theme-toggle-btn" style="padding:8px 12px; border-radius:12px; border:1px solid ${isDark ? 'rgba(148,163,184,0.18)' : '#dfe7f5'}; background:${isDark ? '#1b1f29' : '#eef4ff'}; color:${isDark ? '#e2e8f0' : '#3c4b69'}; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:5px;">
                            ${isDark ? svgSun : svgMoon}
                            <span>${isDark ? '화이트' : '애시'}</span>
                        </button>
                        <a href="https://playentry.org" id="ent2-home-app-btn" style="padding:8px 14px; border-radius:12px; background:${isDark ? '#1d2430' : '#e8f3ff'}; font-size:12px; font-weight:700; color:${isDark ? '#e2e8f0' : '#3182f6'}; text-decoration:none; white-space:nowrap; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s ease;">
                            ${svgHome}
                            <span>홈</span>
                        </a>
                    </div>
                </div>
            </header>

            <main class="ent2-main-container" style="max-width:1120px; width:100%; margin:24px auto 40px; padding:0 18px; box-sizing:border-box;">
                <section class="ent2-welcome-banner">
                    <div class="ent2-welcome-copy">
                        <div class="ent2-welcome-eyebrow">${pageCopy[0]}</div>
                        <h1 class="ent2-welcome-title">${pageCopy[1]}</h1>
                        <p class="ent2-welcome-description">${pageCopy[2]}</p>
                    </div>
                </section>
                <div id="ent2-tab-content-area"></div>
                <footer class="ent2-app-footer">ent2 extension <span aria-hidden="true">·</span> 더 편리한 엔트리 탐색</footer>
            </main>
        </div>
    `;

    const navTo = (url) => {
        window.history.pushState({}, '', url);
        handleEnt2PageRoute();
    };

    const homeAppBtn = container.querySelector('#ent2-home-app-btn');
    if (homeAppBtn) {
        homeAppBtn.onclick = (e) => {
            e.preventDefault();
            window.location.href = 'https://playentry.org';
        };
    }

    container.querySelector('#ent2-brand-home-btn').onclick = () => navTo('/ent2');
    container.querySelector('#ent2-tab-user-btn').onclick = () => navTo('/ent2/user');
    container.querySelector('#ent2-tab-comm-btn').onclick = () => navTo('/ent2/comm');
    container.querySelector('#ent2-tab-project-btn').onclick = () => navTo('/ent2/project');
    container.querySelector('#ent2-tab-history-btn').onclick = () => navTo('/ent2/history');

    container.querySelector('#ent2-theme-toggle-btn').onclick = () => {
        const nextTheme = isDark ? 'light' : 'ash';
        renderEnt2Theme(nextTheme, true);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [ENT2_THEME_STORAGE_KEY]: nextTheme }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    console.warn('[ent2] Theme settings could not be saved:', chrome.runtime.lastError.message);
                }
            });
        }
    };

    const contentArea = container.querySelector('#ent2-tab-content-area');
    if (currentTab === 'user') {
        renderEnt2UserSearchTab(contentArea, isDark, profileIdParam, navTo);
    } else if (currentTab === 'comm') {
        renderEnt2CommTab(contentArea, isDark, navTo);
    } else if (currentTab === 'project') {
        if (typeof renderEnt2ProjectExploreTab === 'function') {
            renderEnt2ProjectExploreTab(contentArea, isDark, navTo);
        } else {
            contentArea.innerHTML = '<div style="padding:40px; text-align:center;">작품 모듈 로딩 중...</div>';
        }
    } else {
        renderEnt2SearchHistoryTab(contentArea, isDark, navTo);
    }
}

window.addEventListener('popstate', handleEnt2PageRoute);
window.addEventListener('hashchange', handleEnt2PageRoute);
initializeEnt2ThemeSync();

if (typeof ent2LastPath === 'undefined') {
    var ent2LastPath = window.location.pathname;
}
setInterval(() => {
    if (window.location.pathname !== ent2LastPath) {
        ent2LastPath = window.location.pathname;
        handleEnt2PageRoute();
    }
}, 300);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleEnt2PageRoute);
} else {
    handleEnt2PageRoute();
}

// /ent2 로 향하는 링크 클릭 시 playentry.org 서버로 HTTP GET 요청(404/새로고침)이 나가는 것을 차단
document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href) return;

    if (href.startsWith('/ent2') || href.includes('playentry.org/ent2')) {
        e.preventDefault();
        e.stopPropagation();

        let targetPath = href;
        if (href.startsWith('http')) {
            try {
                const u = new URL(href);
                targetPath = u.pathname + u.search + u.hash;
            } catch (err) {}
        }

        if (window.location.pathname + window.location.search !== targetPath) {
            window.history.pushState(null, '', targetPath);
        }
        if (typeof handleEnt2PageRoute === 'function') {
            handleEnt2PageRoute();
        }
    }
}, true);
