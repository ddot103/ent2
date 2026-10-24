// ent2 Page Router & Application Layout Shell

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
    const saved = localStorage.getItem('theme');
    if (saved === 'light') return false;
    if (saved === 'dark') return true;
    return window.location.pathname.startsWith('/ent2');
}

function handleEnt2PageRoute() {
    const path = window.location.pathname;

    if (!path.startsWith('/ent2')) {
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

    document.title = "ent2 : 엔트리 검색";

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
    container.style.background = isDark
        ? 'radial-gradient(circle at top, #171b20 0%, #101317 24%, #090b0e 100%)'
        : '#f3f5f8';
    container.style.color = isDark ? '#edf2f7' : '#191f28';
    container.style.borderTop = isDark ? '1px solid rgba(148, 163, 184, 0.12)' : '1px solid rgba(15, 23, 42, 0.06)';

    if (!document.getElementById('ent2-responsive-styles')) {
        const style = document.createElement('style');
        style.id = 'ent2-responsive-styles';
        style.textContent = `
            .ent2-header-wrapper {
                max-width: 1100px;
                margin: 0 auto;
                padding: 0 24px;
                height: 68px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }
            .ent2-brand-box {
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                flex-shrink: 0;
            }
            .ent2-nav-tabs {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .ent2-right-tools {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }

            @media (max-width: 768px) {
                .ent2-header-wrapper {
                    padding: 10px 14px !important;
                    height: auto !important;
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
                    margin: 12px auto !important;
                    padding: 0 10px !important;
                }
                .ent2-card-box {
                    padding: 18px 14px !important;
                    border-radius: 20px !important;
                }
                .ent2-search-input-box {
                    padding-right: 90px !important;
                    font-size: 13.5px !important;
                }
                .ent2-search-btn {
                    padding: 0 14px !important;
                    font-size: 12.5px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const getTabBtnStyle = (tabKey) => {
        const active = currentTab === tabKey;
        if (isDark) {
            return active
                ? 'padding:10px 18px; border-radius:12px; font-size:14px; font-weight:700; border:1px solid rgba(148,163,184,0.2); cursor:pointer; transition:all 0.2s ease; background:linear-gradient(180deg, #232a31 0%, #1a1f26 100%); color:#f8fafc; box-shadow:0 6px 18px rgba(15,23,42,0.32);'
                : 'padding:10px 18px; border-radius:12px; font-size:14px; font-weight:700; border:1px solid rgba(148,163,184,0.12); cursor:pointer; transition:all 0.2s ease; background:rgba(15,23,42,0.45); color:#d9e0ea;';
        }
        return active
            ? 'padding:10px 18px; border-radius:12px; font-size:14px; font-weight:700; border:none; cursor:pointer; transition:all 0.2s ease; background:#e2e8f0; color:#0f172a; box-shadow:0 8px 20px rgba(148,163,184,0.18);'
            : 'padding:10px 18px; border-radius:12px; font-size:14px; font-weight:700; border:none; cursor:pointer; transition:all 0.2s ease; background:rgba(148,163,184,0.12); color:#475569;';
    };

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

    container.innerHTML = `
        <div style="min-height:100vh; background:${isDark ? '#0d1117' : '#eef2fb'}; color:${isDark ? '#f2f4f6' : '#16213e'};">
            <header style="background:${isDark ? 'rgba(17,24,39,0.82)' : 'rgba(255,255,255,0.85)'}; backdrop-filter:blur(18px); border-bottom:1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.18)'}; position:sticky; top:0; z-index:50;">
                <div class="ent2-header-wrapper" style="max-width:1120px; margin:0 auto; padding:10px 18px; display:flex; align-items:center; justify-content:space-between; gap:16px;">
                    <div id="ent2-brand-home-btn" class="ent2-brand-box" style="display:flex; align-items:center; gap:12px; cursor:pointer; flex-shrink:0;">
                        <img src="${ent2LogoUrl}" alt="ent2 Logo" style="width:40px; height:40px; border-radius:12px; object-fit:cover; box-shadow:0 8px 20px rgba(15,23,42,0.15); border:1px solid ${isDark ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.2)'}; background:${isDark ? '#111827' : '#f5f8ff'};">
                        <div style="display:flex; align-items:baseline; gap:8px;">
                            <span style="font-size:20px; font-weight:800; font-family:-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; letter-spacing:-0.04em; color:${isDark ? '#f8fafc' : '#172033'};">ent2</span>
                            <span style="font-size:10.5px; font-weight:800; background:${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(49,130,246,0.1)'}; color:${isDark ? '#e2e8f0' : '#3182f6'}; padding:3px 8px; border-radius:999px;">ext</span>
                        </div>
                    </div>

                    <nav class="ent2-nav-tabs" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center;">
                        <button id="ent2-tab-user-btn" class="ent2-nav-tab-btn" style="${getTabBtnStyle('user')}">
                            ${svgSearch} <span style="margin-left:4px;">유저 검색</span>
                        </button>
                        <button id="ent2-tab-comm-btn" class="ent2-nav-tab-btn" style="${getTabBtnStyle('comm')}">
                            ${svgChat} <span style="margin-left:4px;">커뮤니티 탐색</span>
                        </button>
                        <button id="ent2-tab-project-btn" class="ent2-nav-tab-btn" style="${getTabBtnStyle('project')}">
                            ${svgProject} <span style="margin-left:4px;">작품 탐색</span>
                        </button>
                        <button id="ent2-tab-history-btn" class="ent2-nav-tab-btn" style="${getTabBtnStyle('history')}">
                            ${svgHistory} <span style="margin-left:4px;">검색 기록</span>
                        </button>
                    </nav>

                    <div class="ent2-right-tools" style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                        <button id="ent2-theme-toggle-btn" style="padding:8px 12px; border-radius:12px; border:1px solid ${isDark ? 'rgba(148,163,184,0.18)' : '#dfe7f5'}; background:${isDark ? '#1b1f29' : '#eef4ff'}; color:${isDark ? '#e2e8f0' : '#3c4b69'}; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:5px;">
                            ${isDark ? svgSun : svgMoon}
                            <span>${isDark ? '라이트' : '다크'}</span>
                        </button>
                        <a href="https://playentry.org" id="ent2-home-app-btn" style="padding:8px 14px; border-radius:12px; background:${isDark ? '#1d2430' : '#e8f3ff'}; font-size:12px; font-weight:700; color:${isDark ? '#e2e8f0' : '#3182f6'}; text-decoration:none; white-space:nowrap; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s ease;">
                            ${svgHome}
                            <span>홈</span>
                        </a>
                    </div>
                </div>
            </header>

            <main class="ent2-main-container" style="max-width:1120px; width:100%; margin:24px auto 40px; padding:0 18px; box-sizing:border-box;">
                <div id="ent2-tab-content-area"></div>
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
        const nextDark = !isDark;
        localStorage.setItem('theme', nextDark ? 'dark' : 'light');
        if (nextDark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        container.dataset.stateKey = '';
        renderEnt2AppUI(container, currentTab, profileIdParam);
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
