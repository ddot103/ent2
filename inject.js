(function() {
    console.log("[LiteEntry] Injected script successfully loaded in MAIN world");

    // ==========================================
    // Fetch & XHR 429 Interceptor (MAIN World)
    // ==========================================
    (function setupFetchAndXHRInterceptor() {
        if (window.__liteEntryFetchInterceptorInjected) return;
        window.__liteEntryFetchInterceptorInjected = true;

        function check429(data) {
            if (!data) return false;
            if (data.statusCode == 429) return true;
            if (Array.isArray(data.errors)) {
                return data.errors.some(e => {
                    if (!e) return false;
                    if (e.statusCode == 429 || e.code == 429 || e.status == 429) return true;
                    if (e.extensions && (e.extensions.statusCode == 429 || e.extensions.code == 429)) return true;
                    if (e.message && (String(e.message).includes("429") || String(e.message).includes("제한") || String(e.message).includes("도배"))) return true;
                    return false;
                });
            }
            return false;
        }

        function notifyRestricted() {
            window.dispatchEvent(new CustomEvent('liteentry_post_restricted_event', { detail: { timestamp: Date.now() } }));
        }

        // 1. Fetch Interceptor
        const origFetch = window.fetch;
        window.fetch = async function(...args) {
            const response = await origFetch.apply(this, args);
            try {
                const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
                const reqBody = typeof args[1]?.body === 'string' ? args[1].body : '';
                const isTargetMutation = url.includes('/graphql') || url.includes('CREATE_ENTRYSTORY') || reqBody.includes('CREATE_ENTRYSTORY') || reqBody.includes('addEntryStory') || reqBody.includes('createEntryStory');
                
                let is429 = (response.status === 429);

                if (isTargetMutation || is429 || url.includes('/graphql')) {
                    const cloned = response.clone();
                    cloned.json().then(data => {
                        if (is429 || check429(data)) {
                            notifyRestricted();
                        }
                    }).catch(() => {
                        if (is429) {
                            notifyRestricted();
                        }
                    });
                }
            } catch(e) {}
            return response;
        };

        // 2. XMLHttpRequest Interceptor
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url) {
            this.__liteUrl = url;
            return origOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function(body) {
            this.addEventListener('load', function() {
                try {
                    if (this.status === 429) {
                        notifyRestricted();
                    } else if (this.responseText && (this.__liteUrl || '').includes('/graphql')) {
                        const data = JSON.parse(this.responseText);
                        if (check429(data)) {
                            notifyRestricted();
                        }
                    }
                } catch(e) {}
            });
            return origSend.apply(this, arguments);
        };
    })();

    const REQUIRED_ORIGIN = 'https://playentry.org';
    const REQUIRED_PATH = '/community/entrystory/list';
    const SELECT_URL = 'https://playentry.org/graphql/SELECT_ENTRYSTORY';
    const CREATE_URL = 'https://playentry.org/graphql/CREATE_ENTRYSTORY';
    const PREVIEW_CLASS = 'entry-preview-card';
    const CONTROL_ID = 'entry-preview-confirm';
    const STYLE_ID = 'entry-preview-style';
    const DEFAULT_PROFILE = 'https://playentry.org/img/DefaultCardUserThmb.svg';
    const EXTENSIONS = ['png', 'jpg', 'gif', 'jpeg'];

    let lastPostId = null;
    let previewRunning = false;
    let hasConfirmedPreview = true;
    let checkTimer = null;
    let routeTimer = null;
    let stoppedForUrlChange = false;
    let isLiveStoryActive = false;
    let isLiveStoryInitialized = false;
    let liveStoryAutoStart = true;
    let isLiveStoryRunningState = true;

    const originalFetch = window.fetch.bind(window);

    function isRequiredUrl() {
        try {
            const url = new URL(window.location.href);
            // Must be exactly /community/entrystory/list to prevent execution on other unnecessary routes
            const isBase = url.origin === REQUIRED_ORIGIN && url.pathname === REQUIRED_PATH;
            if (!isBase) return false;

            const sort = url.searchParams.get('sort');
            const term = url.searchParams.get('term');
            const q = url.searchParams.get('q');

            // Exactly sort=created and term=all parameter required, non-searching
            return sort === 'created' && term === 'all' && !q;
        } catch (e) {
            return false;
        }
    }

    function isFocused() {
        // Multi-monitor support: updates running as long as the page is visible (not fully hidden/minimized)
        return document.visibilityState !== 'hidden';
    }

    function showEntryPreviewConfirm(onConfirm, onCancel) {
        // Remove existing modal if any to avoid duplication
        const existing = document.getElementById('lite-entry-confirm-modal');
        if (existing) existing.remove();

        if (!document.getElementById('nanum-gothic-font-link')) {
            const fontLink = document.createElement('link');
            fontLink.id = 'nanum-gothic-font-link';
            fontLink.href = 'https://hangeul.pstatic.net/hangeul_static/css/nanum-gothic.css';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }

        const modal = document.createElement('div');
        modal.id = 'lite-entry-confirm-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 999999; backdrop-filter: blur(4px); font-family: "NanumGothic", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; transition: opacity 0.25s ease-in-out;';
        
        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 20px; padding: 28px 24px; width: 340px; box-sizing: border-box; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.05); text-align: center; transform: scale(0.95); opacity: 0; transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-in-out;">
                <h3 style="font-size: 17px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; line-height: 1.4;">실시간 미리보기 서비스</h3>
                <p style="font-size: 13.5px; color: #64748b; margin: 0 0 24px 0; line-height: 1.5; word-break: keep-all;">엔트리 이야기 실시간 글 미리보기를 시작하시겠습니까?</p>
                <div style="display: flex; gap: 8px;">
                    <button id="lite-entry-confirm-no" style="flex: 1; padding: 11px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: all 0.2s;">나중에</button>
                    <button id="lite-entry-confirm-yes" style="flex: 1; padding: 11px; border-radius: 10px; border: none; background: #16d8a3; color: #ffffff; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(22, 216, 163, 0.2);">시작하기</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => {
            const inner = modal.querySelector('div');
            if (inner) {
                inner.style.transform = 'scale(1)';
                inner.style.opacity = '1';
            }
        }, 10);

        const closeWithAnim = (callback) => {
            const inner = modal.querySelector('div');
            if (inner) {
                inner.style.transform = 'scale(0.95)';
                inner.style.opacity = '0';
            }
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.remove();
                if (callback) callback();
            }, 250);
        };

        modal.querySelector('#lite-entry-confirm-yes')?.addEventListener('click', () => {
            closeWithAnim(onConfirm);
        });
        modal.querySelector('#lite-entry-confirm-no')?.addEventListener('click', () => {
            closeWithAnim(onCancel);
        });
        modal.style.opacity = '1';
    }

    function stopPreview(isManual = false) {
        previewRunning = false;
        if (isManual) {
            isLiveStoryRunningState = false;
        }
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
    }

    function removePreviews() {
        document.querySelectorAll('.' + PREVIEW_CLASS).forEach(card => card.remove());
    }

    function shutdownAndClear() {
        stopPreview();
        removePreviews();
        const control = document.getElementById(CONTROL_ID);
        if (control) control.remove();
    }

    function clearPreviewsAfterPost() {
        lastPostId = null;
        removePreviews();
    }

    function stopForUrlChange() {
        stoppedForUrlChange = true;
        hasConfirmedPreview = false;
        shutdownAndClear();
        if (routeTimer) {
            clearInterval(routeTimer);
            routeTimer = null;
        }
    }

    function getCsrfToken() {
        return window.__NEXT_DATA__?.props?.initialState?.common?.csrfToken ||
            window.__NEXT_DATA__?.props?.pageProps?.csrfToken ||
            document.querySelector('meta[name="csrf-token"]')?.content ||
            document.querySelector('meta[name="csrf"]')?.content;
    }

    function exposeTokensToDOM() {
        try {
            const csrfToken = getCsrfToken() ||
                localStorage.getItem('csrf-token') ||
                localStorage.getItem('csrfToken') || '';

            const userToken = window.__NEXT_DATA__?.props?.initialState?.common?.user?.token ||
                window.__NEXT_DATA__?.props?.initialState?.common?.token ||
                localStorage.getItem('x-entry-token') ||
                localStorage.getItem('entryToken') ||
                localStorage.getItem('token') || '';

            if (csrfToken) document.documentElement.dataset.csrfToken = csrfToken;
            if (userToken) document.documentElement.dataset.userToken = userToken;
        } catch(e) {}
    }
    exposeTokensToDOM();
    setInterval(exposeTokensToDOM, 1000);

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        })[char]);
    }

    function stripTags(value) {
        const div = document.createElement('div');
        div.innerHTML = value || '';
        return div.textContent || div.innerText || '';
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const yy = String(date.getFullYear()).slice(2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return yy + '.' + mm + '.' + dd + ' ・ ' + hh + ':' + min;
    }

    function processLinks(text) {
        const safeText = escapeHtml(text);
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        return safeText.replace(urlRegex, url => {
            const finalUrl = url.includes('playentry.org')
                ? url
                : 'https://playentry.org/redirect?external=' + encodeURIComponent(url);
            return '<a target="_blank" href="' + finalUrl + '" rel="noreferrer">' + url + '</a>';
        });
    }

    function getAssetPath(filename) {
        if (!filename) return null;
        const p1 = filename.slice(0, 2);
        const p2 = filename.slice(2, 4);
        return 'https://playentry.org/uploads/' + p1 + '/' + p2 + '/' + filename;
    }

    function testImage(src) {
        return new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve(true);
            image.onerror = () => resolve(false);
            image.src = src;
        });
    }

    async function tryLoadImage(imgDiv, filename) {
        if (!imgDiv) return;
        if (!filename) {
            imgDiv.style.backgroundImage = 'url("' + DEFAULT_PROFILE + '"), url("/img/EmptyImage.svg")';
            return;
        }

        const baseUrl = getAssetPath(filename);
        if (await testImage(baseUrl + '.svg')) {
            imgDiv.style.backgroundImage = 'url("' + baseUrl + '.svg"), url("/img/EmptyImage.svg")';
            return;
        }

        for (const ext of EXTENSIONS) {
            const src = baseUrl + '.' + ext;
            if (await testImage(src)) {
                imgDiv.style.backgroundImage = 'url("' + src + '"), url("/img/EmptyImage.svg")';
                return;
            }
        }

        imgDiv.style.backgroundImage = 'url("' + DEFAULT_PROFILE + '"), url("/img/EmptyImage.svg")';
    }

    async function resolveAssetUrl(filename) {
        if (!filename) return null;

        const baseUrl = getAssetPath(filename);
        if (await testImage(baseUrl + '.svg')) return baseUrl + '.svg';

        for (const ext of EXTENSIONS) {
            const src = baseUrl + '.' + ext;
            if (await testImage(src)) return src;
        }

        return null;
    }

    async function tryLoadSticker(img, filename) {
        if (!img || !filename) return;
        const src = await resolveAssetUrl(filename);
        if (src) {
            img.src = src;
            img.hidden = false;
        } else {
            img.remove();
        }
    }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            @keyframes entryPreviewSlideDown {
                from { opacity: 0; transform: translateY(-14px); }
                to { opacity: 1; transform: translateY(0); }
            }
            #${CONTROL_ID} {
                box-sizing: border-box;
                width: 1062px;
                max-width: calc(100% - 32px);
                min-height: 52px;
                margin: 12px auto 18px;
                padding: 10px 16px;
                border: 1px solid #c2f4e3;
                border-left: 5px solid #16d8a3;
                border-radius: 8px;
                background: #f0fdf9;
                box-shadow: 0 4px 12px rgba(22, 216, 163, 0.06);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                font-size: 13px;
                font-weight: 600;
                color: #115e49;
            }
            #${CONTROL_ID} .entry-preview-message {
                display: flex;
                align-items: center;
                gap: 8px;
                line-height: 1.5;
            }
            #${CONTROL_ID} .entry-preview-actions {
                display: flex;
                gap: 6px;
                flex-shrink: 0;
            }
            #${CONTROL_ID} button {
                height: 30px;
                padding: 0 12px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.15s ease;
                border: 1px solid transparent;
            }
            .btn-preview-toggle {
                background: #16d8a3;
                color: #fff;
            }
            .btn-preview-toggle:hover {
                background: #12c696;
            }
            .btn-preview-clear {
                background: #fff;
                color: #115e49;
                border: 1px solid #a7edd5 !important;
            }
            .btn-preview-clear:hover {
                background: #e1fbf2;
            }
            .${PREVIEW_CLASS} {
                border: 2px solid #16d8a3 !important;
                animation: entryPreviewSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                position: relative;
                margin-top: 18px;
                list-style: none;
                background-color: #f6fdfb !important;
            }
            .entry-preview-badge {
                position: absolute;
                right: 20px;
                top: 20px;
                background: #16d8a3;
                color: #fff;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 700;
                z-index: 10;
                letter-spacing: 0.5px;
            }
        `;
        (document.head || document.documentElement)?.appendChild(style);
    }

    function findTitle() {
        return Array.from(document.querySelectorAll('h2'))
            .find(el => el.textContent.includes('엔트리 이야기'));
    }

    function findInsertTarget() {
        // 1순위: 엔트리 이야기 타이틀 블록 뒤
        const title = findTitle();
        if (title) return title.parentElement || title;

        // 2순위: 필터/글 정렬 탭바 위
        const tabFilters = document.querySelector('div[class*="Filter"]') || document.querySelector('div[class*="Tab"]');
        if (tabFilters) return tabFilters;

        // 3순위: 목록 컨테이너 바로 앞
        const list = getListContainer();
        if (list) return list;

        return null;
    }

    function updateTitleTotal(total) {
        if (!Number.isFinite(total)) return;
        const title = findTitle();
        if (!title) return;
        title.textContent = '엔트리 이야기 (' + total.toLocaleString('ko-KR') + ')';
    }

    function updateControlUI() {
        try {
            window.postMessage({ type: 'LITEENTRY_LIVESTORY_STATUS_CHANGED', running: previewRunning }, "*");
        } catch (e) {}

        const btnToggle = document.getElementById('entry-preview-toggle-btn');
        const statusLabel = document.getElementById('entry-preview-status-txt');
        if (!btnToggle || !statusLabel) return;

        if (previewRunning) {
            statusLabel.innerHTML = '<strong>라이브 스토리 실시간 연동 중</strong> (새 포스트가 작성되면 페이지 이동 없이 리스트 위에 브리핑됩니다.)';
            btnToggle.textContent = '일시 정지';
            btnToggle.style.background = '#e1fbf2';
            btnToggle.style.color = '#115e49';
            btnToggle.style.border = '1px solid #a7edd5';
        } else {
            statusLabel.innerHTML = '<strong>실시간 연동 일시 정지됨</strong>';
            btnToggle.textContent = '실시간 모니터링 재개';
            btnToggle.style.background = '#16d8a3';
            btnToggle.style.color = '#fff';
            btnToggle.style.border = '1px solid transparent';
        }
    }

    function mountControl() {
        if (!isRequiredUrl()) return false;
        
        // 기존 컨트롤바가 이미 있으면 상태 UI만 동기화
        if (document.getElementById(CONTROL_ID)) {
            updateControlUI();
            return true;
        }

        const target = findInsertTarget();
        if (!target) return false;

        injectStyle();

        const control = document.createElement('div');
        control.id = CONTROL_ID;
        control.style.display = 'none';
        control.innerHTML = `
            <span class="entry-preview-message" id="entry-preview-status-txt">
                <strong>라이브 스토리 실시간 연동 중</strong>
            </span>
            <span class="entry-preview-actions">
                <button type="button" class="btn-preview-clear" id="entry-preview-clear-btn" title="감지된 모든 미리보기 카드 지우기">미리보기 비우기</button>
                <button type="button" class="btn-preview-toggle" id="entry-preview-toggle-btn">일시 정지</button>
            </span>
        `;

        target.insertAdjacentElement('afterend', control);

        // 이벤트 바인딩
        document.getElementById('entry-preview-toggle-btn')?.addEventListener('click', () => {
            if (previewRunning) {
                stopPreview();
            } else {
                hasConfirmedPreview = true;
                startPreview();
            }
            updateControlUI();
        });

        document.getElementById('entry-preview-clear-btn')?.addEventListener('click', () => {
            removePreviews();
        });

        updateControlUI();
        return true;
    }

    function getListContainer() {
        return document.querySelector('ul.css-1i5jedo.e1lgujxn5') ||
            document.querySelector('div.css-1i5jedo') ||
            document.querySelector('ul.css-1i5jedo') ||
            document.querySelector('[class*="List"]') ||
            document.querySelector('.css-1i5jedo') ||
            Array.from(document.querySelectorAll('ul')).find(ul => ul.querySelector('li'));
    }

    function injectPreviewCard(post) {
        if (!isRequiredUrl()) {
            stopForUrlChange();
            return;
        }

        const listContainer = getListContainer();
        if (!listContainer || document.getElementById('entry-preview-' + post.id)) return;

        const user = post.user || {};
        const userId = user.id || user._id || '';
        const cleanContent = stripTags(post.content);
        const linkedContent = processLinks(cleanContent);
        const displayTime = formatDate(post.created);
        const stickerHtml = post.sticker?.filename
            ? '<em class="css-18ro4ma e1uj27uy2"><img id="entry-preview-sticker-' + post.id + '" alt="sticker" hidden style="max-width:160px;display:block;margin-top:8px;"></em>'
            : '';

        const card = document.createElement('li');
        card.id = 'entry-preview-' + post.id;
        card.className = 'css-tasfte eqmdslz0 ' + PREVIEW_CLASS;
        card.innerHTML = `
            <div class="css-12e6n38 e1uj27uy0">
                <div class="entry-preview-badge">미리보기</div>
                <a href="/profile/${escapeHtml(userId)}">
                    <div id="entry-preview-img-${post.id}" class="css-1r40lgp ec9h6r90" style="background-image:url('/img/EmptyImage.svg');">
                        <span class="blind">유저 썸네일</span>
                    </div>
                </a>
                <div class="css-lz5fzu e143sozh0">
                    <a href="/profile/${escapeHtml(userId)}">${escapeHtml(user.nickname || '')}</a>
                    <em>${escapeHtml(displayTime)}</em>
                </div>
                <div class="css-6wq60h eqt5hs60">${linkedContent}</div>
                ${stickerHtml}
                <div class="css-1dcwahm e50391u0">
                    <em><a role="button" class="like">좋아요 ${post.likesLength || 0}</a></em>
                    <em><a role="button" class="reply">댓글 ${post.commentsLength || 0}</a></em>
                </div>
            </div>
        `;

        listContainer.prepend(card);
        tryLoadImage(document.getElementById('entry-preview-img-' + post.id), user.profileImage?.filename);
        tryLoadSticker(document.getElementById('entry-preview-sticker-' + post.id), post.sticker?.filename);
    }

    async function check() {
        if (!previewRunning || !isLiveStoryActive) return;
        if (!isRequiredUrl()) {
            stopForUrlChange();
            return;
        }
        if (!isFocused()) return;

        const token = getCsrfToken();
        if (!token) return;

        try {
            const res = await originalFetch(SELECT_URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'csrf-token': token,
                    'x-client-type': 'Client',
                },
                body: JSON.stringify({
                    query: `query SELECT_ENTRYSTORY($pageParam: PageParam, $query: String, $user: String, $category: String, $term: String, $prefix: String, $progress: String, $discussType: String, $searchType: String, $searchAfter: JSON, $tag: String) {
                        discussList(pageParam: $pageParam, query: $query, user: $user, category: $category, term: $term, prefix: $prefix, progress: $progress, discussType: $discussType, searchType: $searchType, searchAfter: $searchAfter, tag: $tag) {
                            total
                            list { id content created commentsLength likesLength user { id nickname profileImage { filename } } sticker { filename } }
                        }
                    }`,
                    variables: {
                        category: 'free',
                        searchType: 'scroll',
                        term: 'all',
                        discussType: 'entrystory',
                        pageParam: { display: 10, sort: 'created' },
                    },
                }),
                credentials: 'include',
            });

            const json = await res.json();
            const discussList = json.data?.discussList;
            updateTitleTotal(discussList?.total);
            const list = discussList?.list;
            if (!Array.isArray(list) || !list.length) return;

            if (lastPostId === null) {
                lastPostId = list[0].id;
                return;
            }

            if (list[0].id !== lastPostId) {
                const newPosts = [];
                for (const post of list) {
                    if (post.id === lastPostId) break;
                    newPosts.push(post);
                }
                newPosts.reverse().forEach(injectPreviewCard);
                lastPostId = list[0].id;
            }
        } catch (error) {
            console.warn('[Entry Preview] check failed:', error);
        }
    }

    let urlCheckInterval = null;
    let lastUrl = "";
    let mountTimer = null;

    function checkUrlAndRoute() {
        const currentHref = window.location.href;
        if (currentHref !== lastUrl) {
            lastUrl = currentHref;
            if (isRequiredUrl()) {
                shutdownAndClear();
                startMountChecker();
                // 페이지 이동 시 실시간 모바일 모니터링도 자동 즉시 실행
                if (isLiveStoryActive && isLiveStoryRunningState) {
                    startPreview();
                }
            } else {
                shutdownAndClear();
            }
        }
    }

    function startRouteWatcher() {
        if (urlCheckInterval) return;
        urlCheckInterval = setInterval(checkUrlAndRoute, 500);
        checkUrlAndRoute();
    }

    function stopRouteWatcher() {
        if (urlCheckInterval) {
            clearInterval(urlCheckInterval);
            urlCheckInterval = null;
        }
        shutdownAndClear();
    }

    function startMountChecker() {
        if (mountTimer) clearInterval(mountTimer);
        mountTimer = setInterval(() => {
            if (!isLiveStoryActive || !isRequiredUrl()) {
                clearInterval(mountTimer);
                mountTimer = null;
                return;
            }
            const mounted = mountControl();
            if (mounted) {
                clearInterval(mountTimer);
                mountTimer = null;
            }
        }, 300);
    }

    function startPreview() {
        if (!isRequiredUrl() || !isLiveStoryActive) return;

        if (!hasConfirmedPreview) {
            showEntryPreviewConfirm(() => {
                hasConfirmedPreview = true;
                // Once confirmed, boot preview loop
                previewRunning = true;
                lastPostId = null;
                check();
                if (checkTimer) clearInterval(checkTimer);
                checkTimer = setInterval(check, 6000);
                updateControlUI();
            }, () => {
                previewRunning = false;
                const statusLabel = document.getElementById('entry-preview-status-txt');
                if (statusLabel) {
                    statusLabel.innerHTML = '<strong>실시간 연동 일시 정지됨</strong>';
                }
                const btnToggle = document.getElementById('entry-preview-toggle-btn');
                if (btnToggle) {
                    btnToggle.textContent = '실시간 모니터링 재개';
                    btnToggle.style.background = '#16d8a3';
                    btnToggle.style.color = '#fff';
                    btnToggle.style.border = '1px solid transparent';
                }
            });
            return;
        }

        previewRunning = true;
        lastPostId = null;
        check();
        if (checkTimer) clearInterval(checkTimer);
        checkTimer = setInterval(check, 6000); // 6초 주기로 신속히 업데이트 감지하도록 조정!

        // 컨트롤 화면 리프레시 대응
        const statusLabel = document.getElementById('entry-preview-status-txt');
        if (statusLabel) updateControlUI();
    }

    window.fetch = async (...args) => {
        const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        if (requestUrl && (requestUrl.includes('/ent2') || (requestUrl.includes('/_next/data/') && requestUrl.includes('ent2')))) {
            return new Response(JSON.stringify({ pageProps: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (isRequiredUrl() && (requestUrl === CREATE_URL || requestUrl?.includes('/graphql/CREATE_ENTRYSTORY'))) {
            clearPreviewsAfterPost();
        }
        return await originalFetch(...args);
    };

    document.addEventListener('click', event => {
        const registerButton = event.target.closest('a[data-btn-type="login"][data-testid="button"]');
        if (isRequiredUrl() && registerButton && registerButton.textContent.trim() === '등록') {
            clearPreviewsAfterPost();
        }
    }, true);

    window.addEventListener('focus', () => {
        if (previewRunning && isRequiredUrl()) check();
    });
    document.addEventListener('visibilitychange', () => {
        if (previewRunning && isRequiredUrl() && isFocused()) check();
    });

    function enableLiveStory(autoStart) {
        liveStoryAutoStart = (autoStart !== false);
        
        if (!isLiveStoryInitialized) {
            isLiveStoryInitialized = true;
            isLiveStoryRunningState = liveStoryAutoStart;
        }

        if (isLiveStoryActive) {
            // 이미 가동중일 때도 다시 루트 체크하여 렌더링되게 만듦
            lastUrl = "";
            if (isLiveStoryRunningState) {
                startPreview();
            } else {
                previewRunning = false;
                updateControlUI();
            }
            return;
        }
        isLiveStoryActive = true;
        lastUrl = ""; // Force route check
        startRouteWatcher();
        if (isLiveStoryRunningState) {
            startPreview();
        } else {
            previewRunning = false;
            updateControlUI();
        }
    }

    function disableLiveStory() {
        isLiveStoryActive = false;
        stopRouteWatcher();
    }

    // Bridge messenger from content.js
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'LITEENTRY_SET_LIVESTORY') {
            window.__LITEENTRY_SETTINGS_RECEIVED__ = true; // 세팅 수신 완료 확인 플래그 설정
            if (event.data.enabled) {
                enableLiveStory(event.data.autoStart);
            } else {
                disableLiveStory();
            }
        } else if (event.data && event.data.type === 'LITEENTRY_TOGGLE_LIVESTORY_PLAY') {
            if (previewRunning) {
                stopPreview(true);
            } else {
                hasConfirmedPreview = true;
                isLiveStoryRunningState = true;
                startPreview();
            }
            updateControlUI();
        } else if (event.data && event.data.type === 'LITEENTRY_CLEAR_LIVESTORY_PREVIEWS') {
            removePreviews();
        } else if (event.data && event.data.type === 'LITEENTRY_GET_LIVESTORY_STATUS') {
            try {
                window.postMessage({ type: 'LITEENTRY_LIVESTORY_STATUS_CHANGED', running: previewRunning }, "*");
            } catch (e) {}
        }
    });

    function findReactPostId(element) {
        if (!element) return null;
        
        // Direct attribute fallback if present
        if (element.id && /^[a-f0-9]{24}$/i.test(element.id)) return element.id;

        const reactKeys = Object.keys(element).filter(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
        for (const key of reactKeys) {
            let node = element[key];
            if (!node) continue;
            
            let currentFiber = node;
            let limit = 20; // safe traversal limit
            while (currentFiber && limit > 0) {
                limit--;
                
                const propsList = [currentFiber.memoizedProps, currentFiber.pendingProps, currentFiber.props].filter(Boolean);
                for (const props of propsList) {
                    if (props.id && /^[a-f0-9]{24}$/i.test(props.id)) return props.id;
                    if (props._id && /^[a-f0-9]{24}$/i.test(props._id)) return props._id;
                    if (props.discussId && /^[a-f0-9]{24}$/i.test(props.discussId)) return props.discussId;
                    
                    const subObjs = [props.item, props.post, props.data, props.discuss, props.story].filter(Boolean);
                    for (const sub of subObjs) {
                        if (sub.id && /^[a-f0-9]{24}$/i.test(sub.id)) return sub.id;
                        if (sub._id && /^[a-f0-9]{24}$/i.test(sub._id)) return sub._id;
                    }
                    
                    for (const k in props) {
                        if (typeof props[k] === 'string' && /^[a-f0-9]{24}$/i.test(props[k])) {
                            return props[k];
                        }
                    }
                }
                currentFiber = currentFiber.return;
            }
        }
        return null;
    }

    function scanAndTagReactIds() {
        if (document.hidden) return; // 최적화: 사용자가 보지 않는 백그라운드 창일 때는 탐색을 완전히 스킵하여 CPU 점유율을 줄입니다.
        const containers = document.querySelectorAll("div.css-6wq60h.eqt5hs60");
        containers.forEach(container => {
            const card = container.closest("li") || container.closest(".css-12e6n38") || container;
            if (card && !card.dataset.entrystoryId) {
                const postId = findReactPostId(card) || findReactPostId(container) || findReactPostId(container.nextElementSibling) || findReactPostId(container.previousElementSibling);
                if (postId) {
                    card.setAttribute('data-entrystory-id', postId);
                    container.setAttribute('data-entrystory-id', postId);
                }
            }
        });
    }

    // Scan periodically to catch dynamic scrolling posts
    setInterval(scanAndTagReactIds, 500);

    // Request initial live story state from content.js after loading
    // Handshake: 성공적으로 설정을 수신할 때까지 주기적으로 요청을 보냄 (비동기 Race Condition 방지)
    let handshakeInterval = setInterval(() => {
        if (window.__LITEENTRY_SETTINGS_RECEIVED__) {
            clearInterval(handshakeInterval);
        } else {
            window.postMessage({ type: 'LITEENTRY_LIVESTORY_READY' }, "*");
        }
    }, 250);
    // 5초 후에는 리소스 보호를 위해 강제 종료
    setTimeout(() => clearInterval(handshakeInterval), 5000);
})();
