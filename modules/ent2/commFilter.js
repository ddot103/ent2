// ent2 Community Filter & Search Module
if (typeof liteCommunityState === 'undefined') {
    var liteCommunityState = {
        category: 'all',
        q: '',
        user: '',
        tag: '',
        sort: 'created',
        order: -1,
        term: 'all',
        progress: 'all',
        prefix: 'all',
        page: 1,
        searchAfter: null,
        cursors: [null]
    };
}

// --- Image Extraction & Content Parsing Helpers for SELECT_DISCUSS ---
function getPostThumbnail(post) {
    if (!post) return null;

    if (post.images && Array.isArray(post.images) && post.images.length > 0) {
        for (const img of post.images) {
            if (img.imageUrl) return img.imageUrl.split('?')[0];
            if (img.filename) {
                const fn = img.filename;
                const ext = img.imageType || 'png';
                return `https://playentry.org/uploads/${fn.slice(0, 2)}/${fn.slice(2, 4)}/${fn}.${ext}`;
            }
        }
    }

    if (post.image && post.image.filename) {
        const fn = post.image.filename;
        const ext = post.image.imageType || 'png';
        return `https://playentry.org/uploads/${fn.slice(0, 2)}/${fn.slice(2, 4)}/${fn}.${ext}`;
    }

    if (post.thumbnail) return String(post.thumbnail).split('?')[0];
    if (post.thumb) return String(post.thumb).split('?')[0];

    if (post.content && typeof post.content === 'string') {
        const uploadMatch = post.content.match(/https?:\/\/playentry\.org\/uploads\/[a-zA-Z0-9_/.]+\.(?:png|jpg|jpeg|gif|webp|svg)/i);
        if (uploadMatch) return uploadMatch[0].split('?')[0];

        const imgMatch = post.content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch && imgMatch[1]) return imgMatch[1].split('?')[0];

        const linkDataMatch = post.content.match(/&quot;src&quot;\s*:\s*&quot;([^&"]+)&quot;/i) || post.content.match(/"src"\s*:\s*"([^"]+)"/i);
        if (linkDataMatch && linkDataMatch[1]) return linkDataMatch[1].split('?')[0];
    }

    if (post.seContent && typeof post.seContent === 'string') {
        const uploadMatch = post.seContent.match(/https?:\/\/playentry\.org\/uploads\/[a-zA-Z0-9_/.]+\.(?:png|jpg|jpeg|gif|webp|svg)/i);
        if (uploadMatch) return uploadMatch[0].split('?')[0];
    }

    return null;
}
if (typeof window !== 'undefined') window.getPostThumbnail = getPostThumbnail;

function extractAllPostImages(post) {
    if (!post) return [];
    const images = [];
    const seen = new Set();

    function addImg(url, label = '이미지') {
        if (!url) return;
        const cleanUrl = String(url).split('?')[0];
        if (!seen.has(cleanUrl)) {
            seen.add(cleanUrl);
            images.push({ url: cleanUrl, label });
        }
    }

    if (post.images && Array.isArray(post.images)) {
        post.images.forEach((img, idx) => {
            if (img.imageUrl) addImg(img.imageUrl, `첨부 이미지 ${idx + 1}`);
            else if (img.filename) {
                const fn = img.filename;
                const ext = img.imageType || 'png';
                addImg(`https://playentry.org/uploads/${fn.slice(0, 2)}/${fn.slice(2, 4)}/${fn}.${ext}`, `첨부 이미지 ${idx + 1}`);
            }
        });
    }

    if (post.image && post.image.filename) {
        const fn = post.image.filename;
        const ext = post.image.imageType || 'png';
        addImg(`https://playentry.org/uploads/${fn.slice(0, 2)}/${fn.slice(2, 4)}/${fn}.${ext}`, '대표 이미지');
    }

    if (post.thumbnail) addImg(post.thumbnail, '썸네일');
    if (post.thumb) addImg(post.thumb, '썸네일');

    if (post.content && typeof post.content === 'string') {
        const uploadMatches = post.content.matchAll(/https?:\/\/playentry\.org\/uploads\/[a-zA-Z0-9_/.]+\.(?:png|jpg|jpeg|gif|webp|svg)/gi);
        let i = 1;
        for (const m of uploadMatches) {
            addImg(m[0], `본문 이미지 ${i++}`);
        }

        const imgTagMatches = post.content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
        for (const m of imgTagMatches) {
            if (m[1]) addImg(m[1], `본문 이미지 ${i++}`);
        }

        const linkDataMatches = post.content.matchAll(/&quot;src&quot;\s*:\s*&quot;([^&"]+)&quot;/gi);
        for (const m of linkDataMatches) {
            if (m[1]) addImg(m[1], `본문 이미지 ${i++}`);
        }
    }

    return images;
}
if (typeof window !== 'undefined') window.extractAllPostImages = extractAllPostImages;

function extractPlainTextFromHtml(html) {
    if (!html) return '';
    if (!/<[a-z][\s\S]*>/i.test(html)) return String(html).trim();
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) {
        return String(html).replace(/<[^>]+>/g, '').trim();
    }
}
if (typeof window !== 'undefined') window.extractPlainTextFromHtml = extractPlainTextFromHtml;

function formatPostContentHtml(content) {
    if (!content) return '<span style="opacity:0.6; font-style:italic;">(내용이 없습니다.)</span>';

    if (!/<[a-z][\s\S]*>/i.test(content)) {
        return escapeHtml(content).replace(/\n/g, '<br>');
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');

        stripUnsafeHtmlAttributes(doc);

        doc.querySelectorAll('img').forEach(img => {
            let src = img.getAttribute('src') || img.getAttribute('data-src');
            if (src && isSafeImageOrLinkUrl(src)) {
                img.setAttribute('src', src);
                img.style.cssText = 'max-width:100%; height:auto; border-radius:12px; margin:12px 0; display:block; box-shadow:0 4px 12px rgba(0,0,0,0.08);';
                img.onerror = function() { this.style.display = 'none'; };
            } else {
                img.removeAttribute('src');
                img.style.display = 'none';
            }
        });

        doc.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href');
            if (href && !isSafeImageOrLinkUrl(href)) {
                a.removeAttribute('href');
            }
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
            a.style.color = '#3182f6';
            a.style.fontWeight = '700';
            a.style.textDecoration = 'underline';
        });

        return doc.body.innerHTML;
    } catch (e) {
        console.error('[ent2] Error formatting post content HTML:', e);
        return escapeHtml(content);
    }
}
if (typeof window !== 'undefined') window.formatPostContentHtml = formatPostContentHtml;

let currentCommContainer = null;

function getEnt2CommunityThemeMode() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') return false;
    if (saved === 'dark') return true;
    return window.location.pathname.startsWith('/ent2');
}

async function renderLiteCommunityFilterUI(container) {
    if (!container) {
        container = currentCommContainer || document.getElementById('ent2-comm-filter-mount') || document.getElementById('ent2-tab-content-area');
    }
    if (!container) return;
    currentCommContainer = container;

    const isDark = getEnt2CommunityThemeMode() || document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    const svgZap = `<svg style="width:16px; height:16px; color:#ffffff;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
    const svgReset = `<svg style="width:14px; height:14px; color:#ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
    const svgSearch = `<svg style="width:14px; height:14px; color:#ffffff;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`;
    
    const isFunEnabled = typeof Ent2Storage !== 'undefined' 
        ? await Ent2Storage.get('ent2_fun_enabled', false) 
        : false;

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            <div style="background:linear-gradient(135deg, ${isDark ? '#111827' : '#f8fbff'} 0%, ${isDark ? '#171d23' : '#eef4ff'} 100%); border:1px solid ${isDark ? '#2b3037' : '#dfeafc'}; border-radius:22px; padding:16px 18px; box-shadow:0 12px 30px rgba(15,23,42,0.18);">
                <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; background:linear-gradient(135deg, #21262d, #2b3138); border-radius:12px; box-shadow:0 10px 24px rgba(15,23,42,0.18);">${svgZap}</span>
                        <div>
                            <h3 style="margin:0; font-size:18px; font-weight:900; color:${isDark ? '#f8fafc' : '#0f172a'}; letter-spacing:-0.03em;">커뮤니티 탐색</h3>
                            <p style="margin:3px 0 0 0; font-size:11px; color:${isDark ? '#cbd5e1' : '#64748b'};">태그, 작성자, 정렬, 기간을 조합해서 원하는 게시글을 빠르게 찾습니다.</p>
                        </div>
                    </div>
                </div>

                <div id="lite-comm-cat-group" style="display:flex; align-items:center; gap:6px; background:${isDark ? '#101418' : '#edf3ff'}; padding:6px; border-radius:14px; border:1px solid ${isDark ? '#2d3339' : '#d6e3ff'}; flex-wrap:wrap; flex-shrink:0;">
                    <button data-cat="all" class="lite-cat-btn" style="padding:7px 12px; border:none; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer; transition:all 0.15s; background:${liteCommunityState.category === 'all' ? 'linear-gradient(135deg, #2d3748, #374151)' : 'transparent'}; color:${liteCommunityState.category === 'all' ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569')}; box-shadow:${liteCommunityState.category === 'all' ? '0 8px 18px rgba(15,23,42,0.28)' : 'none'};">전체</button>
                    <button data-cat="free" class="lite-cat-btn" style="padding:7px 12px; border:none; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer; transition:all 0.15s; background:${liteCommunityState.category === 'free' ? 'linear-gradient(135deg, #2d3748, #374151)' : 'transparent'}; color:${liteCommunityState.category === 'free' ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569')}; box-shadow:${liteCommunityState.category === 'free' ? '0 8px 18px rgba(15,23,42,0.28)' : 'none'};">엔트리 이야기</button>
                    <button data-cat="qna" class="lite-cat-btn" style="padding:7px 12px; border:none; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer; transition:all 0.15s; background:${liteCommunityState.category === 'qna' ? 'linear-gradient(135deg, #2d3748, #374151)' : 'transparent'}; color:${liteCommunityState.category === 'qna' ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569')}; box-shadow:${liteCommunityState.category === 'qna' ? '0 8px 18px rgba(15,23,42,0.28)' : 'none'};">묻고 답하기</button>
                    <button data-cat="tips" class="lite-cat-btn" style="padding:7px 12px; border:none; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer; transition:all 0.15s; background:${liteCommunityState.category === 'tips' ? 'linear-gradient(135deg, #2d3748, #374151)' : 'transparent'}; color:${liteCommunityState.category === 'tips' ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569')}; box-shadow:${liteCommunityState.category === 'tips' ? '0 8px 18px rgba(15,23,42,0.28)' : 'none'};">노하우&팁</button>
                    <button data-cat="suggestion" class="lite-cat-btn" style="padding:7px 12px; border:none; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer; transition:all 0.15s; background:${liteCommunityState.category === 'suggestion' ? 'linear-gradient(135deg, #2d3748, #374151)' : 'transparent'}; color:${liteCommunityState.category === 'suggestion' ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569')}; box-shadow:${liteCommunityState.category === 'suggestion' ? '0 8px 18px rgba(15,23,42,0.28)' : 'none'};">제안/건의</button>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                <div>
                    <label style="display:block; font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">검색 키워드</label>
                    <input type="text" id="lite-comm-input-q" value="${escapeHtml(liteCommunityState.q)}" placeholder="제목 또는 본문 검색..." style="width:100%; padding:10px 12px; border:1px solid ${isDark ? '#33353a' : '#cbd5e1'}; border-radius:10px; background:${isDark ? '#1a1b1e' : '#ffffff'}; color:${isDark ? '#f8fafc' : '#0f172a'}; font-size:12px; font-weight:600; outline:none; box-sizing:border-box;">
                </div>

                <div>
                    <label style="display:block; font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">작성자 ID</label>
                    <input type="text" id="lite-comm-input-user" value="${escapeHtml(liteCommunityState.user)}" placeholder="작성자 고유 ID (예: 60a...)" style="width:100%; padding:10px 12px; border:1px solid ${isDark ? '#33353a' : '#cbd5e1'}; border-radius:10px; background:${isDark ? '#1a1b1e' : '#ffffff'}; color:${isDark ? '#f8fafc' : '#0f172a'}; font-size:12px; font-weight:600; outline:none; box-sizing:border-box;">
                </div>

                <div>
                    <label style="display:block; font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">해시태그</label>
                    <input type="text" id="lite-comm-input-tag" value="${escapeHtml(liteCommunityState.tag)}" placeholder="태그 입력 (예: 하드웨어)..." style="width:100%; padding:10px 12px; border:1px solid ${isDark ? '#33353a' : '#cbd5e1'}; border-radius:10px; background:${isDark ? '#1a1b1e' : '#ffffff'}; color:${isDark ? '#f8fafc' : '#0f172a'}; font-size:12px; font-weight:600; outline:none; box-sizing:border-box;">
                </div>

                <div>
                    <label style="display:block; font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">정렬 기준</label>
                    <select id="lite-comm-select-sort" style="width:100%; padding:10px 12px; border:1px solid ${isDark ? '#33353a' : '#cbd5e1'}; border-radius:10px; background:${isDark ? '#1a1b1e' : '#ffffff'}; color:${isDark ? '#f8fafc' : '#0f172a'}; font-size:12px; font-weight:600; outline:none; box-sizing:border-box; cursor:pointer;">
                        <option value="created" ${liteCommunityState.sort === 'created' ? 'selected' : ''}>최신순</option>
                        <option value="visit" ${liteCommunityState.sort === 'visit' ? 'selected' : ''}>조회순</option>
                        <option value="likesLength" ${liteCommunityState.sort === 'likesLength' ? 'selected' : ''}>좋아요순</option>
                        <option value="commentsLength" ${liteCommunityState.sort === 'commentsLength' ? 'selected' : ''}>댓글순</option>
                        <option value="score" ${liteCommunityState.sort === 'score' ? 'selected' : ''}>정확도순</option>
                        <option value="oldest" ${liteCommunityState.sort === 'oldest' ? 'selected' : ''}>날짜순 (오래된순)</option>
                        ${isFunEnabled ? `
                        <optgroup label="Fun 이색 정렬 모드">
                            <option value="-likesLength" ${liteCommunityState.sort === '-likesLength' ? 'selected' : ''}>-좋아요 (좋아요 적은 순)</option>
                            <option value="-commentsLength" ${liteCommunityState.sort === '-commentsLength' ? 'selected' : ''}>-댓글 (댓글 적은 순)</option>
                        </optgroup>
                        ` : ''}
                    </select>
                </div>

                <div>
                    <label style="display:block; font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">탐색 시점 / 기간 범위 (시/일/월/년)</label>
                    <select id="lite-comm-select-term" style="width:100%; padding:10px 12px; border:1px solid ${isDark ? '#33353a' : '#cbd5e1'}; border-radius:10px; background:${isDark ? '#1a1b1e' : '#ffffff'}; color:${isDark ? '#f8fafc' : '#0f172a'}; font-size:12px; font-weight:600; outline:none; box-sizing:border-box; cursor:pointer;">
                        <option value="all" ${liteCommunityState.term === 'all' ? 'selected' : ''}>전체 기간</option>
                        <optgroup label="연도별 시점 탐색 (Year)">
                            <option value="year-2026" ${liteCommunityState.term === 'year-2026' ? 'selected' : ''}>2026년 기준 탐색</option>
                            <option value="year-2025" ${liteCommunityState.term === 'year-2025' ? 'selected' : ''}>2025년 기준 탐색</option>
                            <option value="year-2024" ${liteCommunityState.term === 'year-2024' ? 'selected' : ''}>2024년 기준 탐색</option>
                            <option value="year-2023" ${liteCommunityState.term === 'year-2023' ? 'selected' : ''}>2023년 기준 탐색</option>
                            <option value="year-2022" ${liteCommunityState.term === 'year-2022' ? 'selected' : ''}>2022년 기준 탐색</option>
                            <option value="year-2021" ${liteCommunityState.term === 'year-2021' ? 'selected' : ''}>2021년 기준 탐색</option>
                            <option value="year-2020" ${liteCommunityState.term === 'year-2020' ? 'selected' : ''}>2020년 기준 탐색</option>
                            <option value="year-2019" ${liteCommunityState.term === 'year-2019' ? 'selected' : ''}>2019년 기준 탐색</option>
                        </optgroup>
                        <optgroup label="일/월/년 경과 기준 (Day/Month)">
                            <option value="today" ${liteCommunityState.term === 'today' ? 'selected' : ''}>오늘 (24시간 전)</option>
                            <option value="week" ${liteCommunityState.term === 'week' ? 'selected' : ''}>7일 전 (1주)</option>
                            <option value="month" ${liteCommunityState.term === 'month' ? 'selected' : ''}>1개월 전</option>
                            <option value="quarter" ${liteCommunityState.term === 'quarter' ? 'selected' : ''}>3개월 전</option>
                        </optgroup>
                        <option value="custom" ${liteCommunityState.term === 'custom' ? 'selected' : ''}>년/월/일 정밀 선택 (아래 입력)</option>
                    </select>
                </div>

                <div>
                    <label style="display:block; font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">정밀 시점 직접 지정 (년/월/일 searchAfter)</label>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <input type="date" id="lite-comm-input-date" value="${liteCommunityState.selectedDate ? liteCommunityState.selectedDate.slice(0, 10) : ''}" style="flex:1; padding:8px 12px; border:1px solid ${isDark ? '#33353a' : '#cbd5e1'}; border-radius:10px; background:${isDark ? '#1a1b1e' : '#ffffff'}; color:${isDark ? '#f8fafc' : '#0f172a'}; font-size:12px; font-weight:600; outline:none; box-sizing:border-box;">
                        <button id="lite-comm-clear-date-btn" type="button" style="padding:0 12px; height:36px; border-radius:10px; border:1px solid ${isDark ? '#33353a' : '#cbd5e1'}; background:${isDark ? '#2a2d32' : '#f1f5f9'}; color:${isDark ? '#94a3b8' : '#64748b'}; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap;">초기화</button>
                    </div>
                </div>
            </div>

            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:11px; color:${isDark ? '#94a3b8' : '#64748b'}; padding-top:4px;">
                <span style="font-weight:700;">추천 태그:</span>
                ${['질문', '오류', '하드웨어', '배열법', '딜레이제거', '게임제작', '코딩팁', '일상'].map(tag => `
                    <button data-quick-tag="${tag}" class="lite-quick-tag-chip" style="padding:3px 10px; background:${isDark ? '#1a1b1e' : '#f1f5f9'}; border:1px solid ${isDark ? '#33353a' : '#e2e8f0'}; border-radius:12px; color:${isDark ? '#cbd5e1' : '#475569'}; font-size:11px; font-weight:600; cursor:pointer; transition:all 0.15s;">
                        #${tag}
                    </button>
                `).join('')}
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding-top:8px; border-top:1px solid ${isDark ? '#33353a' : '#f1f5f9'}; flex-wrap:wrap;">
                <div id="lite-comm-active-chips" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:11px;">
                </div>

                <div style="display:flex; align-items:center; gap:8px;">
                    <button id="lite-comm-reset-btn" style="padding:8px 14px; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.15s; display:inline-flex; align-items:center; gap:6px;">
                        ${svgReset}
                        <span>필터 초기화</span>
                    </button>
                    <button id="lite-comm-apply-btn" style="padding:8px 20px; background:#4f7cff; color:#ffffff; border:none; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(79,124,255,0.25); transition:all 0.15s; display:inline-flex; align-items:center; gap:6px;">
                        ${svgSearch}
                        <span>필터 적용</span>
                    </button>
                </div>
            </div>
        </div>

        <div id="lite-comm-results-area" style="margin-top:24px; display:none; border:1px solid ${isDark ? '#2f3749' : '#e7edf9'}; border-radius:22px; background:${isDark ? '#111827' : '#f8fbff'}; padding:18px; box-shadow:0 18px 36px rgba(15,23,42,0.05);">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; gap:8px; flex-wrap:wrap;">
                <h4 id="lite-comm-result-title" style="margin:0; font-size:15px; font-weight:900; color:${isDark ? '#f8fafc' : '#0f172a'};">
                    검색 결과
                </h4>
                <div style="font-size:12px; color:${isDark ? '#cbd5e1' : '#64748b'}; background:${isDark ? '#1f2937' : '#edf3ff'}; border:1px solid ${isDark ? '#334155' : '#dfeafc'}; border-radius:999px; padding:5px 10px;" id="lite-comm-result-count"></div>
            </div>

            <div id="lite-comm-cards-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
            </div>

            <div id="lite-comm-pagination" style="display:flex; align-items:center; justify-content:center; gap:12px; margin-top:24px;">
            </div>
        </div>
    `;

    container.querySelectorAll('.lite-cat-btn').forEach(btn => {
        btn.onclick = () => {
            liteCommunityState.category = btn.getAttribute('data-cat');
            liteCommunityState.page = 1;
            liteCommunityState.searchAfter = null;
            liteCommunityState.cursors = [null];
            renderLiteCommunityFilterUI(container);
            executeLiteCommunityQuery(container);
        };
    });

    container.querySelectorAll('.lite-quick-tag-chip').forEach(btn => {
        btn.onclick = () => {
            const tag = btn.getAttribute('data-quick-tag');
            liteCommunityState.tag = tag;
            const inputTag = container.querySelector('#lite-comm-input-tag');
            if (inputTag) inputTag.value = tag;
            executeLiteCommunityQuery(container);
        };
    });

    const runCommSearch = () => {
        liteCommunityState.q = container.querySelector('#lite-comm-input-q')?.value || '';
        liteCommunityState.user = container.querySelector('#lite-comm-input-user')?.value || '';
        liteCommunityState.tag = container.querySelector('#lite-comm-input-tag')?.value || '';
        liteCommunityState.sort = container.querySelector('#lite-comm-select-sort')?.value || 'created';
        liteCommunityState.term = container.querySelector('#lite-comm-select-term')?.value || 'all';
        liteCommunityState.page = 1;

        let dateVal = dateInput?.value?.trim() || '';
        liteCommunityState.selectedDate = dateVal;
        liteCommunityState.searchAfter = computeSearchAfterTimestamp(dateVal);

        liteCommunityState.cursors = [null];
        executeLiteCommunityQuery(container);
    };

    const inputQ = container.querySelector('#lite-comm-input-q');
    const inputUser = container.querySelector('#lite-comm-input-user');
    const inputTag = container.querySelector('#lite-comm-input-tag');
    const selectSort = container.querySelector('#lite-comm-select-sort');
    const selectTerm = container.querySelector('#lite-comm-select-term');

    if (inputQ) {
        inputQ.onkeydown = (e) => {
            if (e.key === 'Enter') runCommSearch();
        };
    }
    if (inputUser) {
        inputUser.onkeydown = (e) => {
            if (e.key === 'Enter') runCommSearch();
        };
    }
    if (inputTag) {
        inputTag.onkeydown = (e) => {
            if (e.key === 'Enter') runCommSearch();
        };
    }

    if (selectSort) {
        selectSort.onchange = () => runCommSearch();
    }
    if (selectTerm) {
        selectTerm.onchange = () => runCommSearch();
    }

    const dateClearBtn = container.querySelector('#lite-comm-clear-date-btn');
    const dateInput = container.querySelector('#lite-comm-input-date');

    if (dateInput) {
        dateInput.onchange = () => {
            if (dateInput.value && dateInput.value < '2014-07-20') {
                dateInput.value = '2014-07-20';
            }
            liteCommunityState.selectedDate = dateInput.value;
            runCommSearch();
        };
    }
    if (dateClearBtn && dateInput) {
        dateClearBtn.onclick = () => {
            dateInput.value = '';
            liteCommunityState.selectedDate = '';
            liteCommunityState.searchAfter = null;
            runCommSearch();
        };
    }

    const applyBtn = container.querySelector('#lite-comm-apply-btn');
    if (applyBtn) {
        applyBtn.onclick = () => runCommSearch();
    }

    const resetBtn = container.querySelector('#lite-comm-reset-btn');
    if (resetBtn) {
        resetBtn.onclick = () => {
            liteCommunityState = {
                category: 'all',
                q: '',
                user: '',
                tag: '',
                sort: 'created',
                order: -1,
                term: 'all',
                progress: 'all',
                prefix: 'all',
                page: 1,
                selectedDate: '',
                searchAfter: null,
                cursors: [null]
            };
            renderLiteCommunityFilterUI(container);
            executeLiteCommunityQuery(container);
        };
    }

    // 커뮤니티 탐색 탭 진입 시 자동으로 게시글 목록 검색 실행
    executeLiteCommunityQuery(container);
}

let joinedGroupIdsCache = null;
let joinedGroupIdsPromise = null;

async function getJoinedGroupIds() {
    if (joinedGroupIdsCache) return joinedGroupIdsCache;
    if (joinedGroupIdsPromise) return joinedGroupIdsPromise;

    joinedGroupIdsPromise = (async () => {
        try {
            const fetchHeaders = typeof getPlayEntryFetchHeaders === 'function' 
                ? getPlayEntryFetchHeaders() 
                : { 'Content-Type': 'application/json' };

            const queryStr = `
                query SELECT_JOIN_GROUP_LIST($queryString: JSON, $pageParam: PageParam) {
                    selectJoinGroupList(queryString: $queryString, pageParam: $pageParam) {
                        total
                        list {
                            id
                        }
                    }
                }
            `;

            const res = await fetch('https://playentry.org/graphql/SELECT_JOIN_GROUP_LIST', {
                method: 'POST',
                headers: fetchHeaders,
                credentials: 'include',
                body: JSON.stringify({
                    query: queryStr,
                    variables: {
                        pageParam: { currentPage: 1, sort: "updated" }
                    }
                })
            });

            const json = await res.json();
            const list = json?.data?.selectJoinGroupList?.list || [];
            joinedGroupIdsCache = new Set(list.map(g => g.id).filter(Boolean));
            return joinedGroupIdsCache;
        } catch (e) {
            console.error('[ent2] Error fetching SELECT_JOIN_GROUP_LIST:', e);
            joinedGroupIdsCache = new Set();
            return joinedGroupIdsCache;
        } finally {
            joinedGroupIdsPromise = null;
        }
    })();

    return joinedGroupIdsPromise;
}

function computeSearchAfterTimestamp(selectedDate) {
    if (selectedDate) {
        const dateStr = selectedDate.includes('T') ? selectedDate : `${selectedDate}T23:59:59`;
        const ts = new Date(dateStr).getTime();
        if (!isNaN(ts)) return [ts];
    }
    return null;
}

async function executeLiteCommunityQuery(container) {
    if (!container || typeof container.querySelector !== 'function') {
        container = currentCommContainer || document.getElementById('ent2-comm-filter-mount') || document.getElementById('ent2-tab-content-area') || document.querySelector('#lite-comm-results-area')?.closest('div') || document.body;
    }
    if (!container || typeof container.querySelector !== 'function') return;
    currentCommContainer = container;

    const isDark = getEnt2CommunityThemeMode() || document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    const resultsArea = container.querySelector('#lite-comm-results-area');
    const cardsGrid = container.querySelector('#lite-comm-cards-grid');
    const countEl = container.querySelector('#lite-comm-result-count');
    const paginationEl = container.querySelector('#lite-comm-pagination');

    if (!resultsArea || !cardsGrid) return;
    resultsArea.style.display = 'block';
    cardsGrid.innerHTML = `<div style="grid-column:1/-1; padding:32px; text-align:center; color:#4f7cff; font-weight:700; font-size:13px;">커뮤니티 데이터를 가져오는 중...</div>`;

    let opName = 'SELECT_DISCUSS_LIST';
    const isStory = liteCommunityState.category === 'free';

    if (isStory) {
        opName = 'SELECT_ENTRYSTORY';
    } else if (liteCommunityState.category === 'qna') {
        opName = 'SELECT_QNA_LIST';
    }

    let sortVal = liteCommunityState.sort;
    if (liteCommunityState.sort === 'oldest') {
        sortVal = 'created';
    } else if (liteCommunityState.sort === '-likesLength') {
        sortVal = 'likesLength';
    } else if (liteCommunityState.sort === '-commentsLength') {
        sortVal = 'commentsLength';
    }

    const termVal = liteCommunityState.term;

    const vars = {
        pageParam: {
            display: 12,
            sort: sortVal
        }
    };

    if (liteCommunityState.sort === 'oldest' || liteCommunityState.sort === '-likesLength' || liteCommunityState.sort === '-commentsLength') {
        vars.pageParam.order = 1;
    }

    if (liteCommunityState.page > 1 && !liteCommunityState.searchAfter) {
        vars.pageParam.start = (liteCommunityState.page - 1) * 12;
    }

    if (liteCommunityState.q) vars.query = liteCommunityState.q;
    if (liteCommunityState.user) vars.user = liteCommunityState.user;
    if (liteCommunityState.tag) vars.tag = liteCommunityState.tag;

    if (liteCommunityState.category && liteCommunityState.category !== 'all') {
        vars.category = liteCommunityState.category;
    }

    const validTerms = ['all', 'today', 'week', 'month', 'quarter'];
    if (termVal && validTerms.includes(termVal)) {
        vars.term = termVal;
    }

    if (liteCommunityState.prefix && liteCommunityState.prefix !== 'all') {
        vars.prefix = liteCommunityState.prefix;
    }

    if (liteCommunityState.progress && liteCommunityState.progress !== 'all') {
        vars.progress = liteCommunityState.progress;
    }

    if (isStory) {
        vars.discussType = 'entrystory';
        vars.category = 'free';
    } else if (liteCommunityState.category === 'qna') {
        vars.discussType = 'qna';
        vars.category = 'qna';
    }

    if (liteCommunityState.searchAfter) {
        vars.searchAfter = liteCommunityState.searchAfter;
        vars.searchType = 'scroll';
    }

    const graphqlQueryStr = `
        query ${opName}($pageParam: PageParam, $query: String, $user: String, $category: String, $term: String, $prefix: String, $progress: String, $discussType: String, $searchType: String, $searchAfter: JSON, $tag: String) {
            discussList(pageParam: $pageParam, query: $query, user: $user, category: $category, term: $term, prefix: $prefix, progress: $progress, discussType: $discussType, searchType: $searchType, searchAfter: $searchAfter, tag: $tag) {
                total
                searchAfter
                list {
                    id
                    title
                    content
                    created
                    category
                    groupNotice
                    commentsLength
                    likesLength
                    visit
                    user {
                        id
                        nickname
                        profileImage { filename imageType }
                        role
                        mark { id name filename imageType }
                    }
                }
            }
        }
    `;

    try {
        const fetchHeaders = typeof getPlayEntryFetchHeaders === 'function' 
            ? getPlayEntryFetchHeaders() 
            : { 'Content-Type': 'application/json' };

        const res = await fetch('https://playentry.org/graphql/' + opName, {
            method: 'POST',
            headers: fetchHeaders,
            credentials: 'include',
            body: JSON.stringify({ query: graphqlQueryStr, variables: vars })
        });

        const data = await res.json();
        const discussList = data?.data?.discussList;
        let posts = discussList?.list || [];
        let total = discussList?.total || 0;
        liteCommunityState.nextSearchAfter = discussList?.searchAfter || null;

        // 학급/그룹 게시글 필터링: 가입하지 않은 학급의 게시글만 정밀하게 제거 (일반 커뮤니티 게시글 및 가입한 학급 게시글은 100% 보존)
        const is24Hex = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
        const standardCats = new Set(['free', 'qna', 'tips', 'suggestion', 'entrystory', 'notice', 'report']);

        const hasHexCategory = posts.some(p => is24Hex(p.category) && !standardCats.has(p.category));

        if (hasHexCategory) {
            const joinedGroupIds = await getJoinedGroupIds();
            posts = posts.filter(p => {
                // 1) 표준 커뮤니티 카테고리(free, qna, tips, suggestion 등)이거나 카테고리가 없는 일반 글은 100% 유지
                if (!p.category || standardCats.has(p.category)) {
                    return true;
                }

                // 2) 24자리 Hex ID 카테고리 (학급/그룹 게시글)
                if (is24Hex(p.category)) {
                    // 가입한 학급 ID 목록에 포함된 경우 유지
                    if (joinedGroupIds.has(p.category)) {
                        return true;
                    }
                    // 가입하지 않은 학급의 게시글만 핀포인트 제거
                    return false;
                }

                // 3) 그 외 알 수 없는 카테고리는 안전하게 유지
                return true;
            });
        }

        // 시/일/월/년 정밀 시간 범위 필터링
        const now = Date.now();
        let minTimeBoundary = null;
        let maxTimeBoundary = null;

        if (liteCommunityState.selectedDate) {
            const dt = new Date(liteCommunityState.selectedDate).getTime();
            if (!isNaN(dt)) minTimeBoundary = dt;
        } else if (termVal && termVal.startsWith('year-')) {
            const y = parseInt(termVal.replace('year-', ''), 10);
            if (!isNaN(y)) {
                minTimeBoundary = new Date(`${y}-01-01T00:00:00`).getTime();
                maxTimeBoundary = new Date(`${y}-12-31T23:59:59`).getTime();
            }
        } else if (termVal && termVal !== 'all') {
            const hour = 3600 * 1000;
            const day = 24 * hour;
            switch (termVal) {
                case '1h': minTimeBoundary = now - 1 * hour; break;
                case '3h': minTimeBoundary = now - 3 * hour; break;
                case '6h': minTimeBoundary = now - 6 * hour; break;
                case '12h': minTimeBoundary = now - 12 * hour; break;
                case 'today': minTimeBoundary = now - 1 * day; break;
                case 'week': minTimeBoundary = now - 7 * day; break;
                case 'month': minTimeBoundary = now - 30 * day; break;
                case 'quarter': minTimeBoundary = now - 90 * day; break;
            }
        }

        if (minTimeBoundary !== null || maxTimeBoundary !== null) {
            posts = posts.filter(p => {
                if (!p.created) return true;
                const pTime = new Date(p.created).getTime();
                if (minTimeBoundary !== null && pTime < minTimeBoundary) return false;
                if (maxTimeBoundary !== null && pTime > maxTimeBoundary) return false;
                return true;
            });
        }

        if (liteCommunityState.sort === 'oldest' && posts.length > 0) {
            posts.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
        } else if (liteCommunityState.sort === '-likesLength' && posts.length > 0) {
            posts.sort((a, b) => (a.likesLength || a.likeCnt || 0) - (b.likesLength || b.likeCnt || 0));
        } else if (liteCommunityState.sort === '-commentsLength' && posts.length > 0) {
            posts.sort((a, b) => (a.commentsLength || a.comment || 0) - (b.commentsLength || b.comment || 0));
        }

        if (countEl) countEl.textContent = `총 ${total.toLocaleString()}개 게시글`;

        if (posts.length === 0) {
            cardsGrid.innerHTML = `
                <div style="grid-column:1/-1; padding:48px; text-align:center; background:${isDark ? '#1e293b' : '#f8fafc'}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; border-radius:16px; color:${isDark ? '#94a3b8' : '#64748b'}; font-size:13px;">
                    필터 조건에 부합하는 게시글이 없습니다.
                </div>
            `;
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        cardsGrid.innerHTML = posts.map((post, idx) => {
            const author = post.user || {};
            const avatarImg = author.profileImage?.filename 
                ? (author.profileImage.imageType === 'avatar'
                    ? `https://playentry.org/uploads/avatar/${author.profileImage.filename.slice(0, 2)}/${author.profileImage.filename.slice(2, 4)}/image/${author.profileImage.filename}.png`
                    : `https://playentry.org/uploads/${author.profileImage.filename.slice(0, 2)}/${author.profileImage.filename.slice(2, 4)}/${author.profileImage.filename}.${author.profileImage.imageType || 'png'}`
                  )
                : 'https://playentry.org/img/DefaultCardUserThmb.svg';

            const catMap = {
                qna: '묻고 답하기',
                tips: '노하우&팁',
                free: '엔트리 이야기',
                entrystory: '엔트리 스토리',
                suggestion: '제안 및 건의'
            };
            const postCat = post.category || (isStory ? 'entrystory' : 'community');
            const catName = catMap[postCat] || postCat;

            const postUrl = (postCat === 'entrystory' || postCat === 'free') 
                ? `https://playentry.org/community/entrystory/${post.id}`
                : `https://playentry.org/community/${postCat === 'qna' ? 'qna' : (postCat === 'suggestion' ? 'suggestion' : 'tips')}/${post.id}`;

                const isEntryStoryPost = (postCat === 'free' || postCat === 'entrystory' || isStory || liteCommunityState.category === 'free');
                const rawText = isEntryStoryPost 
                    ? (post.content || post.title || '(내용 없음)') 
                    : (post.title || post.content || '(제목 없음)');

                const displayText = extractPlainTextFromHtml(rawText);
                const thumbnail = getPostThumbnail(post);

                const markHtml = author.mark?.filename 
                    ? `<img src="https://playentry.org/uploads/${author.mark.filename.slice(0, 2)}/${author.mark.filename.slice(2, 4)}/${author.mark.filename}.${author.mark.imageType || 'svg'}" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;">` 
                    : '';

                const storyCardTone = isDark ? '#101827' : (isEntryStoryPost ? '#f5f7fa' : '#ffffff');
                const storyHeaderTone = isDark ? '#171d29' : (isEntryStoryPost ? '#ffffff' : '#f7f9fc');
                const accentColor = '#4f7cff';

                return `
                    <div style="background:${storyCardTone}; border:1px solid ${isDark ? '#2d3748' : '#dfe8f3'}; border-radius:18px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; gap:12px; box-shadow:0 8px 18px rgba(15,23,42,0.12);">
                        <div style="padding:10px 12px; background:${storyHeaderTone}; border:1px solid ${isDark ? '#2b3344' : '#edf1f7'}; border-radius:12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                            <span style="font-size:10.5px; font-weight:800; color:${accentColor}; background:rgba(79,124,255,0.12); padding:3px 8px; border-radius:999px; border:1px solid rgba(79,124,255,0.15);">
                                ${escapeHtml(catName)}
                            </span>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:11px; color:${isDark ? '#b5c2d5' : '#64748b'};">
                                    ${new Date(post.created).toLocaleDateString('ko-KR')}
                                </span>
                                <button class="ent2-comm-info-btn" data-post-idx="${idx}" title="게시글 상세 본문 및 SELECT_DISCUSS 정보" style="border:none; background:rgba(79,124,255,0.1); color:${accentColor}; border-radius:7px; padding:2px 7px; font-size:10.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:2px;">
                                    <svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    <span>i</span>
                                </button>
                            </div>
                        </div>

                        ${thumbnail ? `
                            <div class="ent2-comm-card-thumb" data-post-idx="${idx}" style="width:100%; aspect-ratio:16/9; border-radius:12px; overflow:hidden; background:${isDark ? '#0f172a' : '#edf2f8'}; cursor:pointer; position:relative; border:1px solid ${isDark ? '#2d3748' : '#dfe8f3'};" title="이미지 미리보기 (클릭 시 상세보기)">
                                <img src="${escapeHtml(thumbnail)}" style="width:100%; height:100%; object-fit:cover; transition:transform 0.25s ease;" onerror="this.parentElement.style.display='none';" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='scale(1)';">
                                <span style="position:absolute; bottom:8px; right:8px; font-size:9.5px; font-weight:800; color:#ffffff; background:rgba(0,0,0,0.62); padding:2px 6px; border-radius:6px; backdrop-filter:blur(4px);">썸네일</span>
                            </div>
                        ` : ''}

                        <div style="display:flex; align-items:flex-start; gap:10px; min-width:0;">
                            <img src="${avatarImg}" style="width:26px; height:26px; border-radius:50%; object-fit:cover; flex-shrink:0; border:1px solid ${isDark ? '#2d3748' : '#dfe8f3'}; background:${isDark ? '#1f2937' : '#ffffff'};" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                            <div style="flex:1; min-width:0;">
                                <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
                                    <span style="font-weight:800; font-size:11px; color:${isDark ? '#e5edf9' : '#1f2937'};">${escapeHtml(author.nickname || '익명')}</span>
                                    ${isEntryStoryPost ? `<span style="font-size:9px; font-weight:800; color:${accentColor}; background:rgba(79,124,255,0.1); border:1px solid rgba(79,124,255,0.15); padding:2px 6px; border-radius:999px;">엔트리 이야기</span>` : ''}
                                </div>
                                <a href="${postUrl}" class="ent2-comm-card-title" data-post-idx="${idx}" style="font-size:14px; font-weight:800; color:${isDark ? '#f8fafc' : '#0f172a'}; text-decoration:none; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; line-height:1.45; cursor:pointer;">
                                    ${escapeHtml(displayText)}
                                </a>
                            </div>
                        </div>

                        <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid ${isDark ? '#2d3748' : '#edf1f7'}; padding-top:10px; margin-top:2px;">
                            <div style="display:flex; align-items:center; gap:10px; font-size:11px; color:${isDark ? '#b5c2d5' : '#64748b'}; font-weight:700;">
                                ${post.visit ? `<span style="display:inline-flex; align-items:center; gap:3px;"><svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>${post.visit}</span>` : ''}
                                <button class="ent2-comm-like-btn" data-post-idx="${idx}" title="좋아요 누른 유저 목록 보기" style="border:none; background:transparent; padding:0; cursor:pointer; color:inherit; font-size:inherit; font-weight:inherit; display:inline-flex; align-items:center; gap:3px;">
                                    <svg style="width:12px; height:12px; color:#ef4444;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>${post.likesLength || 0}
                                </button>
                                <button class="ent2-comm-info-btn" data-post-idx="${idx}" title="댓글 목록 및 상세보기" style="border:none; background:transparent; padding:0; cursor:pointer; color:inherit; font-size:inherit; font-weight:inherit; display:inline-flex; align-items:center; gap:3px;">
                                    <svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>${post.commentsLength || 0}
                                </button>
                            </div>
                            ${markHtml ? `<span style="display:inline-flex; align-items:center; gap:4px; color:${isDark ? '#dfeaf5' : '#33353a'}; font-size:11px; font-weight:700;">${markHtml}</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            // Bind Card Title, Thumbnail, Info and Likes Buttons
            cardsGrid.querySelectorAll('.ent2-comm-card-title').forEach(titleEl => {
                titleEl.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const idx = parseInt(titleEl.getAttribute('data-post-idx'), 10);
                    if (posts[idx]) {
                        openEnt2PostDetailModal(posts[idx], isDark);
                    }
                };
            });

            cardsGrid.querySelectorAll('.ent2-comm-card-thumb').forEach(thumbEl => {
                thumbEl.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const idx = parseInt(thumbEl.getAttribute('data-post-idx'), 10);
                    if (posts[idx]) {
                        openEnt2PostDetailModal(posts[idx], isDark);
                    }
                };
            });

            cardsGrid.querySelectorAll('.ent2-comm-info-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const idx = parseInt(btn.getAttribute('data-post-idx'), 10);
                    if (posts[idx]) {
                        openEnt2PostDetailModal(posts[idx], isDark);
                    }
                };
            });

            cardsGrid.querySelectorAll('.ent2-comm-card-author-link').forEach(link => {
                link.onclick = (e) => {
                    const uid = link.getAttribute('data-user-id');
                    if (uid) {
                        e.preventDefault();
                        e.stopPropagation();
                        openEnt2UserProfile(uid);
                    }
                };
            });

            cardsGrid.querySelectorAll('.ent2-comm-like-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const idx = parseInt(btn.getAttribute('data-post-idx'), 10);
                    if (posts[idx] && posts[idx].id) {
                        openEnt2LikeListModal(posts[idx].id, 'discuss');
                    }
                };
            });

        if (paginationEl) {
            paginationEl.innerHTML = `
                <button id="lite-comm-prev-page" style="padding:8px 16px; background:${isDark ? '#334155' : '#f1f5f9'}; color:${isDark ? '#f8fafc' : '#0f172a'}; border:none; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;" ${liteCommunityState.page <= 1 ? 'disabled' : ''}>
                    <svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
                    <span>이전 페이지</span>
                </button>
                <span style="font-size:12px; font-weight:800; color:${isDark ? '#f8fafc' : '#0f172a'};">
                    ${liteCommunityState.page} 페이지
                </span>
                <button id="lite-comm-next-page" style="padding:8px 16px; background:${isDark ? '#334155' : '#f1f5f9'}; color:${isDark ? '#f8fafc' : '#0f172a'}; border:none; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;" ${!liteCommunityState.nextSearchAfter || posts.length < 12 ? 'disabled' : ''}>
                    <span>다음 페이지</span>
                    <svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
                </button>
            `;

            const prevBtn = paginationEl.querySelector('#lite-comm-prev-page');
            const nextBtn = paginationEl.querySelector('#lite-comm-next-page');

            if (prevBtn) {
                prevBtn.onclick = () => {
                    if (liteCommunityState.page > 1) {
                        liteCommunityState.page--;
                        liteCommunityState.searchAfter = liteCommunityState.cursors[liteCommunityState.page - 1] || null;
                        executeLiteCommunityQuery(container);
                    }
                };
            }
            if (nextBtn) {
                nextBtn.onclick = () => {
                    if (liteCommunityState.nextSearchAfter) {
                        liteCommunityState.page++;
                        liteCommunityState.cursors[liteCommunityState.page - 1] = liteCommunityState.nextSearchAfter;
                        liteCommunityState.searchAfter = liteCommunityState.nextSearchAfter;
                        executeLiteCommunityQuery(container);
                    }
                };
            }
        }

    } catch (e) {
        console.error('[ent2] Community query error:', e);
        cardsGrid.innerHTML = `<div style="grid-column:1/-1; padding:32px; text-align:center; color:#ef4444; font-size:13px;">커뮤니티 데이터를 가져오는 데 실패했습니다.</div>`;
    }
}

async function renderEnt2CommTab(container, isDark, navTo) {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user') || urlParams.get('userId') || urlParams.get('id');
    if (userParam) {
        liteCommunityState.user = userParam;
        liteCommunityState.page = 1;
        liteCommunityState.searchAfter = null;
        liteCommunityState.cursors = [null];
    }

    container.innerHTML = `
        <div style="background:${isDark ? '#1e293b' : '#ffffff'}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; border-radius:24px; padding:32px; box-shadow:0 10px 30px rgba(0,0,0,0.05);">
            <div id="ent2-comm-filter-mount"></div>
        </div>
    `;

    const mount = container.querySelector('#ent2-comm-filter-mount');
    await renderLiteCommunityFilterUI(mount);
    executeLiteCommunityQuery(mount);
}

async function fetchEnt2LikeList(targetId, targetSubject = 'discuss', start = 0, display = 20) {
    try {
        const fetchHeaders = typeof getPlayEntryFetchHeaders === 'function' 
            ? getPlayEntryFetchHeaders() 
            : { 'Content-Type': 'application/json', 'x-client-type': 'Client' };

        const res = await fetch('https://playentry.org/graphql/LIKE_LIST', {
            method: 'POST',
            headers: fetchHeaders,
            credentials: 'include',
            body: JSON.stringify({
                query: `
                    query LIKE_LIST($target: String, $groupId: ID, $pageParam: PageParam) {
                        likeList(target: $target, groupId: $groupId, pageParam: $pageParam) {
                            total
                            list {
                                id
                                target
                                targetSubject
                                targetType
                                user {
                                    id
                                    nickname
                                    profileImage {
                                        id
                                        name
                                        filename
                                        imageType
                                    }
                                    status {
                                        following
                                        follower
                                    }
                                    description
                                    role
                                }
                            }
                        }
                    }
                `,
                variables: {
                    target: targetId,
                    targetSubject: targetSubject,
                    pageParam: { display: display, start: start }
                }
            })
        });
        const data = await res.json();
        return data?.data?.likeList || { total: 0, list: [] };
    } catch (e) {
        console.error('[LiteEntry] Error fetching LIKE_LIST:', e);
        return { total: 0, list: [] };
    }
}

async function fetchEnt2CommentList(targetId, display = 30, searchAfter = null) {
    try {
        const fetchHeaders = typeof getPlayEntryFetchHeaders === 'function' 
            ? getPlayEntryFetchHeaders() 
            : { 'Content-Type': 'application/json', 'x-client-type': 'Client' };

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                          document.querySelector('meta[name="csrf"]')?.getAttribute('content') || '';
        if (csrfToken) fetchHeaders['csrf-token'] = csrfToken;

        const bodyVars = {
            target: targetId,
            pageParam: { display: display, sort: 'created', order: 1 }
        };
        if (searchAfter) {
            bodyVars.searchAfter = searchAfter;
        }

        const res = await fetch('https://playentry.org/graphql/SELECT_COMMENTS', {
            method: 'POST',
            headers: fetchHeaders,
            credentials: 'include',
            body: JSON.stringify({
                query: `
                    query SELECT_COMMENTS(
                        $pageParam: PageParam
                        $target: String
                        $searchAfter: JSON
                        $likesLength: Int
                        $groupId: ID
                    ) {
                        commentList(
                            pageParam: $pageParam
                            target: $target
                            searchAfter: $searchAfter
                            likesLength: $likesLength
                            groupId: $groupId
                        ) {
                            total
                            searchAfter
                            likesLength
                            list {
                                id
                                user {
                                    id
                                    nickname
                                    profileImage {
                                        id
                                        name
                                        filename
                                        imageType
                                    }
                                    status {
                                        following
                                        follower
                                    }
                                    description
                                    role
                                    mark {
                                        id
                                        filename
                                        imageType
                                    }
                                }
                                content
                                created
                                removed
                                blamed
                                blamedBy
                                commentsLength
                                likesLength
                                isLike
                                hide
                                pinned
                                image {
                                    id
                                    name
                                    filename
                                    imageType
                                }
                                sticker {
                                    id
                                    name
                                    filename
                                    imageType
                                }
                            }
                        }
                    }
                `,
                variables: bodyVars
            })
        });
        const data = await res.json();
        return data?.data?.commentList || { total: 0, list: [], searchAfter: null };
    } catch (e) {
        console.error('[LiteEntry] Error fetching SELECT_COMMENTS:', e);
        return { total: 0, list: [], searchAfter: null };
    }
}
window.fetchEnt2CommentList = fetchEnt2CommentList;

async function openEnt2LikeListModal(targetId, targetSubject = 'discuss') {
    if (!targetId) return;
    const existing = document.getElementById('ent2-like-list-modal-overlay');
    if (existing) existing.remove();

    const isDark = getEnt2CommunityThemeMode() || document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');

    const overlay = document.createElement('div');
    overlay.id = 'ent2-like-list-modal-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999999;
        background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center; padding: 20px;
        box-sizing: border-box; font-family: 'NanumGothic', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
        <div style="background:${isDark ? '#18181b' : '#ffffff'}; color:${isDark ? '#f8fafc' : '#0f172a'}; border:1px solid ${isDark ? '#27272a' : '#e2e8f0'}; border-radius:40px; max-width:480px; width:100%; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <!-- Modal Header (Matching SVG: 좋아요 3개) -->
            <div style="padding:24px 30px 18px 30px; display:flex; align-items:center; justify-content:space-between; gap:12px; background:${isDark ? '#18181b' : '#ffffff'};">
                <div style="font-size:22px; font-weight:800; color:${isDark ? '#f8fafc' : '#000000'}; letter-spacing:-0.02em;">
                    <span>좋아요 </span><strong id="ent2-like-total-badge" style="color:#4f7cff; font-weight:800;">-</strong><span>개</span>
                </div>
                <button id="ent2-like-modal-close-btn" style="border:none; background:transparent; color:${isDark ? '#a1a1aa' : '#71717a'}; cursor:pointer; padding:6px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; transition:all 0.2s;" title="닫기">
                    <svg style="width:22px; height:22px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Modal Content List (Matching SVG: Circle avatar + 닉네임) -->
            <div id="ent2-like-list-body" style="padding:10px 30px 20px 30px; overflow-y:auto; display:flex; flex-direction:column; gap:16px; flex:1; min-height:220px;">
                <div style="text-align:center; padding:40px; color:#4f7cff; font-weight:700; font-size:13.5px;">
                    좋아요 목록을 불러오는 중...
                </div>
            </div>

            <!-- Modal Footer (Matching SVG: 최근 100건까지만 표시됩니다.) -->
            <div id="ent2-like-list-footer" style="padding:16px 30px 24px 30px; display:flex; flex-direction:column; align-items:center; gap:10px;">
                <button id="ent2-like-more-btn" style="width:100%; padding:10px 16px; border-radius:12px; background:#3182f6; color:#ffffff; font-weight:800; font-size:13px; border:none; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 12px rgba(49,130,246,0.25); display:none;">
                    더보기
                </button>
                <div style="font-size:13px; font-weight:600; color:${isDark ? '#a1a1aa' : '#565656'}; text-align:center;">
                    최근 100건까지만 표시됩니다.
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#ent2-like-modal-close-btn').onclick = () => overlay.remove();
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    let currentStart = 0;
    const display = 20;
    let loadedCount = 0;

    const bodyEl = overlay.querySelector('#ent2-like-list-body');
    const footerEl = overlay.querySelector('#ent2-like-list-footer');
    const moreBtn = overlay.querySelector('#ent2-like-more-btn');

    async function loadMoreLikes() {
        if (!bodyEl) return;
        if (currentStart === 0) {
            bodyEl.innerHTML = `
                <div style="text-align:center; padding:36px; color:#4f7cff; font-weight:700; font-size:13px;">
                    좋아요 목록을 불러오는 중...
                </div>
            `;
        } else if (moreBtn) {
            moreBtn.disabled = true;
            moreBtn.textContent = '불러오는 중...';
        }

        try {
            const likeData = await fetchEnt2LikeList(targetId, targetSubject, currentStart, display);
            const list = likeData.list || [];
            const total = likeData.total || 0;

            const totalBadge = overlay.querySelector('#ent2-like-total-badge');
            if (totalBadge) totalBadge.textContent = `${total}`;

            if (currentStart === 0) {
                bodyEl.innerHTML = '';
            }

            if (currentStart === 0 && list.length === 0) {
                bodyEl.innerHTML = `
                    <div style="text-align:center; padding:40px 20px; color:${isDark ? '#94a3b8' : '#64748b'}; font-size:13px; font-weight:600;">
                        좋아요를 누른 유저가 아직 없습니다.
                    </div>
                `;
                return;
            }

            list.forEach(item => {
                const u = item.user || {};
                const avatar = u.profileImage?.filename 
                    ? (u.profileImage.imageType === 'avatar'
                        ? `https://playentry.org/uploads/avatar/${u.profileImage.filename.slice(0, 2)}/${u.profileImage.filename.slice(2, 4)}/image/${u.profileImage.filename}.png`
                        : `https://playentry.org/uploads/${u.profileImage.filename.slice(0, 2)}/${u.profileImage.filename.slice(2, 4)}/${u.profileImage.filename}.${u.profileImage.imageType || 'png'}`
                      )
                    : 'https://playentry.org/img/DefaultCardUserThmb.svg';

                const roleBadge = u.role === 'teacher' ? '<span style="font-size:10px; font-weight:800; color:#3b82f6; background:rgba(59,130,246,0.12); padding:2px 6px; border-radius:6px; margin-left:6px;">선생님</span>' : (u.role === 'admin' ? '<span style="font-size:10px; font-weight:800; color:#ef4444; background:rgba(239,68,68,0.12); padding:2px 6px; border-radius:6px; margin-left:6px;">운영자</span>' : '');

                const profileUrl = `https://playentry.org/ent2/profile/${u.id || ''}`;

                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = `display:flex; align-items:center; justify-content:space-between; padding:4px 0; gap:14px;`;
                itemDiv.innerHTML = `
                    <a href="${escapeHtml(profileUrl)}" class="ent2-like-user-link" data-user-id="${escapeHtml(u.id || '')}" style="display:flex; align-items:center; gap:16px; text-decoration:none; overflow:hidden; flex:1;">
                        <img src="${avatar}" style="width:48px; height:48px; border-radius:50%; object-fit:cover; flex-shrink:0; border:1px solid ${isDark ? '#3f3f46' : '#d9d9d9'};" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                        <div style="overflow:hidden;">
                            <div style="font-size:17px; font-weight:800; color:${isDark ? '#f8fafc' : '#252525'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center;">
                                ${escapeHtml(u.nickname || '익명')}${roleBadge}
                            </div>
                        </div>
                    </a>
                `;

                const link = itemDiv.querySelector('.ent2-like-user-link');
                if (link) {
                    link.onclick = (e) => {
                        const uid = link.getAttribute('data-user-id');
                        if (!uid) return;
                        if (window.location.hostname === 'playentry.org' && window.location.pathname.startsWith('/ent2') && typeof handleEnt2PageRoute === 'function') {
                            e.preventDefault();
                            overlay.remove();
                            history.pushState({}, '', `/ent2/profile/${uid}`);
                            handleEnt2PageRoute();
                        }
                    };
                }

                bodyEl.appendChild(itemDiv);
            });

            loadedCount += list.length;
            currentStart += display;

            if (loadedCount < total && list.length >= display && loadedCount < 100) {
                if (moreBtn) {
                    moreBtn.style.display = 'block';
                    moreBtn.disabled = false;
                    moreBtn.textContent = `더보기 (${Math.min(total, 100) - loadedCount}명 남음)`;
                }
            } else {
                if (moreBtn) moreBtn.style.display = 'none';
            }

        } catch (err) {
            console.error(err);
            if (currentStart === 0) {
                bodyEl.innerHTML = `
                    <div style="text-align:center; padding:32px; color:#ef4444; font-size:12px; font-weight:600;">
                        좋아요 목록을 불러오는 중 오류가 발생했습니다.
                    </div>
                `;
            } else if (moreBtn) {
                moreBtn.disabled = false;
                moreBtn.textContent = '다시 시도';
            }
        }
    }

    if (moreBtn) {
        moreBtn.onclick = () => loadMoreLikes();
    }

    loadMoreLikes();
}
window.openEnt2LikeListModal = openEnt2LikeListModal;

async function loadEnt2CommentsForPost(postId, isDark) {
    const box = document.getElementById('ent2-comments-list-box');
    if (!box) return;

    const data = await fetchEnt2CommentList(postId, 50);
    const list = data.list || [];
    const total = data.total || list.length;

    const badge = document.getElementById('ent2-comments-count-badge');
    if (badge) badge.textContent = `${total}개`;

    if (list.length === 0) {
        box.innerHTML = `
            <div style="text-align:center; padding:24px; color:${isDark ? '#94a3b8' : '#64748b'}; font-size:12.5px; font-weight:600; background:${isDark ? '#0f172a' : '#f8fafc'}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; border-radius:14px;">
                작성된 댓글이 없습니다.
            </div>
        `;
        return;
    }

    box.innerHTML = list.map(c => {
        const u = c.user || {};
        const avatar = u.profileImage?.filename 
            ? (u.profileImage.imageType === 'avatar'
                ? `https://playentry.org/uploads/avatar/${u.profileImage.filename.slice(0, 2)}/${u.profileImage.filename.slice(2, 4)}/image/${u.profileImage.filename}.png`
                : `https://playentry.org/uploads/${u.profileImage.filename.slice(0, 2)}/${u.profileImage.filename.slice(2, 4)}/${u.profileImage.filename}.${u.profileImage.imageType || 'png'}`
              )
            : 'https://playentry.org/img/DefaultCardUserThmb.svg';

        const roleBadge = u.role === 'teacher' ? '<span style="font-size:10px; font-weight:800; color:#3b82f6; background:rgba(59,130,246,0.12); padding:1px 6px; border-radius:6px; margin-left:4px;">선생님</span>' : '';
        const pinnedBadge = c.pinned ? '<span style="font-size:10px; font-weight:800; color:#f59e0b; background:rgba(245,158,11,0.12); padding:1px 6px; border-radius:6px; margin-left:4px;">고정됨</span>' : '';

        const dateStr = c.created ? new Date(c.created).toLocaleString('ko-KR', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        }) : '';

        let stickerHtml = '';
        if (c.sticker && c.sticker.filename) {
            const stFn = c.sticker.filename;
            const stUrl = `https://playentry.org/uploads/${stFn.slice(0, 2)}/${stFn.slice(2, 4)}/${stFn}.${c.sticker.imageType || 'svg'}`;
            stickerHtml = `<div style="margin-top:6px;"><img src="${stUrl}" style="max-width:100px; max-height:100px; object-fit:contain;"></div>`;
        }

        let imageHtml = '';
        if (c.image && c.image.filename) {
            const imgFn = c.image.filename;
            const imgUrl = `https://playentry.org/uploads/${imgFn.slice(0, 2)}/${imgFn.slice(2, 4)}/${imgFn}.${c.image.imageType || 'png'}`;
            imageHtml = `<div style="margin-top:6px;"><img src="${imgUrl}" style="max-width:180px; max-height:180px; border-radius:8px; object-fit:cover;"></div>`;
        }

        const profileUrl = (window.location.hostname === 'playentry.org' && window.location.pathname.startsWith('/ent2'))
            ? `/ent2/profile/${u.id}`
            : `https://playentry.org/profile/${u.id}`;

        return `
            <div style="padding:14px; background:${isDark ? '#0f172a' : '#f8fafc'}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; border-radius:14px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                    <a href="${profileUrl}" class="ent2-comment-user-link" data-user-id="${u.id}" style="display:flex; align-items:center; gap:8px; text-decoration:none;">
                        <img src="${avatar}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                        <div>
                            <span style="font-size:12.5px; font-weight:800; color:${isDark ? '#f8fafc' : '#0f172a'};">
                                ${escapeHtml(u.nickname || '익명')}${roleBadge}${pinnedBadge}
                            </span>
                            <span style="font-size:10.5px; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:600; margin-left:6px;">
                                ID: <code style="font-family:monospace; color:#3182f6;">${u.id || ''}</code>
                            </span>
                        </div>
                    </a>
                    <span style="font-size:10.5px; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:600;">
                        ${dateStr}
                    </span>
                </div>
                ${c.content ? `<div style="font-size:13px; line-height:1.5; color:${isDark ? '#e2e8f0' : '#334155'}; font-weight:500; white-space:pre-wrap; word-break:break-word;">${escapeHtml(c.content)}</div>` : ''}
                ${stickerHtml}
                ${imageHtml}
                <div style="display:flex; align-items:center; gap:12px; font-size:11px; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:700; margin-top:2px;">
                    <button class="ent2-comment-like-list-btn" data-comment-id="${c.id}" style="background:transparent; border:none; color:${isDark ? '#94a3b8' : '#64748b'}; cursor:pointer; font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:8px; transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.12)'; this.style.color='#ef4444';" onmouseout="this.style.background='transparent'; this.style.color='${isDark ? '#94a3b8' : '#64748b'}';">
                        <span>좋아요 ${c.likesLength || 0}</span>
                        <span style="font-size:10px; color:#ef4444; font-weight:800; margin-left:2px;">(좋아요 목록)</span>
                    </button>
                    ${c.commentsLength ? `<span>답글 ${c.commentsLength}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    box.querySelectorAll('.ent2-comment-like-list-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const commentId = btn.getAttribute('data-comment-id');
            if (commentId) {
                openEnt2LikeListModal(commentId, 'comment');
            }
        };
    });

    box.querySelectorAll('.ent2-comment-user-link').forEach(link => {
        link.onclick = (e) => {
            const uid = link.getAttribute('data-user-id');
            if (window.location.hostname === 'playentry.org' && window.location.pathname.startsWith('/ent2') && typeof handleEnt2PageRoute === 'function') {
                e.preventDefault();
                const modal = document.getElementById('ent2-post-modal-overlay');
                if (modal) modal.remove();
                history.pushState({}, '', `/ent2/profile/${uid}`);
                handleEnt2PageRoute();
            }
        };
    });
}

async function fetchEnt2PostDetail(postId) {
    if (!postId) return null;
    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                          document.querySelector('meta[name="csrf"]')?.getAttribute('content') || '';

        const fetchHeaders = {
            'content-type': 'application/json',
            'x-client-type': 'Client'
        };
        if (csrfToken) fetchHeaders['csrf-token'] = csrfToken;

        const res = await fetch('https://playentry.org/graphql/SELECT_DISCUSS', {
            method: 'POST',
            headers: fetchHeaders,
            credentials: 'include',
            body: JSON.stringify({
                query: `
                    query SELECT_DISCUSS($id: ID!) {
                        discuss(id: $id) {
                            id
                            title
                            content
                            seContent
                            created
                            commentsLength
                            likesLength
                            favorite
                            visit
                            category
                            prefix
                            groupNotice
                            user {
                                id
                                nickname
                                profileImage {
                                    id
                                    filename
                                    imageType
                                }
                                role
                                description
                            }
                            images {
                                filename
                                imageUrl
                            }
                            blamed
                            tags
                        }
                    }
                `,
                variables: { id: postId }
            })
        });
        const json = await res.json();
        return json?.data?.discuss || null;
    } catch (e) {
        console.error('[ent2] Error fetching discuss detail via SELECT_DISCUSS:', e);
        return null;
    }
}

function extractPostFromDomCard(cardEl, pid) {
    if (!cardEl) return null;
    try {
        const authorLink = cardEl.querySelector('a[href*="/profile/"]');
        let authorId = null;
        let authorNickname = '익명';
        if (authorLink) {
            const m = authorLink.href.match(/\/profile\/([a-f0-9]{24})/i);
            if (m) authorId = m[1];
            authorNickname = authorLink.textContent.trim() || '익명';
        }

        const avatarEl = cardEl.querySelector('.css-1r40lgp, .css-17rzoh1, [class*="ec9h6r90"]');
        let avatarBg = '';
        if (avatarEl) {
            avatarBg = avatarEl.style.backgroundImage || '';
        }

        const contentEl = cardEl.querySelector('.css-6wq60h, .eqt5hs60, [class*="eqt5hs60"]');
        const content = contentEl ? contentEl.textContent.trim() : '';

        const dateEl = cardEl.querySelector('.css-lz5fzu em, [class*="e143sozh0"] em');
        const dateText = dateEl ? dateEl.textContent.trim() : '';

        const id = pid || cardEl.getAttribute('data-entrystory-id') || null;

        if (id || authorId) {
            return {
                id: id,
                title: content ? content.slice(0, 30) : '엔트리 스토리',
                content: content,
                created: dateText,
                category: 'entrystory',
                user: {
                    id: authorId,
                    nickname: authorNickname,
                    profileImageBg: avatarBg
                }
            };
        }
    } catch (e) {
        console.error('[ent2] Error extracting post from DOM card:', e);
    }
    return null;
}

async function openEnt2AnalysisSidePanel(postOrId, isDark, postCardEl) {
    if (!postOrId) return;

    let postId = typeof postOrId === 'string' ? postOrId : postOrId.id;
    let initialPost = typeof postOrId === 'object' ? postOrId : null;

    // 1. Remove hologram glow from any previous card and apply to active card
    document.querySelectorAll('.ent2-hologram-active').forEach(el => el.classList.remove('ent2-hologram-active'));

    if (postCardEl) {
        postCardEl.classList.add('ent2-hologram-active');
        try {
            postCardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
    } else if (postId) {
        const postLink = document.querySelector(`a[href*="${postId}"]`);
        if (postLink) {
            postCardEl = postLink.closest('li.css-tasfte, .eqmdslz0, li');
            if (postCardEl) {
                postCardEl.classList.add('ent2-hologram-active');
                try {
                    postCardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } catch (e) {}
            }
        }
    }

    // 2. Remove existing side panel
    const existing = document.getElementById('ent2-analysis-side-panel');
    if (existing) existing.remove();

    // 3. Inject Hologram & Font Style if not existing
    if (!document.getElementById('nanum-gothic-font-link')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'nanum-gothic-font-link';
        fontLink.href = 'https://hangeul.pstatic.net/hangeul_static/css/nanum-gothic.css';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }

    if (!document.getElementById('ent2-hologram-style')) {
        const style = document.createElement('style');
        style.id = 'ent2-hologram-style';
        style.textContent = `
            @keyframes ent2HoloGlow {
                0% {
                    box-shadow: 0 0 15px rgba(79, 124, 255, 0.35), 0 0 30px rgba(148, 163, 184, 0.24), inset 0 0 15px rgba(79, 124, 255, 0.12);
                    border-color: #4f7cff !important;
                }
                50% {
                    box-shadow: 0 0 25px rgba(148, 163, 184, 0.22), 0 0 45px rgba(71, 85, 105, 0.28), inset 0 0 20px rgba(79, 124, 255, 0.08);
                    border-color: #7aa2ff !important;
                }
                100% {
                    box-shadow: 0 0 15px rgba(79, 124, 255, 0.35), 0 0 30px rgba(148, 163, 184, 0.24), inset 0 0 15px rgba(79, 124, 255, 0.12);
                    border-color: #4f7cff !important;
                }
            }
            .ent2-hologram-active {
                animation: ent2HoloGlow 2.5s infinite linear !important;
                border: 2px solid #4f7cff !important;
                border-radius: 14px !important;
                position: relative !important;
                z-index: 1000 !important;
                transition: all 0.3s ease !important;
            }
            @keyframes ent2Spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    // 4. Create Modal Overlay Container
    const overlay = document.createElement('div');
    overlay.id = 'ent2-analysis-side-panel';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999999;
        background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;
        font-family: 'NanumGothic', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        opacity: 0; transition: opacity 0.25s ease-in-out;
    `;

    const modalBox = document.createElement('div');
    modalBox.id = 'ent2-analysis-modal-box';
    modalBox.style.cssText = `
        background: ${isDark ? '#101013' : '#ffffff'}; color: ${isDark ? '#f8fafc' : '#0f172a'};
        border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 20px;
        width: 820px; max-width: 95vw; height: 85vh; max-height: 900px;
        display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        transform: scale(0.95); transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'NanumGothic', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    modalBox.innerHTML = `
        <!-- Header -->
        <div style="padding: 16px 20px; border-bottom: 1px solid ${isDark ? '#27272a' : '#f4f4f5'}; display: flex; align-items: center; justify-content: space-between; background: ${isDark ? '#18181b' : '#fafafa'}; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 11px; font-weight: 800; color: #4f7cff; background: rgba(79, 124, 255, 0.12); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(79, 124, 255, 0.25);">
                    ent2 분석 결과
                </span>
                <span style="font-size: 14px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                    게시글 & 작성자 정밀 분석
                </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <button id="ent2-panel-fullscreen-btn" style="border: 1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}; background: ${isDark ? '#27272a' : '#f1f5f9'}; color: ${isDark ? '#f8fafc' : '#0f172a'}; cursor: pointer; padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s;" title="전체화면 / 축소 토글">
                    <svg id="ent2-fs-icon-expand" style="width: 15px; height: 15px; color: #3182f6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                    <svg id="ent2-fs-icon-compress" style="width: 15px; height: 15px; color: #4f7cff; display: none;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M9 14l-5 5m0 0h4m-4 0v-4m11 5l5-5m0 0v4m0-4h-4M9 10L4 5m0 0v4m0-4h4m11 0l5 5m0 0h-4m4 0V5"/></svg>
                    <span id="ent2-fs-btn-label">전체화면</span>
                </button>
                <button id="ent2-panel-close-btn" style="border: none; background: transparent; color: ${isDark ? '#a1a1aa' : '#71717a'}; cursor: pointer; padding: 6px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" title="닫기">
                    <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
        </div>

        <!-- Scrollable Content Body -->
        <div id="ent2-panel-body" style="padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px;">
            <div style="text-align: center; padding: 50px 20px; color: #4f7cff; font-weight: 700; font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 14px;">
                <div style="width: 32px; height: 32px; border: 3px solid rgba(79,124,255,0.25); border-top-color: #4f7cff; border-radius: 50%; animation: ent2Spin 0.8s linear infinite;"></div>
                <span>게시글 및 작성자 전적 데이터를 분석 중...</span>
            </div>
        </div>
    `;

    overlay.appendChild(modalBox);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        modalBox.style.transform = 'scale(1)';
    });

    const closePanel = () => {
        overlay.style.opacity = '0';
        modalBox.style.transform = 'scale(0.95)';
        if (postCardEl) postCardEl.classList.remove('ent2-hologram-active');
        document.querySelectorAll('.ent2-hologram-active').forEach(el => el.classList.remove('ent2-hologram-active'));
        setTimeout(() => overlay.remove(), 250);
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) closePanel();
    };

    modalBox.querySelector('#ent2-panel-close-btn').onclick = closePanel;

    let isFullscreen = false;
    const fsBtn = modalBox.querySelector('#ent2-panel-fullscreen-btn');
    const iconExpand = modalBox.querySelector('#ent2-fs-icon-expand');
    const iconCompress = modalBox.querySelector('#ent2-fs-icon-compress');
    const fsLabel = modalBox.querySelector('#ent2-fs-btn-label');

    if (fsBtn) {
        fsBtn.onclick = () => {
            isFullscreen = !isFullscreen;
            if (isFullscreen) {
                overlay.style.padding = '0';
                modalBox.style.width = '100vw';
                modalBox.style.maxWidth = '100vw';
                modalBox.style.height = '100vh';
                modalBox.style.maxHeight = '100vh';
                modalBox.style.borderRadius = '0';
                if (iconExpand) iconExpand.style.display = 'none';
                if (iconCompress) iconCompress.style.display = 'inline-block';
                if (fsLabel) fsLabel.textContent = '축소';
                fsBtn.style.background = isDark ? 'rgba(22, 216, 163, 0.15)' : 'rgba(22, 216, 163, 0.1)';
                fsBtn.style.color = '#4f7cff';
                fsBtn.style.borderColor = 'rgba(22, 216, 163, 0.3)';
            } else {
                overlay.style.padding = '20px';
                modalBox.style.width = '820px';
                modalBox.style.maxWidth = '95vw';
                modalBox.style.height = '85vh';
                modalBox.style.maxHeight = '900px';
                modalBox.style.borderRadius = '20px';
                if (iconExpand) iconExpand.style.display = 'inline-block';
                if (iconCompress) iconCompress.style.display = 'none';
                if (fsLabel) fsLabel.textContent = '전체화면';
                fsBtn.style.background = isDark ? '#27272a' : '#f1f5f9';
                fsBtn.style.color = isDark ? '#f8fafc' : '#0f172a';
                fsBtn.style.borderColor = isDark ? '#3f3f46' : '#cbd5e1';
            }
        };
    }

    // Load data and render
    let post = initialPost;
    if (postId) {
        const fetched = await fetchEnt2PostDetail(postId);
        if (fetched) {
            post = { ...initialPost, ...fetched };
        }
    }

    if (!post && postCardEl) {
        post = extractPostFromDomCard(postCardEl, postId);
    }

    if (!post && initialPost) {
        post = initialPost;
    }

    const likesData = await fetchEnt2LikeList(postId, 'discuss', 0, 50);
    const commentsData = await fetchEnt2CommentList(postId, 50);

    const bodyEl = modalBox.querySelector('#ent2-panel-body');
    if (!bodyEl) return;

    if (!post) {
        bodyEl.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:${isDark ? '#ef4444' : '#dc2626'}; font-weight:700;">
                게시글 정보를 불러오지 못했습니다. (ID: ${escapeHtml(postId)})
            </div>
        `;
        return;
    }

    const author = post.user || {};
    const likesList = likesData?.list || [];
    const likesTotal = likesData?.total || post.likesLength || 0;

    const commentsList = commentsData?.list || [];
    const commentsTotal = commentsData?.total || post.commentsLength || commentsList.length;

    // Helper date formatters matching SVG wireframe
    function formatPostDetailDate(created) {
        if (!created) return '-';
        try {
            const d = new Date(created);
            if (isNaN(d.getTime())) return created;
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const ampm = d.getHours() >= 12 ? '오후' : '오전';
            const h = d.getHours() % 12 || 12;
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${ampm} ${h}:${min}`;
        } catch (e) {
            return created;
        }
    }

    function formatCommentDetailDate(created) {
        if (!created) return '';
        try {
            const d = new Date(created);
            if (isNaN(d.getTime())) return created;
            const yy = String(d.getFullYear()).slice(-2);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${yy}.${mm}.${dd} ・ ${hh}:${min}`;
        } catch (e) {
            return created;
        }
    }

    const catMap = { qna: '묻고 답하기', tips: '노하우&팁', free: '엔트리 이야기', entrystory: '엔트리 스토리' };
    const catName = catMap[post.category] || post.category || '커뮤니티';
    const dateStr = formatPostDetailDate(post.created);
    const postDetailUrl = post.url || post.link || post.postUrl || (
        post.category === 'free' || post.category === 'entrystory'
            ? `https://playentry.org/community/entrystory/${post.id}`
            : `https://playentry.org/community/${post.category === 'qna' ? 'qna' : (post.category === 'suggestion' ? 'suggestion' : 'tips')}/${post.id}`
    );

    let authorImg = 'https://playentry.org/img/DefaultCardUserThmb.svg';
    if (author.profileImage?.filename) {
        authorImg = author.profileImage.imageType === 'avatar' 
            ? `https://playentry.org/uploads/avatar/${author.profileImage.filename.slice(0, 2)}/${author.profileImage.filename.slice(2, 4)}/image/${author.profileImage.filename}.png`
            : `https://playentry.org/uploads/${author.profileImage.filename.slice(0, 2)}/${author.profileImage.filename.slice(2, 4)}/${author.profileImage.filename}.${author.profileImage.imageType || 'png'}`;
    } else if (author.profileImageBg) {
        const match = author.profileImageBg.match(/url\(["']?([^"']+)["']?\)/i);
        if (match && match[1]) authorImg = match[1];
    }

    const allImages = extractAllPostImages(post);
    const formattedBody = formatPostContentHtml(post.content || post.seContent);

    // Extract tags (from post.tags or hashtags in content/title)
    let postTags = Array.isArray(post.tags) ? post.tags.slice() : [];
    if (postTags.length === 0) {
        const rawText = `${post.title || ''} ${(post.content || post.seContent || '')}`;
        const found = rawText.match(/#([a-zA-Z0-9가-힣_-]+)/g);
        if (found) {
            postTags = Array.from(new Set(found.map(t => t.replace('#', '').trim()))).filter(Boolean);
        }
    }

    bodyEl.innerHTML = `
        <!-- Centered Container with generous side margins -->
        <div style="width: 100%; max-width: 860px; margin: 0 auto; padding: 28px 36px 60px 36px; box-sizing: border-box; display: flex; flex-direction: column; background: ${isDark ? '#101013' : '#ffffff'};">
            
            <!-- Category Title (Large display text matching SVG: 노하우&팁) -->
            <div style="font-size: 26px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#000000'}; letter-spacing: -0.02em; margin-bottom: 8px;">
                ${escapeHtml(catName)}
            </div>

            <!-- Post Title (Matching SVG: 엔트리 작품을 전체화면으로 실행하는 법) -->
            <h1 style="font-size: 22px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#000000'}; line-height: 1.35; margin: 0 0 8px 0; word-break: break-word;">
                ${escapeHtml(post.title || '게시글')}
            </h1>

            <!-- Timestamp & Author (Matching SVG: 2026-08-09 오후 9:57) -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
                <div style="font-size: 13.5px; color: ${isDark ? '#94a3b8' : 'rgba(0,0,0,0.5)'}; font-weight: 600;">
                    ${dateStr}
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <a href="${escapeHtml(postDetailUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:8px 12px; border-radius:10px; background:linear-gradient(135deg, #3182f6, #7c3aed); color:#fff; text-decoration:none; font-size:12px; font-weight:800; box-shadow:0 10px 20px rgba(49,130,246,0.25);">
                        <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6v6M10 14L20 4"/></svg>
                        게시물로 바로가기
                    </a>
                    ${author.id ? `
                        <a href="https://playentry.org/ent2/profile/${author.id}" class="ent2-profile-nav-link" data-user-id="${escapeHtml(author.id)}" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; font-size: 13px; font-weight: 700; color: ${isDark ? '#94a3b8' : '#52525b'};">
                            <img src="${authorImg}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                            <span>${escapeHtml(author.nickname || '익명')}</span>
                        </a>
                    ` : ''}
                </div>
            </div>

            <!-- Line Divider 1 (Matching SVG: stroke="#565656") -->
            <div style="width: 100%; height: 1px; background: ${isDark ? '#3f3f46' : '#565656'}; margin-bottom: 22px;"></div>

            <!-- Post Body Content -->
            <div id="ent2-formatted-content-box" style="font-size: 15px; line-height: 1.7; color: ${isDark ? '#f8fafc' : '#000000'}; word-break: break-word; font-weight: 500; min-height: 60px;">
                ${formattedBody}
            </div>

            <div id="ent2-raw-content-box" style="display: none; font-size: 12px; line-height: 1.55; font-family: monospace; color: ${isDark ? '#a1a1aa' : '#52525b'}; background: ${isDark ? '#0f172a' : '#f1f5f9'}; border: 1px solid ${isDark ? '#334155' : '#e2e8f0'}; border-radius: 12px; padding: 14px; white-space: pre-wrap; word-break: break-all; margin-top: 14px;">
                ${escapeHtml(post.content || post.seContent || '')}
            </div>

            <!-- Tags Section (Matching SVG: #전체화면, #작품 pills) -->
            ${postTags.length > 0 ? `
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 24px;">
                    ${postTags.map(tag => `
                        <button class="ent2-post-tag-pill" data-tag="${escapeHtml(tag)}" style="padding: 7px 18px; background: ${isDark ? '#27272a' : '#F7F9FA'}; border: 1px solid ${isDark ? '#3f3f46' : '#2C313D'}; border-radius: 9.5px; color: ${isDark ? '#f8fafc' : '#2F2F2F'}; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: all 0.15s;" title="클릭 시 '${escapeHtml(tag)}' 태그로 탐색">
                            #${escapeHtml(tag)}
                        </button>
                    `).join('')}
                </div>
            ` : ''}

            <!-- Line Divider 2 (Matching SVG: stroke="#565656") -->
            <div style="width: 100%; height: 1px; background: ${isDark ? '#3f3f46' : '#565656'}; margin: 20px 0;"></div>

            <!-- Stats Row (Matching SVG: 좋아요 3개, 북마크 1개) -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 15px; font-weight: 700; color: ${isDark ? '#f8fafc' : '#000000'};">
                <div style="display: flex; align-items: center; gap: 24px;">
                    <div style="display: inline-flex; align-items: center; gap: 2px;">
                        <span>좋아요 </span>
                        <strong id="ent2-modal-like-count-btn" style="color: #4f7cff; font-weight: 800; font-size: 16px; cursor: pointer;" title="클릭 시 좋아요 누른 유저 목록 보기">
                            ${likesTotal.toLocaleString()}
                        </strong>
                        <span>개</span>
                    </div>

                    <div style="display: inline-flex; align-items: center; gap: 2px;">
                        <span>북마크 </span>
                        <strong style="color: #4f7cff; font-weight: 800; font-size: 16px;">
                            ${(post.favorite || 0).toLocaleString()}
                        </strong>
                        <span>개</span>
                    </div>

                    ${post.visit ? `
                        <div style="display: inline-flex; align-items: center; gap: 2px; color: ${isDark ? '#94a3b8' : 'rgba(0,0,0,0.55)'}; font-size: 13.5px;">
                            <span>조회수 </span>
                            <strong style="color: #3182f6; font-weight: 800; font-size: 14px;">${post.visit.toLocaleString()}</strong>
                            <span>회</span>
                        </div>
                    ` : ''}
                </div>

                <div>
                    <button id="ent2-toggle-raw-content-btn" style="border: 1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}; background: transparent; color: #3182f6; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                        Raw 코드
                    </button>
                </div>
            </div>

            <!-- Line Divider 3 (Matching SVG: stroke="#565656") -->
            <div style="width: 100%; height: 1px; background: ${isDark ? '#3f3f46' : '#565656'}; margin: 20px 0 26px 0;"></div>

            <!-- Comments Section (Matching SVG: 쩐다 / 좋아요 3개 답글 3개) -->
            <div id="ent2-comments-section" style="display: flex; flex-direction: column; gap: 28px;">
                ${commentsList.length > 0 ? commentsList.map(c => {
                    const cu = c.user || {};
                    const cuImg = cu.profileImage?.filename ? (
                        cu.profileImage.imageType === 'avatar' 
                            ? `https://playentry.org/uploads/avatar/${cu.profileImage.filename.slice(0, 2)}/${cu.profileImage.filename.slice(2, 4)}/image/${cu.profileImage.filename}.png`
                            : `https://playentry.org/uploads/${cu.profileImage.filename.slice(0, 2)}/${cu.profileImage.filename.slice(2, 4)}/${cu.profileImage.filename}.${cu.profileImage.imageType || 'png'}`
                    ) : 'https://playentry.org/img/DefaultCardUserThmb.svg';

                    const cDate = formatCommentDetailDate(c.created);
                    const cProfileUrl = `https://playentry.org/ent2/profile/${cu.id || ''}`;
                    const cLikes = c.likesLength || 0;
                    const cReplies = (Array.isArray(c.comments) ? c.comments.length : (c.commentsLength || 0));

                    let stickerImg = '';
                    if (c.sticker?.filename) {
                        stickerImg = `<img src="https://playentry.org/uploads/${c.sticker.filename.slice(0,2)}/${c.sticker.filename.slice(2,4)}/${c.sticker.filename}.${c.sticker.imageType || 'png'}" style="max-width:120px; max-height:120px; object-fit:contain; border-radius:8px; margin-top:8px;">`;
                    }
                    if (c.image?.filename) {
                        stickerImg += `<img src="https://playentry.org/uploads/${c.image.filename.slice(0,2)}/${c.image.filename.slice(2,4)}/${c.image.filename}.${c.image.imageType || 'png'}" style="max-width:240px; max-height:240px; object-fit:contain; border-radius:8px; margin-top:8px;">`;
                    }

                    return `
                        <div style="display: flex; align-items: flex-start; gap: 16px;">
                            <a href="${escapeHtml(cProfileUrl)}" class="ent2-profile-nav-link" data-user-id="${escapeHtml(cu.id || '')}" style="text-decoration: none; flex-shrink: 0;">
                                <img src="${cuImg}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 1px solid ${isDark ? '#3f3f46' : '#d9d9d9'};" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                            </a>
                            <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <a href="${escapeHtml(cProfileUrl)}" class="ent2-profile-nav-link" data-user-id="${escapeHtml(cu.id || '')}" style="font-size: 16px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#252525'}; text-decoration: none;">
                                        ${escapeHtml(cu.nickname || '익명')}
                                    </a>
                                    ${cu.role ? `<span style="font-size: 10px; font-weight: 700; color: #4f7cff; background: rgba(79,124,255,0.12); padding: 1px 6px; border-radius: 4px;">${escapeHtml(cu.role)}</span>` : ''}
                                    <span style="font-size: 13px; color: ${isDark ? '#a1a1aa' : '#818181'}; font-weight: 500;">
                                        ${cDate}
                                    </span>
                                </div>
                                <div style="font-size: 14.5px; color: ${isDark ? '#f8fafc' : '#000000'}; line-height: 1.6; white-space: pre-wrap; word-break: break-word; font-weight: 500;">
                                    ${escapeHtml((c.content || '').trim())}
                                </div>
                                ${stickerImg}
                                <div style="display: flex; align-items: center; gap: 18px; font-size: 13.5px; font-weight: 700; color: ${isDark ? '#cbd5e1' : '#000000'}; margin-top: 4px;">
                                    <div style="display: inline-flex; align-items: center; gap: 2px;">
                                        <span>좋아요 </span>
                                        <strong class="ent2-comment-likes-num-btn" data-cid="${c.id}" style="color: #4f7cff; font-weight: 800; font-size: 14px; cursor: pointer;" title="좋아요 누른 사람 목록">
                                            ${cLikes}
                                        </strong>
                                        <span>개</span>
                                    </div>
                                    <div style="display: inline-flex; align-items: center; gap: 2px;">
                                        <span>답글 </span>
                                        <strong style="color: #4f7cff; font-weight: 800; font-size: 14px;">
                                            ${cReplies}
                                        </strong>
                                        <span>개</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('') : `
                    <div style="text-align: center; padding: 36px; color: ${isDark ? '#a1a1aa' : '#818181'}; font-size: 13px; font-weight: 600;">
                        작성된 댓글이 없습니다.
                    </div>
                `}
            </div>
        </div>
    `;

    // Hook profile navigation links to https://playentry.org/ent2/profile/id
    bodyEl.querySelectorAll('.ent2-profile-nav-link').forEach(link => {
        link.onclick = (e) => {
            const uid = link.getAttribute('data-user-id');
            if (uid) {
                e.preventDefault();
                e.stopPropagation();
                closePanel();
                openEnt2UserProfile(uid);
            }
        };
    });

    // Hook comment like buttons to openEnt2LikeListModal
    bodyEl.querySelectorAll('.ent2-comment-likes-num-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const cid = btn.getAttribute('data-cid');
            if (cid && typeof openEnt2LikeListModal === 'function') {
                openEnt2LikeListModal(cid, 'comment');
            }
        };
    });

    const toggleRawBtn = bodyEl.querySelector('#ent2-toggle-raw-content-btn');
    const formattedBox = bodyEl.querySelector('#ent2-formatted-content-box');
    const rawBox = bodyEl.querySelector('#ent2-raw-content-box');
    if (toggleRawBtn && formattedBox && rawBox) {
        let isShowingRaw = false;
        toggleRawBtn.onclick = () => {
            isShowingRaw = !isShowingRaw;
            if (isShowingRaw) {
                formattedBox.style.display = 'none';
                rawBox.style.display = 'block';
                toggleRawBtn.textContent = '서식 적용 본문 보기';
            } else {
                formattedBox.style.display = 'block';
                rawBox.style.display = 'none';
                toggleRawBtn.textContent = 'Raw 코드';
            }
        };
    }

    // Hook modal like count button to openEnt2LikeListModal
    const modalLikeBtn = bodyEl.querySelector('#ent2-modal-like-count-btn');
    if (modalLikeBtn && postId) {
        modalLikeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof openEnt2LikeListModal === 'function') {
                openEnt2LikeListModal(postId, 'discuss');
            }
        };
    }

    // Hook tag pill buttons to trigger community exploration with tag
    bodyEl.querySelectorAll('.ent2-post-tag-pill').forEach(tagBtn => {
        tagBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tagVal = tagBtn.getAttribute('data-tag');
            if (tagVal) {
                closePanel();
                if (typeof liteCommunityState !== 'undefined') {
                    liteCommunityState.tag = tagVal;
                    liteCommunityState.q = '';
                    liteCommunityState.page = 1;
                    liteCommunityState.searchAfter = null;
                    liteCommunityState.cursors = [null];
                    
                    if (window.location.pathname.startsWith('/ent2/comm')) {
                        const commMount = currentCommContainer || document.getElementById('ent2-comm-filter-mount') || document.getElementById('ent2-tab-content-area');
                        if (commMount) {
                            renderLiteCommunityFilterUI(commMount);
                            executeLiteCommunityQuery(commMount);
                        }
                    } else if (typeof handleEnt2PageRoute === 'function') {
                        history.pushState({}, '', '/ent2/comm');
                        handleEnt2PageRoute();
                    }
                }
            }
        };
    });
}

function openEnt2UserProfile(userId) {
    if (!userId) return;

    const previewPanel = document.getElementById('ent2-analysis-side-panel');
    if (previewPanel) {
        previewPanel.remove();
    }
    document.querySelectorAll('.ent2-hologram-active').forEach(el => el.classList.remove('ent2-hologram-active'));

    if (window.location.hostname === 'playentry.org' && window.location.pathname.startsWith('/ent2')) {
        history.pushState({}, '', `/ent2/profile/${userId}`);
        if (typeof handleEnt2PageRoute === 'function') handleEnt2PageRoute();
    } else {
        window.location.href = `https://playentry.org/ent2/profile/${userId}`;
    }
}

function openEnt2PostDetailModal(postOrId, isDark, postCardEl) {
    openEnt2AnalysisSidePanel(postOrId, isDark, postCardEl);
}

window.openEnt2UserProfile = openEnt2UserProfile;
window.openEnt2AnalysisSidePanel = openEnt2AnalysisSidePanel;
window.openEnt2PostDetailModal = openEnt2AnalysisSidePanel;
window.renderEnt2CommTab = renderEnt2CommTab;
window.renderLiteCommunityFilterUI = renderLiteCommunityFilterUI;
