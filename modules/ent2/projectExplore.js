// ent2 Project Explore & Search Module (작품 탐색)

function getEntryProjectImageUrl(p) {
    if (!p) return 'https://playentry.org/img/DefaultCardUserThmb.svg';
    if (p.fileurl) return normalizeSafeEnt2AssetUrl(p.fileurl, 'https://playentry.org/img/DefaultCardUserThmb.svg');
    if (p.url) return normalizeSafeEnt2AssetUrl(p.url, 'https://playentry.org/img/DefaultCardUserThmb.svg');
    const fn = p.filename || p.id;
    if (!fn) return 'https://playentry.org/img/DefaultCardUserThmb.svg';
    if (typeof fn === 'string' && (fn.startsWith('http://') || fn.startsWith('https://'))) return normalizeSafeEnt2AssetUrl(fn, 'https://playentry.org/img/DefaultCardUserThmb.svg');
    if (typeof fn === 'string' && fn.startsWith('/uploads/')) return normalizeSafeEnt2AssetUrl(`https://playentry.org${fn}`, 'https://playentry.org/img/DefaultCardUserThmb.svg');

    const fnStr = String(fn);
    const sub1 = fnStr.slice(0, 2);
    const sub2 = fnStr.slice(2, 4);
    const ext = fnStr.includes('.') ? '' : `.${p.imageType || 'png'}`;
    return normalizeSafeEnt2AssetUrl(`https://playentry.org/uploads/${sub1}/${sub2}/image/${fnStr}${ext}`, 'https://playentry.org/img/DefaultCardUserThmb.svg');
}

function getEntryProjectSoundUrl(s) {
    if (!s) return '';
    if (s.fileurl) return normalizeSafeEnt2AssetUrl(s.fileurl, '');
    if (s.url) return normalizeSafeEnt2AssetUrl(s.url, '');
    const fn = s.filename || s.id;
    if (!fn) return '';
    if (typeof fn === 'string' && (fn.startsWith('http://') || fn.startsWith('https://'))) return normalizeSafeEnt2AssetUrl(fn, '');
    if (typeof fn === 'string' && fn.startsWith('/uploads/')) return normalizeSafeEnt2AssetUrl(`https://playentry.org${fn}`, '');

    const fnStr = String(fn);
    const sub1 = fnStr.slice(0, 2);
    const sub2 = fnStr.slice(2, 4);
    const ext = fnStr.includes('.') ? '' : `.${s.ext || s.soundType || 'mp3'}`;
    return normalizeSafeEnt2AssetUrl(`https://playentry.org/uploads/${sub1}/${sub2}/sound/${fnStr}${ext}`, '');
}

var ent2ProjectState = {
    preset: 'popular', // 'popular' (인작), 'staff' (스선), 'following' (팔로잉), 'all' (모든작품)
    query: '',
    user: '',
    categoryCode: '',
    sort: 'ranked',
    term: 'all',
    display: 20,
    list: [],
    total: 0,
    searchAfter: null,
    loading: false,
    hasMore: false,
    error: null
};

async function fetchEnt2Projects(isMore = false) {
    if (ent2ProjectState.loading) return;
    ent2ProjectState.loading = true;
    ent2ProjectState.error = null;

    if (!isMore) {
        ent2ProjectState.list = [];
        ent2ProjectState.hasMore = false;
    }

    const isUserSearch = !!ent2ProjectState.user && ent2ProjectState.user.trim().length > 0;
    let targetUserId = null;
    if (isUserSearch) {
        const uTrim = ent2ProjectState.user.trim();
        if (/^[0-9a-fA-F]{24}$/.test(uTrim)) {
            targetUserId = uTrim;
        } else if (typeof performEnt2UserSearch === 'function') {
            try {
                const foundUser = await performEnt2UserSearch(uTrim);
                if (foundUser && foundUser.id) {
                    targetUserId = foundUser.id;
                }
            } catch (e) {
                console.warn('[ent2] Failed to resolve user search:', e);
            }
        }
    }

    const isFollowing = !targetUserId && ent2ProjectState.preset === 'following';
    const isUserProjectList = !!targetUserId;

    let queryName = 'SELECT_PROJECTS';
    let listKey = 'projectList';
    if (isUserProjectList) {
        queryName = 'SELECT_USER_PROJECTS';
        listKey = 'userProjectList';
    } else if (isFollowing) {
        queryName = 'SELECT_FOLLOWING_PROJECTS';
        listKey = 'followingProjectList';
    }

    let graphqlQuery = '';
    if (isUserProjectList) {
        graphqlQuery = `
            query SELECT_USER_PROJECTS(
                $user: String!
                $query: String
                $categoryCode: String
                $groupId: ID
                $pageParam: PageParam
                $except: [ID]
                $searchAfter: JSON
                $searchType: String
                $term: String
                $isOpen: String
                $minCreationDate: DateTime
                $parent: ID
                $discovery: ID
            ) {
                userProjectList(
                    user: $user
                    query: $query
                    categoryCode: $categoryCode
                    groupId: $groupId
                    pageParam: $pageParam
                    except: $except
                    searchAfter: $searchAfter
                    searchType: $searchType
                    term: $term
                    isOpen: $isOpen
                    minCreationDate: $minCreationDate
                    parent: $parent
                    discovery: $discovery
                ) {
                    total
                    list {
                        id
                        name
                        user {
                            id
                            nickname
                            profileImage {
                                id
                                filename
                                imageType
                            }
                        }
                        thumb
                        isopen
                        isPracticalCourse
                        category
                        categoryCode
                        created
                        updated
                        special
                        isForLecture
                        isForStudy
                        isForSubmit
                        hashId
                        complexity
                        staffPicked
                        ranked
                        visit
                        likeCnt
                        comment
                        showComment
                        project
                    }
                    searchAfter
                }
            }
        `;
    } else if (isFollowing) {
        graphqlQuery = `
            query SELECT_FOLLOWING_PROJECTS(
                $pageParam: PageParam
                $query: String
                $categoryCode: String
                $searchAfter: JSON
                $searchType: String
                $term: String
                $tag: String
            ) {
                followingProjectList(
                    pageParam: $pageParam
                    query: $query
                    categoryCode: $categoryCode
                    searchAfter: $searchAfter
                    searchType: $searchType
                    term: $term
                    tag: $tag
                ) {
                    total
                    list {
                        id
                        name
                        user {
                            id
                            nickname
                            profileImage {
                                id
                                filename
                                imageType
                            }
                        }
                        thumb
                        isopen
                        isPracticalCourse
                        category
                        categoryCode
                        created
                        updated
                        special
                        isForLecture
                        isForStudy
                        isForSubmit
                        hashId
                        complexity
                        staffPicked
                        ranked
                        visit
                        likeCnt
                        comment
                        showComment
                    }
                    searchAfter
                }
            }
        `;
    } else {
        graphqlQuery = `
            query SELECT_PROJECTS(
                $query: String 
                $categoryCode: String
                $staffPicked: Boolean
                $ranked: Boolean
                $isAiDs: Boolean
                $isFirstPublish: Boolean
                $parent: String
                $origin: String
                $discovery: String
                $pageParam: PageParam
                $term: String
                $queryTitleOnly:Boolean
                $isChallenge:Boolean
                $searchAfter: JSON
                $searchType: String
                $cacheKey: String
                $tag: String
            ) {
                projectList(
                    query: $query
                    categoryCode: $categoryCode
                    staffPicked: $staffPicked
                    ranked: $ranked
                    isAiDs: $isAiDs
                    isFirstPublish: $isFirstPublish
                    parent: $parent
                    origin: $origin
                    discovery: $discovery
                    pageParam: $pageParam
                    term: $term
                    queryTitleOnly: $queryTitleOnly
                    isChallenge: $isChallenge
                    searchAfter: $searchAfter
                    searchType: $searchType
                    cacheKey: $cacheKey
                    tag: $tag
                ) {
                    total
                    list {
                        id
                        name
                        user {
                            id
                            nickname
                            profileImage {
                                id
                                filename
                                imageType
                            }
                        }
                        thumb
                        isopen
                        isPracticalCourse
                        category
                        categoryCode
                        created
                        updated
                        special
                        isForLecture
                        isForStudy
                        isForSubmit
                        hashId
                        complexity
                        staffPicked
                        ranked
                        visit
                        likeCnt
                        comment
                        showComment
                    }
                    last
                    searchAfter
                }
            }
        `;
    }

    const isCommentSort = ent2ProjectState.sort === 'comment' || ent2ProjectState.sort === 'comments';
    const isLikeSort = ent2ProjectState.sort === 'likeCnt';
    const isNegLikeSort = ent2ProjectState.sort === '-likeCnt';
    const isNegCommentSort = ent2ProjectState.sort === '-comment';

    let sortVal = 'published';
    if (isCommentSort || isNegCommentSort) sortVal = 'comment';
    else if (isLikeSort || isNegLikeSort) sortVal = 'likeCnt';
    else if (ent2ProjectState.sort === 'oldest') sortVal = 'published';
    else sortVal = ent2ProjectState.sort || 'published';

    const variables = {
        query: ent2ProjectState.query || null,
        term: (ent2ProjectState.term && !ent2ProjectState.term.startsWith('year-')) ? ent2ProjectState.term : "all",
        tag: null,
        searchType: "scroll",
        pageParam: {
            sort: sortVal,
            display: ent2ProjectState.display
        }
    };

    if (isUserProjectList) {
        variables.user = targetUserId;
        variables.isOpen = "all";
    }

    if (ent2ProjectState.sort === 'oldest' || isNegLikeSort || isNegCommentSort) {
        variables.pageParam.order = 1;
    }

    if (ent2ProjectState.categoryCode) {
        variables.categoryCode = ent2ProjectState.categoryCode;
    }

    if (isFollowing) {
        variables.following = true;
    } else {
        if (ent2ProjectState.preset === 'popular') {
            variables.ranked = true;
        } else if (ent2ProjectState.preset === 'staff') {
            variables.staffPicked = true;
        }
    }

    if (ent2ProjectState.searchAfter) {
        let saVal = ent2ProjectState.searchAfter;
        if (typeof saVal === 'string') {
            try { saVal = JSON.parse(saVal); } catch (e) {}
        }
        variables.searchAfter = saVal;
        variables.searchType = 'scroll';
    }

    try {
        const fetchHeaders = typeof getPlayEntryFetchHeaders === 'function' 
            ? getPlayEntryFetchHeaders() 
            : { 'Content-Type': 'application/json', 'x-client-type': 'Client' };

        const res = await fetch(`https://playentry.org/graphql/${queryName}`, {
            method: 'POST',
            headers: fetchHeaders,
            credentials: 'include',
            body: JSON.stringify({
                query: graphqlQuery,
                variables: variables
            })
        });

        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const result = await res.json();
        
        if (result.errors && result.errors.length > 0) {
            throw new Error(result.errors[0].message || 'GraphQL Query Error');
        }

        const dataObj = result.data ? result.data[listKey] : null;
        if (!dataObj) throw new Error('데이터 응답 형식이 올바르지 않습니다.');

        let newList = dataObj.list || [];
        
        // 시/일/월/년 정밀 시간 범위 필터링
        const now = Date.now();
        let minTimeBoundary = null;
        let maxTimeBoundary = null;

        if (ent2ProjectState.selectedDate) {
            const dt = new Date(ent2ProjectState.selectedDate).getTime();
            if (!isNaN(dt)) minTimeBoundary = dt;
        } else if (ent2ProjectState.term && ent2ProjectState.term.startsWith('year-')) {
            const y = parseInt(ent2ProjectState.term.replace('year-', ''), 10);
            if (!isNaN(y)) {
                minTimeBoundary = new Date(`${y}-01-01T00:00:00`).getTime();
                maxTimeBoundary = new Date(`${y}-12-31T23:59:59`).getTime();
            }
        } else if (ent2ProjectState.term && ent2ProjectState.term !== 'all') {
            const hour = 3600 * 1000;
            const day = 24 * hour;
            switch (ent2ProjectState.term) {
                case '1h': minTimeBoundary = now - 1 * hour; break;
                case '3h': minTimeBoundary = now - 3 * hour; break;
                case '6h': minTimeBoundary = now - 6 * hour; break;
                case '12h': minTimeBoundary = now - 12 * hour; break;
                case 'today': minTimeBoundary = now - 1 * day; break;
                case '3d': minTimeBoundary = now - 3 * day; break;
                case 'week': minTimeBoundary = now - 7 * day; break;
                case '2w': minTimeBoundary = now - 14 * day; break;
                case 'month': minTimeBoundary = now - 30 * day; break;
                case 'quarter': minTimeBoundary = now - 90 * day; break;
                case '6m': minTimeBoundary = now - 180 * day; break;
                case '1y': minTimeBoundary = now - 365 * day; break;
                case '2y': minTimeBoundary = now - 730 * day; break;
                case '3y': minTimeBoundary = now - 1095 * day; break;
            }
        }

        if (minTimeBoundary !== null || maxTimeBoundary !== null) {
            newList = newList.filter(p => {
                const dateStr = p.created || p.updated;
                if (!dateStr) return true;
                const pTime = new Date(dateStr).getTime();
                if (minTimeBoundary !== null && pTime < minTimeBoundary) return false;
                if (maxTimeBoundary !== null && pTime > maxTimeBoundary) return false;
                return true;
            });
        }

        if (ent2ProjectState.user) {
            const searchUser = ent2ProjectState.user.toLowerCase();
            newList = newList.filter(p => {
                const uId = (p.user?.id || '').toLowerCase();
                const uNick = (p.user?.nickname || '').toLowerCase();
                const uUsername = (p.user?.username || '').toLowerCase();
                return uId.includes(searchUser) || uNick.includes(searchUser) || uUsername.includes(searchUser);
            });
        }

        if (isCommentSort) {
            newList.sort((a, b) => (b.comment || 0) - (a.comment || 0));
        } else if (isNegCommentSort) {
            newList.sort((a, b) => (a.comment || 0) - (b.comment || 0));
        } else if (isNegLikeSort) {
            newList.sort((a, b) => (a.likeCnt || 0) - (b.likeCnt || 0));
        }

        ent2ProjectState.total = dataObj.total || (ent2ProjectState.list.length + newList.length);
        ent2ProjectState.searchAfter = dataObj.searchAfter || null;

        if (isMore) {
            ent2ProjectState.list = ent2ProjectState.list.concat(newList);
        } else {
            ent2ProjectState.list = newList;
        }

        if (isCommentSort) {
            ent2ProjectState.list.sort((a, b) => (b.comment || 0) - (a.comment || 0));
        } else if (isNegCommentSort) {
            ent2ProjectState.list.sort((a, b) => (a.comment || 0) - (b.comment || 0));
        } else if (isNegLikeSort) {
            ent2ProjectState.list.sort((a, b) => (a.likeCnt || 0) - (b.likeCnt || 0));
        }

        ent2ProjectState.hasMore = newList.length >= ent2ProjectState.display && !!ent2ProjectState.searchAfter;

    } catch (err) {
        console.error('[ent2] Project fetch error:', err);
        ent2ProjectState.error = err.message || '작품 목록을 불러오는 중 오류가 발생했습니다.';
    } finally {
        ent2ProjectState.loading = false;
    }
}

async function renderEnt2ProjectExploreTab(container, isDark, navTo) {
    if (!container) return;

    const isFunEnabled = typeof Ent2Storage !== 'undefined' 
        ? await Ent2Storage.get('ent2_fun_enabled', false) 
        : false;

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <!-- Top Card Header -->
            <div style="background:${isDark ? '#19191d' : '#ffffff'}; border:1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}; border-radius:24px; padding:24px; box-shadow:0 8px 30px rgba(0,0,0,0.04); display:flex; flex-direction:column; gap:18px;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
                    <div>
                        <h2 style="font-size:20px; font-weight:800; margin:0 0 4px 0; color:${isDark ? '#f2f4f6' : '#191f28'}; display:flex; align-items:center; gap:8px;">
                            <span>작품 탐색</span>
                            <span id="ent2-proj-total-badge" style="font-size:12px; font-weight:800; background:rgba(49,130,246,0.12); color:#3182f6; padding:3px 10px; border-radius:12px;">
                                계산 중...
                            </span>
                        </h2>
                        <p style="font-size:13px; font-weight:600; margin:0; color:${isDark ? '#8b95a1' : '#6b7684'};">
                            인기 작품, 스태프 선정작, 팔로잉 작품 및 전체 엔트리 작품을 정밀 탐색합니다.
                        </p>
                    </div>

                    <!-- Preset Tabs -->
                    <div style="display:flex; gap:6px; background:${isDark ? '#101013' : '#f2f4f6'}; padding:4px; border-radius:16px; border:1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};">
                        <button data-preset="popular" class="ent2-proj-preset-btn" style="padding:8px 14px; border-radius:12px; border:none; font-size:12.5px; font-weight:800; cursor:pointer; transition:all 0.2s;">인기작품 (인작)</button>
                        <button data-preset="staff" class="ent2-proj-preset-btn" style="padding:8px 14px; border-radius:12px; border:none; font-size:12.5px; font-weight:800; cursor:pointer; transition:all 0.2s;">스태프선정 (스선)</button>
                        <button data-preset="following" class="ent2-proj-preset-btn" style="padding:8px 14px; border-radius:12px; border:none; font-size:12.5px; font-weight:800; cursor:pointer; transition:all 0.2s;">팔로잉 회원</button>
                        <button data-preset="all" class="ent2-proj-preset-btn" style="padding:8px 14px; border-radius:12px; border:none; font-size:12.5px; font-weight:800; cursor:pointer; transition:all 0.2s;">모든 작품</button>
                    </div>
                </div>

                <!-- Filters Grid -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; border-top:1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}; padding-top:16px;">
                    <div>
                        <label style="display:block; font-size:11px; font-weight:800; color:${isDark ? '#8b95a1' : '#6b7684'}; margin-bottom:6px;">검색어 (제목)</label>
                        <input type="text" id="ent2-proj-query-input" value="${escapeHtml(ent2ProjectState.query)}" placeholder="작품 제목 검색..." style="width:100%; padding:10px 14px; border:1px solid ${isDark ? '#33353a' : '#e5e8eb'}; border-radius:12px; background:${isDark ? '#101013' : '#ffffff'}; color:${isDark ? '#f2f4f6' : '#191f28'}; font-size:12.5px; font-weight:700; outline:none; box-sizing:border-box;">
                    </div>

                    <div>
                        <label style="display:block; font-size:11px; font-weight:800; color:${isDark ? '#8b95a1' : '#6b7684'}; margin-bottom:6px;">작성자 (닉네임 / ID)</label>
                        <input type="text" id="ent2-proj-user-input" value="${escapeHtml(ent2ProjectState.user)}" placeholder="작성자 닉네임/ID 검색..." style="width:100%; padding:10px 14px; border:1px solid ${isDark ? '#33353a' : '#e5e8eb'}; border-radius:12px; background:${isDark ? '#101013' : '#ffffff'}; color:${isDark ? '#f2f4f6' : '#191f28'}; font-size:12.5px; font-weight:700; outline:none; box-sizing:border-box;">
                    </div>

                    <div>
                        <label style="display:block; font-size:11px; font-weight:800; color:${isDark ? '#8b95a1' : '#6b7684'}; margin-bottom:6px;">카테고리</label>
                        <select id="ent2-proj-cat-select" style="width:100%; padding:10px 14px; border:1px solid ${isDark ? '#33353a' : '#e5e8eb'}; border-radius:12px; background:${isDark ? '#101013' : '#ffffff'}; color:${isDark ? '#f2f4f6' : '#191f28'}; font-size:12.5px; font-weight:700; outline:none; box-sizing:border-box; cursor:pointer;">
                            <option value="" ${ent2ProjectState.categoryCode === '' ? 'selected' : ''}>전체 카테고리</option>
                            <option value="game" ${ent2ProjectState.categoryCode === 'game' ? 'selected' : ''}>게임</option>
                            <option value="living" ${ent2ProjectState.categoryCode === 'living' ? 'selected' : ''}>생활과 도구</option>
                            <option value="storytelling" ${ent2ProjectState.categoryCode === 'storytelling' ? 'selected' : ''}>스토리텔링</option>
                            <option value="arts" ${ent2ProjectState.categoryCode === 'arts' ? 'selected' : ''}>예술</option>
                            <option value="knowledge" ${ent2ProjectState.categoryCode === 'knowledge' ? 'selected' : ''}>지식 공유</option>
                            <option value="etc" ${ent2ProjectState.categoryCode === 'etc' ? 'selected' : ''}>기타</option>
                        </select>
                    </div>

                    <div>
                        <label style="display:block; font-size:11px; font-weight:800; color:${isDark ? '#8b95a1' : '#6b7684'}; margin-bottom:6px;">정렬 기준</label>
                        <select id="ent2-proj-sort-select" style="width:100%; padding:10px 14px; border:1px solid ${isDark ? '#33353a' : '#e5e8eb'}; border-radius:12px; background:${isDark ? '#101013' : '#ffffff'}; color:${isDark ? '#f2f4f6' : '#191f28'}; font-size:12.5px; font-weight:700; outline:none; box-sizing:border-box; cursor:pointer;">
                            <option value="published" ${ent2ProjectState.sort === 'published' ? 'selected' : ''}>날짜순 (최신순)</option>
                            <option value="oldest" ${ent2ProjectState.sort === 'oldest' ? 'selected' : ''}>날짜순 (오래된순)</option>
                            <option value="ranked" ${ent2ProjectState.sort === 'ranked' ? 'selected' : ''}>인기순 (인작)</option>
                            <option value="staffPicked" ${ent2ProjectState.sort === 'staffPicked' ? 'selected' : ''}>스태프 추천순</option>
                            <option value="visit" ${ent2ProjectState.sort === 'visit' ? 'selected' : ''}>조회수순</option>
                            <option value="likeCnt" ${ent2ProjectState.sort === 'likeCnt' ? 'selected' : ''}>좋아요순</option>
                            <option value="comment" ${ent2ProjectState.sort === 'comment' ? 'selected' : ''}>댓글순</option>
                            ${isFunEnabled ? `
                            <optgroup label="Fun 이색 정렬 모드">
                                <option value="-likeCnt" ${ent2ProjectState.sort === '-likeCnt' ? 'selected' : ''}>-좋아요 (좋아요 적은 순)</option>
                                <option value="-comment" ${ent2ProjectState.sort === '-comment' ? 'selected' : ''}>-댓글 (댓글 적은 순)</option>
                            </optgroup>
                            ` : ''}
                        </select>
                    </div>

                    <div>
                        <label style="display:block; font-size:11px; font-weight:800; color:${isDark ? '#8b95a1' : '#6b7684'}; margin-bottom:6px;">탐색 시점 / 기간 범위</label>
                        <select id="ent2-proj-term-select" style="width:100%; padding:10px 14px; border:1px solid ${isDark ? '#33353a' : '#e5e8eb'}; border-radius:12px; background:${isDark ? '#101013' : '#ffffff'}; color:${isDark ? '#f2f4f6' : '#191f28'}; font-size:12.5px; font-weight:700; outline:none; box-sizing:border-box; cursor:pointer;">
                            <option value="all" ${ent2ProjectState.term === 'all' ? 'selected' : ''}>전체 기간</option>
                            <optgroup label="연도별 시점 탐색 (Year)">
                                <option value="year-2026" ${ent2ProjectState.term === 'year-2026' ? 'selected' : ''}>2026년 기준 탐색</option>
                                <option value="year-2025" ${ent2ProjectState.term === 'year-2025' ? 'selected' : ''}>2025년 기준 탐색</option>
                                <option value="year-2024" ${ent2ProjectState.term === 'year-2024' ? 'selected' : ''}>2024년 기준 탐색</option>
                                <option value="year-2023" ${ent2ProjectState.term === 'year-2023' ? 'selected' : ''}>2023년 기준 탐색</option>
                                <option value="year-2022" ${ent2ProjectState.term === 'year-2022' ? 'selected' : ''}>2022년 기준 탐색</option>
                                <option value="year-2021" ${ent2ProjectState.term === 'year-2021' ? 'selected' : ''}>2021년 기준 탐색</option>
                                <option value="year-2020" ${ent2ProjectState.term === 'year-2020' ? 'selected' : ''}>2020년 기준 탐색</option>
                                <option value="year-2019" ${ent2ProjectState.term === 'year-2019' ? 'selected' : ''}>2019년 기준 탐색</option>
                            </optgroup>
                            <optgroup label="일/월/년 경과 기준 (Day/Month)">
                                <option value="today" ${ent2ProjectState.term === 'today' ? 'selected' : ''}>오늘 (24시간 전)</option>
                                <option value="3d" ${ent2ProjectState.term === '3d' ? 'selected' : ''}>3일 전</option>
                                <option value="week" ${ent2ProjectState.term === 'week' ? 'selected' : ''}>7일 전 (1주)</option>
                                <option value="2w" ${ent2ProjectState.term === '2w' ? 'selected' : ''}>14일 전 (2주)</option>
                                <option value="month" ${ent2ProjectState.term === 'month' ? 'selected' : ''}>1개월 전</option>
                                <option value="quarter" ${ent2ProjectState.term === 'quarter' ? 'selected' : ''}>3개월 전</option>
                                <option value="6m" ${ent2ProjectState.term === '6m' ? 'selected' : ''}>6개월 전</option>
                                <option value="1y" ${ent2ProjectState.term === '1y' ? 'selected' : ''}>1년 전</option>
                                <option value="2y" ${ent2ProjectState.term === '2y' ? 'selected' : ''}>2년 전</option>
                                <option value="3y" ${ent2ProjectState.term === '3y' ? 'selected' : ''}>3년 전</option>
                            </optgroup>
                            <option value="custom" ${ent2ProjectState.term === 'custom' ? 'selected' : ''}>년/월/일 정밀 선택 (아래 입력)</option>
                        </select>
                    </div>

                    <div>
                        <label style="display:block; font-size:11px; font-weight:800; color:${isDark ? '#8b95a1' : '#6b7684'}; margin-bottom:6px;">정밀 시점 직접 지정 (년/월/일 searchAfter)</label>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <input type="date" id="ent2-proj-date-input" value="${ent2ProjectState.selectedDate ? ent2ProjectState.selectedDate.slice(0, 10) : ''}" style="flex:1; padding:9px 12px; border:1px solid ${isDark ? '#33353a' : '#e5e8eb'}; border-radius:12px; background:${isDark ? '#101013' : '#ffffff'}; color:${isDark ? '#f2f4f6' : '#191f28'}; font-size:12px; font-weight:600; outline:none; box-sizing:border-box;">
                            <button id="ent2-proj-date-clear-btn" type="button" style="padding:0 12px; height:37px; border-radius:12px; border:1px solid ${isDark ? '#33353a' : '#e5e8eb'}; background:${isDark ? '#22252a' : '#f1f5f9'}; color:${isDark ? '#8b95a1' : '#6b7684'}; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">초기화</button>
                        </div>
                    </div>
                </div>

                <!-- Action buttons -->
                <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px;">
                    <button id="ent2-proj-reset-btn" style="padding:10px 18px; border-radius:12px; border:1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; background:transparent; color:${isDark ? '#8b95a1' : '#6b7684'}; font-size:12.5px; font-weight:800; cursor:pointer;">
                        초기화
                    </button>
                    <button id="ent2-proj-search-btn" style="padding:10px 22px; border-radius:12px; border:none; background:#3182f6; color:#ffffff; font-size:12.5px; font-weight:800; cursor:pointer; box-shadow:0 4px 14px rgba(49,130,246,0.3);">
                        검색하기
                    </button>
                </div>
            </div>

            <!-- Project Cards Grid -->
            <div id="ent2-proj-grid-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap:18px;">
                <div style="grid-column:1/-1; text-align:center; padding:48px; color:${isDark ? '#8b95a1' : '#6b7684'}; font-weight:700;">
                    작품 목록을 불러오는 중...
                </div>
            </div>

            <!-- Footer / Load More Button -->
            <div id="ent2-proj-footer-area" style="display:flex; justify-content:center; padding:16px 0;">
                <button id="ent2-proj-more-btn" style="display:none; padding:12px 32px; border-radius:16px; border:none; background:#3182f6; color:#ffffff; font-size:13.5px; font-weight:800; cursor:pointer; box-shadow:0 6px 18px rgba(49,130,246,0.25); transition:all 0.2s;">
                    작품 더보기
                </button>
            </div>
        </div>
    `;

    const updatePresetButtons = () => {
        container.querySelectorAll('.ent2-proj-preset-btn').forEach(btn => {
            const p = btn.getAttribute('data-preset');
            const active = ent2ProjectState.preset === p;
            btn.style.background = active ? '#3182f6' : 'transparent';
            btn.style.color = active ? '#ffffff' : (isDark ? '#8b95a1' : '#6b7684');
        });
    };

    updatePresetButtons();

    // Preset button click events
    container.querySelectorAll('.ent2-proj-preset-btn').forEach(btn => {
        btn.onclick = () => {
            const p = btn.getAttribute('data-preset');
            ent2ProjectState.preset = p;
            if (p === 'popular') ent2ProjectState.sort = 'ranked';
            else if (p === 'staff') ent2ProjectState.sort = 'staffPicked';
            else if (p === 'following' || p === 'all') ent2ProjectState.sort = 'published';

            const sortSelect = container.querySelector('#ent2-proj-sort-select');
            if (sortSelect) sortSelect.value = ent2ProjectState.sort;

            updatePresetButtons();
            runProjectSearch();
        };
    });

    const queryInput = container.querySelector('#ent2-proj-query-input');
    const userInput = container.querySelector('#ent2-proj-user-input');
    const catSelect = container.querySelector('#ent2-proj-cat-select');
    const sortSelect = container.querySelector('#ent2-proj-sort-select');
    const termSelect = container.querySelector('#ent2-proj-term-select');
    const dateInput = container.querySelector('#ent2-proj-date-input');
    const dateClearBtn = container.querySelector('#ent2-proj-date-clear-btn');
    if (queryInput) {
        queryInput.onkeydown = (e) => {
            if (e.key === 'Enter') runProjectSearch();
        };
    }
    if (userInput) {
        userInput.onkeydown = (e) => {
            if (e.key === 'Enter') runProjectSearch();
        };
    }

    if (dateInput) {
        dateInput.onchange = () => {
            if (dateInput.value && dateInput.value < '2014-07-20') {
                dateInput.value = '2014-07-20';
            }
            ent2ProjectState.selectedDate = dateInput.value;
        };
    }

    if (dateClearBtn && dateInput) {
        dateClearBtn.onclick = () => {
            dateInput.value = '';
            ent2ProjectState.selectedDate = '';
            ent2ProjectState.searchAfter = null;
        };
    }

    container.querySelector('#ent2-proj-search-btn').onclick = () => runProjectSearch();

    container.querySelector('#ent2-proj-reset-btn').onclick = () => {
        ent2ProjectState.query = '';
        ent2ProjectState.user = '';
        ent2ProjectState.categoryCode = '';
        ent2ProjectState.sort = ent2ProjectState.preset === 'popular' ? 'ranked' : (ent2ProjectState.preset === 'staff' ? 'staffPicked' : 'published');
        ent2ProjectState.term = 'all';
        ent2ProjectState.selectedDate = '';
        ent2ProjectState.searchAfter = null;

        if (queryInput) queryInput.value = '';
        if (userInput) userInput.value = '';
        if (catSelect) catSelect.value = '';
        if (sortSelect) sortSelect.value = ent2ProjectState.sort;
        if (termSelect) termSelect.value = 'all';
        if (dateInput) dateInput.value = '';

        runProjectSearch();
    };

    const moreBtn = container.querySelector('#ent2-proj-more-btn');
    moreBtn.onclick = async () => {
        moreBtn.disabled = true;
        moreBtn.textContent = '불러오는 중...';
        await fetchEnt2Projects(true);
        renderProjectListResults();
    };

function computeProjSearchAfterTimestamp(term, selectedDate) {
    if (selectedDate) {
        const dateStr = selectedDate.includes('T') ? selectedDate : `${selectedDate}T23:59:59`;
        const ts = new Date(dateStr).getTime();
        if (!isNaN(ts)) return [ts];
    }
    if (!term || term === 'all') return null;

    if (term.startsWith('year-')) {
        const yr = parseInt(term.replace('year-', ''), 10);
        if (!isNaN(yr)) {
            const dt = new Date(`${yr}-12-31T23:59:59`);
            return [dt.getTime()];
        }
    }

    const now = Date.now();
    const hour = 3600 * 1000;
    const day = 24 * hour;

    let offset = null;
    switch (term) {
        case '1h': offset = 1 * hour; break;
        case '3h': offset = 3 * hour; break;
        case '6h': offset = 6 * hour; break;
        case '12h': offset = 12 * hour; break;
        case 'today': offset = 1 * day; break;
        case '3d': offset = 3 * day; break;
        case 'week': offset = 7 * day; break;
        case '2w': offset = 14 * day; break;
        case 'month': offset = 30 * day; break;
        case 'quarter': offset = 90 * day; break;
        case '6m': offset = 180 * day; break;
        case '1y': offset = 365 * day; break;
        case '2y': offset = 730 * day; break;
        case '3y': offset = 1095 * day; break;
    }

    if (offset !== null) {
        return [now - offset];
    }
    return null;
}

    async function runProjectSearch() {
        ent2ProjectState.query = queryInput ? queryInput.value.trim() : '';
        ent2ProjectState.user = userInput ? userInput.value.trim() : '';
        ent2ProjectState.categoryCode = catSelect ? catSelect.value : '';
        ent2ProjectState.sort = sortSelect ? sortSelect.value : 'published';
        ent2ProjectState.term = termSelect ? termSelect.value : 'all';

        let dateVal = dateInput ? dateInput.value.trim() : '';
        ent2ProjectState.selectedDate = dateVal;
        ent2ProjectState.searchAfter = computeProjSearchAfterTimestamp(ent2ProjectState.term, dateVal);

        const grid = container.querySelector('#ent2-proj-grid-container');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:${isDark ? '#8b95a1' : '#6b7684'}; font-weight:700; font-size:14px;">
                    <div style="display:inline-block; width:28px; height:28px; border:3px solid #3182f6; border-top-color:transparent; border-radius:50%; animation:ent2Spin 0.8s linear infinite; margin-bottom:12px;"></div>
                    <div>작품 정보를 검색 중입니다...</div>
                </div>
            `;
        }

        await fetchEnt2Projects(false);
        renderProjectListResults();
    }

    function renderProjectListResults() {
        const grid = container.querySelector('#ent2-proj-grid-container');
        const badge = container.querySelector('#ent2-proj-total-badge');
        if (badge) {
            badge.textContent = `전체 ${ent2ProjectState.total.toLocaleString()}개`;
        }

        if (ent2ProjectState.error) {
            if (grid) {
                grid.innerHTML = `
                    <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:#ef4444; font-weight:700; font-size:14px;">
                        ${escapeHtml(ent2ProjectState.error)}
                    </div>
                `;
            }
            moreBtn.style.display = 'none';
            return;
        }

        if (ent2ProjectState.list.length === 0) {
            if (grid) {
                grid.innerHTML = `
                    <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:${isDark ? '#8b95a1' : '#6b7684'}; font-weight:700; font-size:14px;">
                        검색 조건에 일치하는 작품이 없습니다.
                    </div>
                `;
            }
            moreBtn.style.display = 'none';
            return;
        }

        if (grid) {
            grid.innerHTML = ent2ProjectState.list.map((p, idx) => {
                const author = p.user || {};
                const avatar = author.profileImage?.filename
                    ? (author.profileImage.imageType === 'avatar'
                        ? `https://playentry.org/uploads/avatar/${author.profileImage.filename.slice(0, 2)}/${author.profileImage.filename.slice(2, 4)}/image/${author.profileImage.filename}.png`
                        : `https://playentry.org/uploads/${author.profileImage.filename.slice(0, 2)}/${author.profileImage.filename.slice(2, 4)}/${author.profileImage.filename}.${author.profileImage.imageType || 'png'}`
                      )
                    : 'https://playentry.org/img/DefaultCardUserThmb.svg';

                const thumbUrl = p.thumb 
                    ? (p.thumb.startsWith('http') ? p.thumb : `https://playentry.org${p.thumb}`)
                    : 'https://playentry.org/img/DefaultCardUserThmb.svg';

                const projectUrl = `https://playentry.org/project/${p.id}`;
                const authorProfileUrl = `/ent2/profile/${author.id}`;

                let badgesHtml = '';
                if (p.staffPicked) {
                    badgesHtml += `<img src="https://playentry.org/img/IcoDefaultCardStaff.svg" alt="스선" style="width:34px; height:30px; object-fit:contain; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.15));">`;
                }
                if (p.ranked) {
                    badgesHtml += `<img src="https://playentry.org/img/IcoDefaultCardPopular.svg" alt="인작" style="width:34px; height:30px; object-fit:contain; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.15));">`;
                }
                if (p.isPracticalCourse) {
                    badgesHtml += `<span style="font-size:10px; font-weight:800; color:#4f7cff; background:rgba(79,124,255,0.12); padding:2px 6px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; min-height:20px;">실과</span>`;
                }

                const createdDate = p.created ? new Date(p.created).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';

                return `
                    <div class="ent2-proj-card" data-proj-id="${p.id}" data-proj-idx="${idx}" style="background:${isDark ? '#1a2234' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.2s ease, box-shadow 0.2s ease; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.02);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 24px rgba(15,23,42,0.08)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.02)';">
                        <div>
                            <div class="ent2-proj-thumb-wrap" style="position:relative; width:100%; aspect-ratio:16/9; min-height:150px; background:#0f172a; overflow:hidden;">
                                <img src="${thumbUrl}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                                <div style="position:absolute; top:8px; left:8px; display:flex; gap:4px; flex-wrap:wrap; z-index:2;">
                                    ${badgesHtml}
                                </div>
                                <button class="ent2-proj-external-btn" data-url="${projectUrl}" title="엔트리에서 열기" style="position:absolute; top:8px; right:8px; z-index:2; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); border:1px solid rgba(255,255,255,0.2); color:#ffffff; border-radius:8px; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s;">
                                    <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                </button>
                            </div>
                            <div style="padding:10px 12px;">
                                <div class="ent2-proj-title" style="font-size:12.5px; font-weight:800; color:${isDark ? '#f8fafc' : '#0f172a'}; margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                    ${escapeHtml(p.name || '무제')}
                                </div>
                                <a href="${authorProfileUrl}" class="ent2-proj-author-link" data-author-id="${author.id}" style="display:flex; align-items:center; gap:8px; text-decoration:none;">
                                    <img src="${avatar}" style="width:22px; height:22px; border-radius:50%; object-fit:cover;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                                    <span style="font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                        ${escapeHtml(author.nickname || '익명')}
                                    </span>
                                </a>
                            </div>
                        </div>

                        <div style="padding:8px 12px; border-top:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; display:flex; align-items:center; justify-content:space-between; font-size:10.5px; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:600;">
                            <span>조회 ${(p.visit || 0).toLocaleString()}</span>
                            <button class="ent2-proj-like-btn" data-pid="${p.id}" title="좋아요 목록 보기" style="border:none; background:transparent; padding:0; cursor:pointer; color:inherit; font-size:inherit; font-weight:inherit; display:inline-flex; align-items:center; gap:2px;">
                                좋아요 ${(p.likeCnt || 0).toLocaleString()}
                            </button>
                            <button class="ent2-proj-comment-btn" data-pid="${p.id}" data-proj-idx="${idx}" title="댓글 목록 보기" style="border:none; background:transparent; padding:0; cursor:pointer; color:inherit; font-size:inherit; font-weight:inherit; display:inline-flex; align-items:center; gap:2px;">
                                댓글 ${(p.comment || 0).toLocaleString()}
                            </button>
                            <span>${createdDate}</span>
                        </div>
                    </div>
                `;
            }).join('');

            // Card click handler -> Open Project Analysis Modal
            grid.querySelectorAll('.ent2-proj-card').forEach(card => {
                card.onclick = (e) => {
                    if (e.target.closest('.ent2-proj-author-link') || 
                        e.target.closest('.ent2-proj-like-btn') || 
                        e.target.closest('.ent2-proj-external-btn')) {
                        return;
                    }
                    const pid = card.getAttribute('data-proj-id');
                    if (pid) {
                        openEnt2ProjectAnalysisModal(pid, isDark);
                    }
                };
            });

            // External link button click handler
            grid.querySelectorAll('.ent2-proj-external-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const url = btn.getAttribute('data-url');
                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                };
            });

            // Author link routing click handler
            grid.querySelectorAll('.ent2-proj-author-link').forEach(link => {
                link.onclick = (e) => {
                    e.stopPropagation();
                    const uid = link.getAttribute('data-author-id');
                    if (uid && typeof navTo === 'function') {
                        e.preventDefault();
                        navTo(`/ent2/profile/${uid}`);
                    }
                };
            });

            // Project Like List click handler
            grid.querySelectorAll('.ent2-proj-like-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const pid = btn.getAttribute('data-pid');
                    if (pid && typeof openEnt2LikeListModal === 'function') {
                        openEnt2LikeListModal(pid, 'project');
                    }
                };
            });

            // Project Comment Modal click handler
            grid.querySelectorAll('.ent2-proj-comment-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const pid = btn.getAttribute('data-pid');
                    if (pid) {
                        openEnt2ProjectAnalysisModal(pid, isDark, 'comments');
                    }
                };
            });
        }

        if (ent2ProjectState.hasMore) {
            moreBtn.style.display = 'inline-block';
            moreBtn.disabled = false;
            moreBtn.textContent = '작품 더보기';
        } else {
            moreBtn.style.display = 'none';
        }
    }

    // Initial search execution
    runProjectSearch();
}

async function fetchEnt2ProjectDetail(projectId) {
    if (!projectId) return null;
    try {
        const fetchHeaders = typeof getPlayEntryFetchHeaders === 'function'
            ? getPlayEntryFetchHeaders()
            : { 'Content-Type': 'application/json', 'x-client-type': 'Client' };

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                          document.querySelector('meta[name="csrf"]')?.getAttribute('content') || '';
        if (csrfToken) fetchHeaders['csrf-token'] = csrfToken;

        const res = await fetch('https://playentry.org/graphql/SELECT_PROJECT', {
            method: 'POST',
            headers: fetchHeaders,
            credentials: 'include',
            body: JSON.stringify({
                query: `
                    query SELECT_PROJECT($id: ID!, $groupId: ID) {
                        project(id: $id, groupId: $groupId) {
                            id
                            name
                            user {
                                id
                                nickname
                                profileImage {
                                    id
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
                            thumb
                            isopen
                            showComment
                            blamed
                            isPracticalCourse
                            category
                            categoryCode
                            created
                            updated
                            special
                            isForLecture
                            isForStudy
                            isForSubmit
                            hashId
                            complexity
                            staffPicked
                            ranked
                            visit
                            likeCnt
                            comment
                            favorite
                            shortenUrl
                            parent {
                                id
                                name
                                user {
                                    id
                                    nickname
                                }
                            }
                            description
                            description2
                            description3
                            hasRealTimeVariable
                            blockCategoryUsage
                            childCnt
                            published
                            isFirstPublish
                            tags
                            speed
                            objects
                            variables
                            cloudVariable
                            messages
                            functions
                            tables
                            scenes
                            realTimeVariable {
                                variableType
                                key
                                value
                                array {
                                    key
                                    data
                                }
                                minValue
                                maxValue
                                visible
                                x
                                y
                                width
                                height
                                object
                            }
                            learning
                            expansionBlocks
                            aiUtilizeBlocks
                            hardwareLiteBlocks
                        }
                    }
                `,
                variables: { id: projectId }
            })
        });
        const data = await res.json();
        return data?.data?.project || null;
    } catch (e) {
        console.error('[ent2] Error fetching SELECT_PROJECT:', e);
        return null;
    }
}

async function openEnt2ProjectAnalysisModal(projectOrId, isDark, initialTab = 'overview') {
    if (!projectOrId) return;

    const projectId = typeof projectOrId === 'string' ? projectOrId : projectOrId.id;

    // Remove existing modal if open
    const existing = document.getElementById('ent2-project-analysis-modal-overlay');
    if (existing) existing.remove();

    // Inject Font & Style if needed
    if (!document.getElementById('nanum-gothic-font-link')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'nanum-gothic-font-link';
        fontLink.href = 'https://hangeul.pstatic.net/hangeul_static/css/nanum-gothic.css';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }

    const overlay = document.createElement('div');
    overlay.id = 'ent2-project-analysis-modal-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999999;
        background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(10px);
        display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;
        font-family: 'NanumGothic', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        opacity: 0; transition: opacity 0.25s ease-in-out;
    `;

    const modalBox = document.createElement('div');
    modalBox.id = 'ent2-project-analysis-modal-box';
    modalBox.style.cssText = `
        background: ${isDark ? '#101013' : '#ffffff'}; color: ${isDark ? '#f8fafc' : '#0f172a'};
        border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 24px;
        width: 1000px; max-width: 95vw; height: 90vh; max-height: 940px;
        display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        transform: scale(0.95); transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'NanumGothic', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    modalBox.innerHTML = `
        <!-- Header -->
        <div style="padding: 16px 22px; border-bottom: 1px solid ${isDark ? '#27272a' : '#f4f4f5'}; display: flex; align-items: center; justify-content: space-between; background: ${isDark ? '#18181b' : '#fafafa'}; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                <span style="font-size: 11px; font-weight: 800; color: #4f7cff; background: rgba(79, 124, 255, 0.12); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(79, 124, 255, 0.25); white-space: nowrap;">
                    ent2 작품 정밀 분석
                </span>
                <span id="ent2-proj-modal-title" style="font-size: 14.5px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    불러오는 중...
                </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <button id="ent2-proj-fullscreen-btn" style="border: 1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}; background: ${isDark ? '#27272a' : '#f1f5f9'}; color: ${isDark ? '#f8fafc' : '#0f172a'}; cursor: pointer; padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s;" title="전체화면 토글">
                    <svg id="ent2-proj-fs-icon-expand" style="width: 15px; height: 15px; color: #3182f6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                    <svg id="ent2-proj-fs-icon-compress" style="width: 15px; height: 15px; color: #4f7cff; display: none;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M9 14l-5 5m0 0h4m-4 0v-4m11 5l5-5m0 0v4m0-4h-4M9 10L4 5m0 0v4m0-4h4m11 0l5 5m0 0h-4m4 0V5"/></svg>
                    <span id="ent2-proj-fs-label">전체화면</span>
                </button>
                <button id="ent2-proj-modal-close-btn" style="border: none; background: transparent; color: ${isDark ? '#a1a1aa' : '#71717a'}; cursor: pointer; padding: 6px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" title="닫기">
                    <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
        </div>

        <!-- Scrollable Content Body -->
        <div id="ent2-proj-modal-body" style="padding: 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px;">
            <div style="text-align: center; padding: 60px 20px; color: #4f7cff; font-weight: 700; font-size: 13.5px; display: flex; flex-direction: column; align-items: center; gap: 14px;">
                <div style="width: 34px; height: 34px; border: 3px solid rgba(79,124,255,0.25); border-top-color: #4f7cff; border-radius: 50%; animation: ent2Spin 0.8s linear infinite;"></div>
                <span>작품의 오브젝트, 변수, 블록 및 전체 메타데이터를 정밀 분석하는 중입니다...</span>
            </div>
        </div>
    `;

    overlay.appendChild(modalBox);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        modalBox.style.transform = 'scale(1)';
    });

    const closeModal = () => {
        overlay.style.opacity = '0';
        modalBox.style.transform = 'scale(0.95)';
        setTimeout(() => overlay.remove(), 250);
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal();
    };

    modalBox.querySelector('#ent2-proj-modal-close-btn').onclick = closeModal;

    // Fullscreen Toggle
    let isFullscreen = false;
    const fsBtn = modalBox.querySelector('#ent2-proj-fullscreen-btn');
    const iconExpand = modalBox.querySelector('#ent2-proj-fs-icon-expand');
    const iconCompress = modalBox.querySelector('#ent2-proj-fs-icon-compress');
    const fsLabel = modalBox.querySelector('#ent2-proj-fs-label');

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
            } else {
                overlay.style.padding = '20px';
                modalBox.style.width = '1000px';
                modalBox.style.maxWidth = '95vw';
                modalBox.style.height = '90vh';
                modalBox.style.maxHeight = '940px';
                modalBox.style.borderRadius = '24px';
                if (iconExpand) iconExpand.style.display = 'inline-block';
                if (iconCompress) iconCompress.style.display = 'none';
                if (fsLabel) fsLabel.textContent = '전체화면';
            }
        };
    }

    // Fetch Full Project Data in parallel with Likes & Comments
    const [project, likesData, commentsData] = await Promise.all([
        fetchEnt2ProjectDetail(projectId),
        typeof fetchEnt2LikeList === 'function' ? fetchEnt2LikeList(projectId, 'project', 0, 50) : Promise.resolve(null),
        typeof fetchEnt2CommentList === 'function' ? fetchEnt2CommentList(projectId, 50) : Promise.resolve(null)
    ]);

    const titleEl = modalBox.querySelector('#ent2-proj-modal-title');
    const bodyEl = modalBox.querySelector('#ent2-proj-modal-body');
    if (!bodyEl) return;

    if (!project) {
        if (titleEl) titleEl.textContent = '작품 정보를 불러오지 못했습니다.';
        bodyEl.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:${isDark ? '#ef4444' : '#dc2626'}; font-weight:700;">
                작품 정보를 불러올 수 없습니다. 비공개 또는 삭제된 작품일 수 있습니다. (ID: ${escapeHtml(projectId)})
            </div>
        `;
        return;
    }

    if (titleEl) titleEl.textContent = project.name || '제목 없음';

    // Parse structures
    let rawObjects = [];
    try {
        rawObjects = typeof project.objects === 'string' ? JSON.parse(project.objects) : (project.objects || []);
    } catch (e) {
        rawObjects = [];
    }

    let rawVariables = [];
    try {
        rawVariables = typeof project.variables === 'string' ? JSON.parse(project.variables) : (project.variables || []);
    } catch (e) {
        rawVariables = [];
    }

    let rawMessages = [];
    try {
        rawMessages = typeof project.messages === 'string' ? JSON.parse(project.messages) : (project.messages || []);
    } catch (e) {
        rawMessages = [];
    }

    let rawFunctions = [];
    try {
        rawFunctions = typeof project.functions === 'string' ? JSON.parse(project.functions) : (project.functions || []);
    } catch (e) {
        rawFunctions = [];
    }

    let rawTables = [];
    try {
        rawTables = typeof project.tables === 'string' ? JSON.parse(project.tables) : (project.tables || []);
    } catch (e) {
        rawTables = [];
    }

    let rawScenes = [];
    try {
        rawScenes = typeof project.scenes === 'string' ? JSON.parse(project.scenes) : (project.scenes || []);
    } catch (e) {
        rawScenes = [];
    }

    // Count pictures and sounds
    let totalPictures = 0;
    let totalSounds = 0;
    let totalBlocksEstimate = 0;

    rawObjects.forEach(obj => {
        if (obj.sprite?.pictures) totalPictures += obj.sprite.pictures.length;
        if (obj.sprite?.sounds) totalSounds += obj.sprite.sounds.length;
        if (obj.script) {
            try {
                const sObj = typeof obj.script === 'string' ? JSON.parse(obj.script) : obj.script;
                if (Array.isArray(sObj)) {
                    totalBlocksEstimate += sObj.length;
                }
            } catch (e) {}
        }
    });

    const author = project.user || {};
    const likesList = likesData?.list || [];
    const likesTotal = likesData?.total || project.likeCnt || likesList.length;

    const commentsList = commentsData?.list || [];
    const commentsTotal = commentsData?.total || project.comment || commentsList.length;

    const authorImg = author.profileImage?.filename
        ? (author.profileImage.imageType === 'avatar'
            ? `https://playentry.org/uploads/avatar/${author.profileImage.filename.slice(0, 2)}/${author.profileImage.filename.slice(2, 4)}/image/${author.profileImage.filename}.png`
            : `https://playentry.org/uploads/${author.profileImage.filename.slice(0, 2)}/${author.profileImage.filename.slice(2, 4)}/${author.profileImage.filename}.${author.profileImage.imageType || 'png'}`
          )
        : 'https://playentry.org/img/DefaultCardUserThmb.svg';

    const thumbUrl = project.thumb
        ? (project.thumb.startsWith('http') ? project.thumb : `https://playentry.org${project.thumb}`)
        : 'https://playentry.org/img/DefaultCardUserThmb.svg';

    const createdDate = project.created ? new Date(project.created).toLocaleString('ko-KR') : '-';
    const updatedDate = project.updated ? new Date(project.updated).toLocaleString('ko-KR') : '-';
    const publishedDate = project.published ? new Date(project.published).toLocaleString('ko-KR') : '-';

    const categoryMap = {
        game: '게임', animation: '애니메이션', media: '미디어아트',
        physical: '피지컬', story: '스토리텔링', util: '실용',
        art: '예술', knowledge: '지식공유', other: '기타'
    };
    const catName = categoryMap[project.category] || project.category || '기타';

    let badgesHtml = '';
    if (project.staffPicked) {
        badgesHtml += `<span style="font-size:11px; font-weight:800; color:#fbbf24; background:rgba(251,191,36,0.15); border:1px solid rgba(251,191,36,0.3); padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">스태프 선정</span>`;
    }
    if (project.ranked) {
        badgesHtml += `<span style="font-size:11px; font-weight:800; color:#ef4444; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">인기작품</span>`;
    }
    if (project.isPracticalCourse) {
        badgesHtml += `<span style="font-size:11px; font-weight:800; color:#4f7cff; background:rgba(79,124,255,0.15); border:1px solid rgba(79,124,255,0.3); padding:3px 8px; border-radius:6px;">실과</span>`;
    }
    if (project.isopen) {
        badgesHtml += `<span style="font-size:11px; font-weight:800; color:#3182f6; background:rgba(49,130,246,0.12); border:1px solid rgba(49,130,246,0.25); padding:3px 8px; border-radius:6px;">공개</span>`;
    } else {
        badgesHtml += `<span style="font-size:11px; font-weight:800; color:#a1a1aa; background:rgba(161,161,170,0.12); border:1px solid rgba(161,161,170,0.25); padding:3px 8px; border-radius:6px;">비공개</span>`;
    }

    bodyEl.innerHTML = `
        <!-- Top Hero Section -->
        <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 18px; padding: 18px; display: flex; gap: 20px; flex-wrap: wrap; align-items: stretch;">
            <!-- Thumbnail Box -->
            <div style="width: 260px; max-width: 100%; border-radius: 14px; overflow: hidden; background: #000; position: relative; aspect-ratio: 16/9; flex-shrink: 0; box-shadow: 0 4px 14px rgba(0,0,0,0.2);">
                <img src="${thumbUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
            </div>

            <!-- Meta & Action Details -->
            <div style="flex: 1; min-width: 280px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
                <div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
                        <span style="font-size: 11px; font-weight: 800; color: #4f7cff; background: rgba(79,124,255,0.12); padding: 3px 8px; border-radius: 6px;">
                            ${escapeHtml(catName)}
                        </span>
                        ${badgesHtml}
                        <span style="font-size: 11px; color: ${isDark ? '#a1a1aa' : '#71717a'}; font-weight: 600; margin-left: auto;">
                            ID: <code style="color: #3182f6; font-family: monospace;">${project.id}</code>
                        </span>
                    </div>

                    <h2 style="margin: 0 0 8px 0; font-size: 19px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'}; line-height: 1.35;">
                        ${escapeHtml(project.name)}
                    </h2>

                    <!-- Author mini bar -->
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <img src="${authorImg}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1px solid ${isDark ? '#3f3f46' : '#cbd5e1'};" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                        <div>
                            <span style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                                ${escapeHtml(author.nickname || '익명')}
                            </span>
                            ${author.role ? `<span style="font-size: 10px; font-weight: 700; color: #4f7cff; background: rgba(79,124,255,0.12); padding: 1px 5px; border-radius: 4px; margin-left: 4px;">${escapeHtml(author.role)}</span>` : ''}
                        </div>
                        ${author.id ? `
                            <button id="ent2-proj-author-analyze-btn" style="border: 1px solid #3182f6; background: transparent; color: #3182f6; border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 800; cursor: pointer;">
                                프로필 분석
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Action Button Row -->
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border-top: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; padding-top: 10px;">
                    <a href="https://playentry.org/project/${project.id}" target="_blank" rel="noopener noreferrer" style="padding: 7px 12px; background: #3182f6; color: #ffffff; border-radius: 8px; font-size: 12px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 8px rgba(49,130,246,0.25);">
                        <span>엔트리 플레이</span>
                    </a>
                    <a href="https://playentry.org/ws/${project.id}" target="_blank" rel="noopener noreferrer" style="padding: 7px 12px; background: #4f7cff; color: #ffffff; border-radius: 8px; font-size: 12px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                        <span>코드 보기</span>
                    </a>
                    <a href="${thumbUrl}" target="_blank" rel="noopener noreferrer" style="padding: 7px 12px; background: ${isDark ? '#27272a' : '#f1f5f9'}; color: ${isDark ? '#f8fafc' : '#0f172a'}; border: 1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}; border-radius: 8px; font-size: 12px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                        <span>썸네일 원본</span>
                    </a>
                    <button id="ent2-proj-copy-json-btn" style="padding: 7px 12px; background: ${isDark ? '#27272a' : '#f1f5f9'}; color: ${isDark ? '#f8fafc' : '#0f172a'}; border: 1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                        <span>JSON 다운로드</span>
                    </button>
                    ${project.shortenUrl ? `
                        <button id="ent2-proj-copy-url-btn" data-url="${project.shortenUrl}" style="padding: 7px 12px; background: ${isDark ? '#27272a' : '#f1f5f9'}; color: #3182f6; border: 1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span>단축 URL 복사</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; align-items: center; gap: 6px; border-bottom: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; padding-bottom: 8px; overflow-x: auto; flex-shrink: 0;">
            <button class="ent2-proj-tab-btn active" data-tab="overview" style="padding: 8px 14px; border-radius: 10px; border: none; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: all 0.2s; background: #3182f6; color: #ffffff; white-space: nowrap;">
                개요 & 지표
            </button>
            <button class="ent2-proj-tab-btn" data-tab="objects" style="padding: 8px 14px; border-radius: 10px; border: none; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: all 0.2s; background: transparent; color: ${isDark ? '#a1a1aa' : '#71717a'}; white-space: nowrap;">
                오브젝트 & 스프라이트 (${rawObjects.length})
            </button>
            <button class="ent2-proj-tab-btn" data-tab="variables" style="padding: 8px 14px; border-radius: 10px; border: none; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: all 0.2s; background: transparent; color: ${isDark ? '#a1a1aa' : '#71717a'}; white-space: nowrap;">
                변수 & 리스트 (${rawVariables.length})
            </button>
            <button class="ent2-proj-tab-btn" data-tab="messages" style="padding: 8px 14px; border-radius: 10px; border: none; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: all 0.2s; background: transparent; color: ${isDark ? '#a1a1aa' : '#71717a'}; white-space: nowrap;">
                신호 & 함수 (${rawMessages.length}/${rawFunctions.length})
            </button>
            <button class="ent2-proj-tab-btn" data-tab="scenes" style="padding: 8px 14px; border-radius: 10px; border: none; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: all 0.2s; background: transparent; color: ${isDark ? '#a1a1aa' : '#71717a'}; white-space: nowrap;">
                장면 & 테이블 (${rawScenes.length}/${rawTables.length})
            </button>
            <button class="ent2-proj-tab-btn" data-tab="ai" style="padding: 8px 14px; border-radius: 10px; border: none; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: all 0.2s; background: transparent; color: ${isDark ? '#a1a1aa' : '#71717a'}; white-space: nowrap;">
                AI & 확장 블록
            </button>
            <button class="ent2-proj-tab-btn" data-tab="comments" style="padding: 8px 14px; border-radius: 10px; border: none; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: all 0.2s; background: transparent; color: ${isDark ? '#a1a1aa' : '#71717a'}; white-space: nowrap;">
                작품 댓글 (${commentsTotal})
            </button>
            <button class="ent2-proj-tab-btn" data-tab="likes" style="padding: 8px 14px; border-radius: 10px; border: none; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: all 0.2s; background: transparent; color: ${isDark ? '#a1a1aa' : '#71717a'}; white-space: nowrap;">
                좋아요 유저 (${likesTotal})
            </button>
        </div>

        <!-- Tab Content View Container -->
        <div id="ent2-proj-tab-content" style="display: flex; flex-direction: column; gap: 16px;"></div>
    `;

    // Hook author button
    const authorBtn = bodyEl.querySelector('#ent2-proj-author-analyze-btn');
    if (authorBtn && author.id) {
        authorBtn.onclick = () => {
            closeModal();
            if (window.location.hostname === 'playentry.org' && window.location.pathname.startsWith('/ent2')) {
                history.pushState({}, '', `/ent2/user?id=${author.id}`);
                if (typeof handleEnt2PageRoute === 'function') handleEnt2PageRoute();
            } else {
                window.location.href = `https://playentry.org/ent2/user?id=${author.id}`;
            }
        };
    }

    // Hook copy JSON button
    const copyJsonBtn = bodyEl.querySelector('#ent2-proj-copy-json-btn');
    if (copyJsonBtn) {
        copyJsonBtn.onclick = () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `entry_project_${project.id}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        };
    }

    // Hook copy short URL
    const copyUrlBtn = bodyEl.querySelector('#ent2-proj-copy-url-btn');
    if (copyUrlBtn) {
        copyUrlBtn.onclick = () => {
            const url = copyUrlBtn.getAttribute('data-url');
            if (url && navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                    copyUrlBtn.innerHTML = '<span>복사 완료</span>';
                    setTimeout(() => {
                        copyUrlBtn.innerHTML = '<span>단축 URL 복사</span>';
                    }, 2000);
                });
            }
        };
    }

    const tabContainer = bodyEl.querySelector('#ent2-proj-tab-content');

    function renderTab(tabKey) {
        modalBox.querySelectorAll('.ent2-proj-tab-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabKey) {
                btn.style.background = '#3182f6';
                btn.style.color = '#ffffff';
                btn.classList.add('active');
            } else {
                btn.style.background = 'transparent';
                btn.style.color = isDark ? '#a1a1aa' : '#71717a';
                btn.classList.remove('active');
            }
        });

        if (!tabContainer) return;

        if (tabKey === 'overview') {
            tabContainer.innerHTML = `
                <!-- Core Metrics Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
                    <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 14px; padding: 14px; text-align: center;">
                        <div style="font-size: 11px; font-weight: 700; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 4px;">조회수</div>
                        <div style="font-size: 18px; font-weight: 800; color: #3182f6;">${(project.visit || 0).toLocaleString()}</div>
                    </div>
                    <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 14px; padding: 14px; text-align: center;">
                        <div style="font-size: 11px; font-weight: 700; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 4px;">좋아요</div>
                        <div style="font-size: 18px; font-weight: 800; color: #ef4444;">${likesTotal.toLocaleString()}</div>
                    </div>
                    <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 14px; padding: 14px; text-align: center;">
                        <div style="font-size: 11px; font-weight: 700; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 4px;">댓글수</div>
                        <div style="font-size: 18px; font-weight: 800; color: #4f7cff;">${commentsTotal.toLocaleString()}</div>
                    </div>
                    <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 14px; padding: 14px; text-align: center;">
                        <div style="font-size: 11px; font-weight: 700; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 4px;">북마크</div>
                        <div style="font-size: 18px; font-weight: 800; color: #f59e0b;">${(project.favorite || 0).toLocaleString()}</div>
                    </div>
                    <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 14px; padding: 14px; text-align: center;">
                        <div style="font-size: 11px; font-weight: 700; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 4px;">리메이크 수</div>
                        <div style="font-size: 18px; font-weight: 800; color: #8b5cf6;">${(project.childCnt || 0).toLocaleString()}</div>
                    </div>
                    <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 14px; padding: 14px; text-align: center;">
                        <div style="font-size: 11px; font-weight: 700; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 4px;">실행 속도</div>
                        <div style="font-size: 18px; font-weight: 800; color: #06b6d4;">${project.speed || 60} FPS</div>
                    </div>
                </div>

                <!-- Structural Summary Numbers -->
                <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="font-size: 12px; font-weight: 800; color: #3182f6; text-transform: uppercase;">
                        작품 내부 구조 요약
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 12px; border-radius: 12px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 12.5px; font-weight: 700;">장면 (Scenes)</span>
                            <span style="font-size: 14px; font-weight: 800; color: #3182f6;">${rawScenes.length}개</span>
                        </div>
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 12px; border-radius: 12px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 12.5px; font-weight: 700;">오브젝트</span>
                            <span style="font-size: 14px; font-weight: 800; color: #4f7cff;">${rawObjects.length}개</span>
                        </div>
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 12px; border-radius: 12px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 12.5px; font-weight: 700;">총 스프라이트 모양</span>
                            <span style="font-size: 14px; font-weight: 800; color: #f59e0b;">${totalPictures}개</span>
                        </div>
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 12px; border-radius: 12px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 12.5px; font-weight: 700;">총 사운드</span>
                            <span style="font-size: 14px; font-weight: 800; color: #ec4899;">${totalSounds}개</span>
                        </div>
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 12px; border-radius: 12px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 12.5px; font-weight: 700;">변수 & 리스트</span>
                            <span style="font-size: 14px; font-weight: 800; color: #8b5cf6;">${rawVariables.length}개</span>
                        </div>
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 12px; border-radius: 12px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 12.5px; font-weight: 700;">신호 & 함수</span>
                            <span style="font-size: 14px; font-weight: 800; color: #14b8a6;">${rawMessages.length} / ${rawFunctions.length}개</span>
                        </div>
                    </div>
                </div>

                <!-- Descriptions & Information -->
                <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 14px;">
                    <div style="font-size: 12px; font-weight: 800; color: #4f7cff; text-transform: uppercase;">
                        작품 설명 및 세부사항
                    </div>

                    ${project.description ? `
                        <div>
                            <div style="font-size: 11.5px; font-weight: 800; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 4px;">작품 소개</div>
                            <div style="font-size: 13px; line-height: 1.6; color: ${isDark ? '#e4e4e7' : '#334155'}; background: ${isDark ? '#27272a' : '#ffffff'}; padding: 12px; border-radius: 10px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; white-space: pre-wrap; word-break: break-word;">${escapeHtml((project.description || '').trim())}</div>
                        </div>
                    ` : ''}

                    ${project.description2 ? `
                        <div>
                            <div style="font-size: 11.5px; font-weight: 800; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 4px;">사용법 및 조작법</div>
                            <div style="font-size: 13px; line-height: 1.6; color: ${isDark ? '#e4e4e7' : '#334155'}; background: ${isDark ? '#27272a' : '#ffffff'}; padding: 12px; border-radius: 10px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; white-space: pre-wrap; word-break: break-word;">${escapeHtml((project.description2 || '').trim())}</div>
                        </div>
                    ` : ''}

                    ${project.description3 ? `
                        <div>
                            <div style="font-size: 11.5px; font-weight: 800; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 4px;">참고사항 / 출처 / 기타</div>
                            <div style="font-size: 13px; line-height: 1.6; color: ${isDark ? '#e4e4e7' : '#334155'}; background: ${isDark ? '#27272a' : '#ffffff'}; padding: 12px; border-radius: 10px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; white-space: pre-wrap; word-break: break-word;">${escapeHtml((project.description3 || '').trim())}</div>
                        </div>
                    ` : ''}

                    ${project.parent ? `
                        <div style="background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span style="font-size: 11px; font-weight: 800; color: #8b5cf6;">리메이크 원본 작품</span>
                                <div style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'}; margin-top: 2px;">
                                    ${escapeHtml(project.parent.name || '원본 작품')} (작성자: ${escapeHtml(project.parent.user?.nickname || '익명')})
                                </div>
                            </div>
                            <a href="https://playentry.org/project/${project.parent.id}" target="_blank" rel="noopener noreferrer" style="font-size: 12px; font-weight: 800; color: #8b5cf6; text-decoration: underline;">
                                원본 보기
                            </a>
                        </div>
                    ` : ''}

                    <!-- Dates & Technical metadata table -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; font-size: 12px; margin-top: 6px;">
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 8px 12px; border-radius: 8px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'};">
                            <span style="color: ${isDark ? '#a1a1aa' : '#71717a'}; font-weight: 700;">최초 생성:</span> ${createdDate}
                        </div>
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 8px 12px; border-radius: 8px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'};">
                            <span style="color: ${isDark ? '#a1a1aa' : '#71717a'}; font-weight: 700;">최종 수정:</span> ${updatedDate}
                        </div>
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 8px 12px; border-radius: 8px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'};">
                            <span style="color: ${isDark ? '#a1a1aa' : '#71717a'}; font-weight: 700;">최초 공유:</span> ${publishedDate}
                        </div>
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 8px 12px; border-radius: 8px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'};">
                            <span style="color: ${isDark ? '#a1a1aa' : '#71717a'}; font-weight: 700;">댓글 허용:</span> ${project.showComment ? '허용됨' : '비허용'}
                        </div>
                    </div>

                    ${project.tags && project.tags.length > 0 ? `
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
                            <span style="font-size: 11.5px; font-weight: 800; color: ${isDark ? '#a1a1aa' : '#71717a'};">태그:</span>
                            ${project.tags.map(t => `<span style="font-size: 11px; font-weight: 700; color: #3182f6; background: rgba(49,130,246,0.1); padding: 3px 8px; border-radius: 6px;">#${escapeHtml(t)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (tabKey === 'objects') {
            tabContainer.innerHTML = `
                <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                            오브젝트 목록 (총 ${rawObjects.length}개)
                        </span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${rawObjects.length > 0 ? rawObjects.map((obj, i) => {
                            const pics = obj.sprite?.pictures || [];
                            const snds = obj.sprite?.sounds || [];
                            const ent = obj.entity || {};

                            return `
                                <div style="background: ${isDark ? '#27272a' : '#ffffff'}; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="font-size: 11px; font-weight: 800; color: #3182f6; background: rgba(49,130,246,0.12); padding: 2px 7px; border-radius: 6px;">
                                                #${i + 1}
                                            </span>
                                            <span style="font-size: 14px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                                                ${escapeHtml(obj.name || '오브젝트')}
                                            </span>
                                            <span style="font-size: 10px; font-weight: 700; color: ${isDark ? '#a1a1aa' : '#71717a'}; background: ${isDark ? '#18181b' : '#f1f5f9'}; padding: 2px 6px; border-radius: 4px;">
                                                타입: ${escapeHtml(obj.objectType || 'sprite')}
                                            </span>
                                            ${obj.scene ? `<span style="font-size: 10px; font-weight: 700; color: #4f7cff; background: rgba(79,124,255,0.1); padding: 2px 6px; border-radius: 4px;">장면: ${escapeHtml(obj.scene)}</span>` : ''}
                                        </div>

                                        <div style="font-size: 11px; color: ${isDark ? '#a1a1aa' : '#71717a'}; font-weight: 600;">
                                            위치: (${ent.x ?? 0}, ${ent.y ?? 0}) | 크기: (${ent.scaleX ?? 1}, ${ent.scaleY ?? 1}) | 각도: ${ent.rotation ?? 0}°
                                        </div>
                                    </div>

                                    <!-- Pictures Gallery -->
                                    ${pics.length > 0 ? `
                                        <div>
                                            <div style="font-size: 11px; font-weight: 800; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 6px;">
                                                모양 (${pics.length}개):
                                            </div>
                                            <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px;">
                                                ${pics.map(p => {
                                                    const pUrl = getEntryProjectImageUrl(p);
                                                    return `
                                                        <a href="${pUrl}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(p.name || '')} (새 탭에서 원본 보기)" style="flex-shrink: 0; width: 64px; height: 64px; border-radius: 8px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; background: ${isDark ? '#18181b' : '#f8fafc'}; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
                                                            <img src="${pUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                                                        </a>
                                                    `;
                                                }).join('')}
                                            </div>
                                        </div>
                                    ` : ''}

                                    <!-- Sounds List -->
                                    ${snds.length > 0 ? `
                                        <div>
                                            <div style="font-size: 11px; font-weight: 800; color: ${isDark ? '#a1a1aa' : '#71717a'}; margin-bottom: 4px;">
                                                소리 (${snds.length}개):
                                            </div>
                                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                                ${snds.map(s => {
                                                    const sUrl = getEntryProjectSoundUrl(s);
                                                    return `
                                                        <a href="${sUrl || '#'}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; font-weight: 600; color: ${isDark ? '#e4e4e7' : '#334155'}; background: ${isDark ? '#18181b' : '#f1f5f9'}; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; padding: 3px 8px; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                                                            <span>${escapeHtml(s.name || '사운드')}</span>
                                                            ${s.duration ? `<span style="font-size: 9.5px; opacity: 0.7;">(${(s.duration).toFixed(1)}s)</span>` : ''}
                                                        </a>
                                                    `;
                                                }).join('')}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('') : `
                            <div style="text-align: center; padding: 30px; color: ${isDark ? '#a1a1aa' : '#71717a'};">오브젝트 데이터가 없습니다.</div>
                        `}
                    </div>
                </div>
            `;
        } else if (tabKey === 'variables') {
            tabContainer.innerHTML = `
                <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 14px;">
                    <div style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                        변수 및 리스트 (총 ${rawVariables.length}개)
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px;">
                        ${rawVariables.length > 0 ? rawVariables.map(v => {
                            const isList = v.variableType === 'list' || Array.isArray(v.value) || Array.isArray(v.array);
                            const valStr = isList ? JSON.stringify(v.array || v.value || []) : String(v.value ?? '');
                            return `
                                <div style="background: ${isDark ? '#27272a' : '#ffffff'}; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 6px;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                                        <span style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                            ${escapeHtml(v.name || '변수')}
                                        </span>
                                        <span style="font-size: 10px; font-weight: 800; color: ${isList ? '#8b5cf6' : '#3182f6'}; background: ${isList ? 'rgba(139,92,246,0.12)' : 'rgba(49,130,246,0.12)'}; padding: 2px 6px; border-radius: 4px;">
                                            ${escapeHtml(v.variableType || (isList ? '리스트' : '변수'))}
                                        </span>
                                    </div>
                                    <div style="font-size: 12px; font-family: monospace; color: ${isDark ? '#dfe7f5' : '#3857c5'}; background: ${isDark ? '#18181b' : '#f8fafc'}; padding: 6px 8px; border-radius: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        값: ${escapeHtml(valStr)}
                                    </div>
                                    <div style="font-size: 10.5px; color: ${isDark ? '#a1a1aa' : '#71717a'}; display: flex; gap: 8px;">
                                        <span>화면표시: ${v.visible ? '켜짐' : '꺼짐'}</span>
                                        ${v.isCloud ? `<span style="color: #3182f6; font-weight: 700;">클라우드</span>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('') : `
                            <div style="grid-column: 1/-1; text-align: center; padding: 30px; color: ${isDark ? '#a1a1aa' : '#71717a'};">변수 데이터가 없습니다.</div>
                        `}
                    </div>
                </div>
            `;
        } else if (tabKey === 'messages') {
            tabContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
                    <!-- Messages -->
                    <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                        <div style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                            신호(메시지) 목록 (${rawMessages.length}개)
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${rawMessages.length > 0 ? rawMessages.map(m => `
                                <div style="background: ${isDark ? '#27272a' : '#ffffff'}; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; padding: 8px 12px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
                                    <span style="font-size: 12.5px; font-weight: 700; color: ${isDark ? '#f8fafc' : '#0f172a'};">${escapeHtml(m.name || '신호')}</span>
                                    <code style="font-size: 10px; color: #3182f6;">${m.id || ''}</code>
                                </div>
                            `).join('') : `
                                <div style="text-align: center; padding: 20px; color: ${isDark ? '#a1a1aa' : '#71717a'}; font-size: 12px;">등록된 신호가 없습니다.</div>
                            `}
                        </div>
                    </div>

                    <!-- Functions -->
                    <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                        <div style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                            함수(커스텀 블록) 목록 (${rawFunctions.length}개)
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${rawFunctions.length > 0 ? rawFunctions.map(f => `
                                <div style="background: ${isDark ? '#27272a' : '#ffffff'}; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; padding: 8px 12px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
                                    <span style="font-size: 12.5px; font-weight: 700; color: ${isDark ? '#f8fafc' : '#0f172a'};">${escapeHtml(f.name || '함수')}</span>
                                    <code style="font-size: 10px; color: #4f7cff;">${f.id || ''}</code>
                                </div>
                            `).join('') : `
                                <div style="text-align: center; padding: 20px; color: ${isDark ? '#a1a1aa' : '#71717a'}; font-size: 12px;">등록된 커스텀 함수가 없습니다.</div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        } else if (tabKey === 'scenes') {
            tabContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
                    <!-- Scenes -->
                    <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                        <div style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                            장면 목록 (${rawScenes.length}개)
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${rawScenes.length > 0 ? rawScenes.map((sc, i) => `
                                <div style="background: ${isDark ? '#27272a' : '#ffffff'}; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; padding: 10px 14px; border-radius: 10px; display: flex; align-items: center; justify-content: space-between;">
                                    <span style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">장면 ${i + 1}: ${escapeHtml(sc.name || '장면')}</span>
                                    <code style="font-size: 10px; color: #3182f6;">${sc.id || ''}</code>
                                </div>
                            `).join('') : `
                                <div style="text-align: center; padding: 20px; color: ${isDark ? '#a1a1aa' : '#71717a'}; font-size: 12px;">기본 장면 1개</div>
                            `}
                        </div>
                    </div>

                    <!-- Tables -->
                    <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                        <div style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                            데이터 테이블 (${rawTables.length}개)
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${rawTables.length > 0 ? rawTables.map(tb => `
                                <div style="background: ${isDark ? '#27272a' : '#ffffff'}; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; padding: 10px 14px; border-radius: 10px; display: flex; align-items: center; justify-content: space-between;">
                                    <span style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">${escapeHtml(tb.name || '테이블')}</span>
                                    <code style="font-size: 10px; color: #4f7cff;">${tb.id || ''}</code>
                                </div>
                            `).join('') : `
                                <div style="text-align: center; padding: 20px; color: ${isDark ? '#a1a1aa' : '#71717a'}; font-size: 12px;">등록된 데이터 테이블이 없습니다.</div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        } else if (tabKey === 'ai') {
            tabContainer.innerHTML = `
                <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 14px;">
                    <div style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                        인공지능 & 확장 & 하드웨어 블록
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 14px; border-radius: 12px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'};">
                            <div style="font-size: 12px; font-weight: 800; color: #3182f6; margin-bottom: 6px;">인공지능 블록 (AI)</div>
                            <div style="font-size: 13px; font-weight: 600; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                                ${Array.isArray(project.aiUtilizeBlocks) && project.aiUtilizeBlocks.length > 0 ? project.aiUtilizeBlocks.join(', ') : '사용 안 함'}
                            </div>
                        </div>

                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 14px; border-radius: 12px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'};">
                            <div style="font-size: 12px; font-weight: 800; color: #4f7cff; margin-bottom: 6px;">확장 블록 (Expansion)</div>
                            <div style="font-size: 13px; font-weight: 600; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                                ${Array.isArray(project.expansionBlocks) && project.expansionBlocks.length > 0 ? project.expansionBlocks.join(', ') : '사용 안 함'}
                            </div>
                        </div>

                        <div style="background: ${isDark ? '#27272a' : '#ffffff'}; padding: 14px; border-radius: 12px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'};">
                            <div style="font-size: 12px; font-weight: 800; color: #f59e0b; margin-bottom: 6px;">하드웨어 블록 (Hardware)</div>
                            <div style="font-size: 13px; font-weight: 600; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                                ${Array.isArray(project.hardwareLiteBlocks) && project.hardwareLiteBlocks.length > 0 ? project.hardwareLiteBlocks.join(', ') : '사용 안 함'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (tabKey === 'comments') {
            tabContainer.innerHTML = `
                <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                            작품 댓글 (${commentsTotal}개)
                        </span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${commentsList.length > 0 ? commentsList.map(c => {
                            const cu = c.user || {};
                            const cuImg = cu.profileImage?.filename ? (
                                cu.profileImage.imageType === 'avatar' 
                                    ? `https://playentry.org/uploads/avatar/${cu.profileImage.filename.slice(0, 2)}/${cu.profileImage.filename.slice(2, 4)}/image/${cu.profileImage.filename}.png`
                                    : `https://playentry.org/uploads/${cu.profileImage.filename.slice(0, 2)}/${cu.profileImage.filename.slice(2, 4)}/${cu.profileImage.filename}.${cu.profileImage.imageType || 'png'}`
                            ) : 'https://playentry.org/img/DefaultCardUserThmb.svg';

                            const cDate = c.created ? (typeof c.created === 'number' || !isNaN(Date.parse(c.created)) ? new Date(c.created).toLocaleString('ko-KR') : c.created) : '';

                            return `
                                <div style="background: ${isDark ? '#27272a' : '#ffffff'}; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <img src="${cuImg}" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                                            <a href="https://playentry.org/profile/${cu.id || ''}" target="_blank" rel="noopener noreferrer" style="font-size: 12.5px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'}; text-decoration: none;">
                                                ${escapeHtml(cu.nickname || '익명')}
                                            </a>
                                            ${cu.role ? `<span style="font-size: 9px; font-weight: 700; color: #4f7cff; background: rgba(79,124,255,0.12); padding: 1px 5px; border-radius: 4px;">${escapeHtml(cu.role)}</span>` : ''}
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="font-size: 10.5px; color: ${isDark ? '#a1a1aa' : '#71717a'};">${cDate}</span>
                                            ${(c.likesLength !== undefined && c.likesLength > 0) ? `
                                                <button class="ent2-modal-comment-likes-btn" data-cid="${c.id}" style="border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.1); color: #ef4444; border-radius: 6px; padding: 2px 7px; font-size: 10.5px; font-weight: 800; cursor: pointer;">
                                                    좋아요 ${c.likesLength}명
                                                </button>
                                            ` : `<span style="font-size: 10.5px; color: ${isDark ? '#a1a1aa' : '#71717a'}; font-weight: 600;">좋아요 0</span>`}
                                        </div>
                                    </div>
                                    <div style="font-size: 12.5px; color: ${isDark ? '#e4e4e7' : '#334155'}; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${escapeHtml((c.content || '').trim())}</div>
                                </div>
                            `;
                        }).join('') : `
                            <div style="text-align: center; padding: 30px; color: ${isDark ? '#a1a1aa' : '#71717a'}; font-size: 12px;">작성된 댓글이 없습니다.</div>
                        `}
                    </div>
                </div>
            `;

            tabContainer.querySelectorAll('.ent2-modal-comment-likes-btn').forEach(btn => {
                btn.onclick = () => {
                    const cid = btn.getAttribute('data-cid');
                    if (cid && typeof openEnt2LikeListModal === 'function') {
                        openEnt2LikeListModal(cid, 'comment');
                    }
                };
            });
        } else if (tabKey === 'likes') {
            tabContainer.innerHTML = `
                <div style="background: ${isDark ? '#18181b' : '#f8fafc'}; border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="font-size: 13px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                        좋아요 누른 유저 목록 (${likesTotal}명)
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${likesList.length > 0 ? likesList.map(item => {
                            const u = item.user || {};
                            const uImg = u.profileImage?.filename ? (
                                u.profileImage.imageType === 'avatar' 
                                    ? `https://playentry.org/uploads/avatar/${u.profileImage.filename.slice(0, 2)}/${u.profileImage.filename.slice(2, 4)}/image/${u.profileImage.filename}.png`
                                    : `https://playentry.org/uploads/${u.profileImage.filename.slice(0, 2)}/${u.profileImage.filename.slice(2, 4)}/${u.profileImage.filename}.${u.profileImage.imageType || 'png'}`
                            ) : 'https://playentry.org/img/DefaultCardUserThmb.svg';
                            return `
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: ${isDark ? '#27272a' : '#ffffff'}; padding: 8px 12px; border-radius: 10px; border: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'};">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <img src="${uImg}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                                        <span style="font-size: 12.5px; font-weight: 700; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                                            ${escapeHtml(u.nickname || '익명')}
                                        </span>
                                    </div>
                                    <a href="https://playentry.org/profile/${u.id}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; font-weight: 700; color: #3182f6; text-decoration: none;">
                                        프로필
                                    </a>
                                </div>
                            `;
                        }).join('') : `
                            <div style="text-align: center; padding: 30px; color: ${isDark ? '#a1a1aa' : '#71717a'}; font-size: 12px;">아직 좋아요를 누른 유저가 없습니다.</div>
                        `}
                    </div>
                </div>
            `;
        }
    }

    // Tab buttons click handler
    modalBox.querySelectorAll('.ent2-proj-tab-btn').forEach(btn => {
        btn.onclick = () => {
            const tabKey = btn.getAttribute('data-tab');
            renderTab(tabKey);
        };
    });

    renderTab(initialTab || 'overview');
}

async function openEnt2ProjectCommentModal(project, isDark) {
    if (!project || !project.id) return;
    openEnt2ProjectAnalysisModal(project.id, isDark, 'comments');
}

window.renderEnt2ProjectExploreTab = renderEnt2ProjectExploreTab;
window.openEnt2ProjectCommentModal = openEnt2ProjectCommentModal;
window.openEnt2ProjectAnalysisModal = openEnt2ProjectAnalysisModal;
window.fetchEnt2ProjectDetail = fetchEnt2ProjectDetail;
