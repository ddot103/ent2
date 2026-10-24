// ent2 Profile Visualizer & Data Loader Module

// Helper for handling empty/whitespace nicknames (e.g. zero-width spaces in Entry)
function formatNicknameDisplay(nickname) {
    if (!nickname) return '<span style="opacity:0.65; font-style:italic;">(공백 닉네임)</span>';
    const clean = String(nickname).replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, '');
    if (clean.length === 0) {
        return '<span style="opacity:0.65; font-style:italic;">(공백 닉네임)</span>';
    }
    return escapeHtml(nickname);
}

// State for profile community tab filter
if (typeof ent2UserCommCategory === 'undefined') {
    var ent2UserCommCategory = 'all';
}

async function fetchUserCommunityList(userId, category = 'all') {
    const headers = getPlayEntryFetchHeaders();
    let opName = 'SELECT_DISCUSS_LIST';
    let discussType = null;
    let queryCat = null;

    if (category === 'free') {
        opName = 'SELECT_ENTRYSTORY';
        discussType = 'entrystory';
    } else if (category === 'qna') {
        opName = 'SELECT_QNA_LIST';
        queryCat = 'qna';
    } else if (category === 'tips') {
        queryCat = 'tips';
    } else if (category === 'suggestion') {
        opName = 'SELECT_DISCUSS_LIST';
        queryCat = 'suggestion';
    }

    const graphqlQueryStr = `
        query ${opName}($pageParam: PageParam, $user: String, $category: String, $discussType: String) {
            discussList(pageParam: $pageParam, user: $user, category: $category, discussType: $discussType) {
                total
                list {
                    id
                    title
                    content
                    created
                    category
                    commentsLength
                    likesLength
                    visit
                    user {
                        id
                        nickname
                        profileImage { filename imageType }
                    }
                }
            }
        }
    `;

    try {
        const res = await fetch('https://playentry.org/graphql/' + opName, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
                query: graphqlQueryStr,
                variables: {
                    user: userId,
                    category: queryCat,
                    discussType: discussType,
                    pageParam: { display: 12, sort: 'created' }
                }
            })
        });

        const data = await res.json();
        const list = data?.data?.discussList?.list || [];
        const total = Number(data?.data?.discussList?.total ?? list.length ?? 0);
        return { list, total };
    } catch (err) {
        console.error('[ent2] Error fetching user community posts:', err);
        return { list: [], total: 0 };
    }
}

async function fetchUserFavoriteProjects(userId) {
    const headers = getPlayEntryFetchHeaders();
    const query = `
        query SELECT_FAVORITE_PROJECTS($user: String!, $pageParam: PageParam) {
            favoriteProjectList(user: $user, pageParam: $pageParam) {
                total
                list {
                    id
                    name
                    user {
                        id
                        nickname
                        profileImage { filename imageType }
                    }
                    thumb
                    isopen
                    category
                    categoryCode
                    created
                    updated
                    staffPicked
                    ranked
                    visit
                    likeCnt
                    comment
                    showComment
                    project
                }
            }
        }
    `;

    try {
        const res = await fetch('https://playentry.org/graphql/SELECT_FAVORITE_PROJECTS', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
                query,
                variables: {
                    user: userId,
                    pageParam: { display: 12, sort: 'created' }
                }
            })
        });

        const data = await res.json();
        const list = data?.data?.favoriteProjectList?.list || [];
        const total = Number(data?.data?.favoriteProjectList?.total ?? list.length ?? 0);
        return { list, total };
    } catch (err) {
        console.error('[ent2] Error fetching user favorite projects:', err);
        return { list: [], total: 0 };
    }
}

async function loadEnt2FullUserProfile(container, isDark, userId, navTo) {
    try {
        const queryUserStatus = `
            query FIND_USERSTATUS_BY_USERNAME($id: String) {
                userstatus(id: $id) {
                    id
                    nickname
                    username
                    description
                    shortUrl
                    created
                    profileImage {
                        id name label { ko en ja vn } filename imageType dimension { width height } trimmed { filename width height }
                    }
                    coverImage {
                        id name label { ko en ja vn } filename imageType dimension { width height } trimmed { filename width height }
                    }
                    role
                    mark {
                        id name label { ko en ja vn } filename imageType dimension { width height } trimmed { filename width height }
                    }
                    studentTerm
                    status {
                        project projectAll study studyAll community { qna tips free } following follower bookmark { project study discuss } userStatus
                    }
                    representativeContestPrizes {
                        id contest { name url enddate } badgeText prizeName prizeImageData { path } target targetSubject targetType created category
                    }
                }
            }
        `;

        const queryUserProjects = `
            query SELECT_USER_PROJECTS($user: String!, $query: String, $categoryCode: String, $groupId: ID, $pageParam: PageParam, $except: [ID], $searchAfter: JSON, $searchType: String, $term: String, $isOpen: String, $minCreationDate: DateTime, $parent: ID, $discovery: ID) {
                userProjectList(user: $user, query: $query, categoryCode: $categoryCode, groupId: $groupId, pageParam: $pageParam, except: $except, searchAfter: $searchAfter, searchType: $searchType, term: $term, isOpen: $isOpen, minCreationDate: $minCreationDate, parent: $parent, discovery: $discovery) {
                    total
                    list {
                        id name user { id nickname profileImage { id filename imageType } } thumb isopen isPracticalCourse category categoryCode created updated special isForLecture isForStudy isForSubmit hashId complexity staffPicked ranked visit likeCnt comment showComment project
                    }
                    searchAfter
                }
            }
        `;

        const headers = getPlayEntryFetchHeaders();

        const [resStatus, resProjects] = await Promise.all([
            fetch("https://playentry.org/graphql/FIND_USERSTATUS_BY_USERNAME", {
                method: "POST",
                headers,
                credentials: "include",
                body: JSON.stringify({ query: queryUserStatus, variables: { id: userId } })
            }),
            fetch("https://playentry.org/graphql/SELECT_USER_PROJECTS", {
                method: "POST",
                headers,
                credentials: "include",
                body: JSON.stringify({
                    query: queryUserProjects,
                    variables: {
                        searchType: "scroll",
                        user: userId,
                        term: "all",
                        isOpen: "all",
                        pageParam: { display: 12, sort: "created" }
                    }
                })
            })
        ]);

        const statusJson = await resStatus.json();
        const projectsJson = await resProjects.json();

        const userstatus = statusJson?.data?.userstatus;
        const userProjects = projectsJson?.data?.userProjectList;

        if (!userstatus) {
            container.innerHTML = `
                <div style="background:${isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.85)'}; backdrop-filter:blur(24px); border:1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}; border-radius:28px; padding:48px; text-align:center;">
                    <h3 style="color:#ef4444; font-size:18px; font-weight:800; margin:0 0 12px 0;">프로필을 찾을 수 없습니다</h3>
                    <p style="color:${isDark ? '#94a3b8' : '#64748b'}; font-size:13px; margin:0 0 20px 0;">존재하지 않거나 탈퇴한 유저 ID일 수 있습니다 (ID: ${escapeHtml(userId)})</p>
                    <button id="ent2-back-to-user-search" style="padding:10px 20px; background:#3182f6; color:#fff; border:none; border-radius:14px; font-size:12.5px; font-weight:700; cursor:pointer; box-shadow:0 6px 16px rgba(49,130,246,0.35);">유저 검색으로 돌아가기</button>
                </div>
            `;
            const backBtn = container.querySelector('#ent2-back-to-user-search');
            if (backBtn) backBtn.onclick = () => navTo('/ent2/user');
            return;
        }

        const buildImgUrl = (imgObj, fallbackType = 'png') => {
            if (!imgObj || !imgObj.filename) return null;
            const fn = imgObj.filename;
            const type = imgObj.imageType || fallbackType;
            if (type === 'avatar') {
                return `https://playentry.org/uploads/avatar/${fn.slice(0, 2)}/${fn.slice(2, 4)}/image/${fn}.png`;
            }
            return `https://playentry.org/uploads/${fn.slice(0, 2)}/${fn.slice(2, 4)}/${fn}.${type}`;
        };

        const avatarUrl = buildImgUrl(userstatus.profileImage, 'png') || 'https://playentry.org/img/DefaultCardUserThmb.svg';
        const coverUrl = buildImgUrl(userstatus.coverImage, 'svg');
        const markUrl = buildImgUrl(userstatus.mark, 'svg');

        logEnt2SearchHistory({
            id: userstatus.id,
            nickname: userstatus.nickname,
            query: userstatus.nickname,
            avatar: avatarUrl
        });

        const statusData = userstatus.status || {};
        const commData = statusData.community || {};
        const bookmarkData = statusData.bookmark || {};
        const prizeList = userstatus.representativeContestPrizes || [];
        const projectList = userProjects?.list || [];
        const favoriteProjectData = await fetchUserFavoriteProjects(userId);
        const favoriteProjectList = favoriteProjectData.list || [];
        const favoriteProjectTotal = favoriteProjectData.total || favoriteProjectList.length;

        // Calculated stats
        const totalCommPosts = (commData.free || 0) + (commData.qna || 0) + (commData.tips || 0);
        const totalBookmarks = (bookmarkData.project || 0) + (bookmarkData.discuss || 0) + (bookmarkData.study || 0);
        const privateProjects = Math.max(0, (statusData.projectAll || 0) - (statusData.project || 0));

        // SVG Icons
        const svgChartIcon = `<svg style="width:18px; height:18px; color:#3182f6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 012 2h2a2 2 0 012-2z"/></svg>`;
        const svgCommIcon = `<svg style="width:18px; height:18px; color:#8b5cf6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/></svg>`;
        const svgBookmarkIcon = `<svg style="width:18px; height:18px; color:#ec4899;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>`;
        const svgTrophyIcon = `<svg style="width:18px; height:18px; color:#f59e0b;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2 0h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>`;
        const svgGamepadIcon = `<svg style="width:18px; height:18px; color:#4f7cff;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5z"/></svg>`;
        const svgDocIcon = `<svg style="width:18px; height:18px; color:#8b5cf6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l5 5v11a2 2 0 01-2 2z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 2v6h6"/></svg>`;
        const svgInfoIcon = `<svg style="width:14px; height:14px; color:#3182f6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
        const svgCodeIcon = `<svg style="width:14px; height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>`;

        const fullCreatedDateStr = new Date(userstatus.created).toLocaleString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        // Calculate Days since created
        const createdMs = new Date(userstatus.created).getTime();
        const nowMs = Date.now();
        const daysDiff = Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24));
        const relativeCreatedStr = daysDiff > 365 
            ? `${Math.floor(daysDiff / 365)}년 전 가입 (${daysDiff.toLocaleString()}일째)`
            : (daysDiff > 30 ? `${Math.floor(daysDiff / 30)}개월 전 가입 (${daysDiff}일째)` : `${daysDiff}일 전 가입`);

        // Helpers
        const roleMap = { member: '일반 회원', admin: '관리자', teacher: '교사 회원', partner: '파트너' };
        const roleText = roleMap[userstatus.role] || userstatus.role || '회원';
        const userStatusText = (statusData.userStatus === 'USE' || !statusData.userStatus) ? '정상 계정' : statusData.userStatus;

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:20px;">
                <!-- 1. 프로필 커버 & 헤더 카드 -->
                <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:20px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                    <!-- 커버 이미지 -->
                    <div style="height:160px; width:100%; background:${coverUrl ? `url('${coverUrl}') center/cover no-repeat` : 'linear-gradient(135deg, #3182f6, #00c6ff)'}; position:relative; overflow:hidden;">
                        <div style="position:absolute; inset:0; background:linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%); pointer-events:none;"></div>
                        
                        <div style="position:absolute; right:16px; bottom:16px; display:flex; align-items:center; gap:8px; z-index:5;">
                            <button id="ent2-view-raw-json-btn" style="padding:6px 12px; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); color:#ffffff; border:1px solid rgba(255,255,255,0.2); border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                                ${svgCodeIcon}
                                <span>JSON 데이터</span>
                            </button>
                            <a id="ent2-official-profile-link" href="https://playentry.org/profile/${userstatus.id}" target="_blank" rel="noopener noreferrer" style="padding:6px 14px; background:#3182f6; color:#ffffff; border-radius:8px; font-size:11.5px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:5px; box-shadow:0 2px 8px rgba(49,130,246,0.3);">
                                <span>공식 프로필</span>
                                <svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                            </a>
                        </div>
                    </div>

                    <!-- 유저 정보 구역 -->
                    <div style="padding:0 24px 24px 24px; position:relative; margin-top:-44px; z-index:10;">
                        <div style="display:flex; align-items:flex-start; gap:18px; flex-wrap:wrap; margin-bottom:16px;">
                            <img src="${avatarUrl}" style="width:88px; height:88px; border-radius:50%; object-fit:cover; border:4px solid ${isDark ? '#121826' : '#ffffff'}; background:#ffffff; box-shadow:0 4px 16px rgba(0,0,0,0.12); flex-shrink:0; position:relative; z-index:2;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                            
                            <div style="padding-top:48px; flex:1; min-width:220px;">
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                    ${markUrl ? `<img src="${markUrl}" style="width:20px; height:20px;" title="마크 뱃지">` : ''}
                                    <h1 style="font-size:22px; font-weight:800; margin:0; color:${isDark ? '#f8fafc' : '#0f172a'}; letter-spacing:-0.02em; display:inline-flex; align-items:center; gap:6px;">
                                        ${formatNicknameDisplay(userstatus.nickname)}
                                    </h1>
                                    <span style="font-size:11px; font-weight:700; background:#E8F3FF; color:#3182f6; padding:3px 10px; border-radius:6px; border:1px solid #BFDBFE;">${roleText}</span>
                                    <span style="font-size:11px; font-weight:700; background:${userstatus.studentTerm ? '#EBFBF5' : '#F1F5F9'}; color:${userstatus.studentTerm ? '#047857' : '#64748B'}; padding:3px 10px; border-radius:6px; border:1px solid ${userstatus.studentTerm ? '#A7F3D0' : '#E2E8F0'};">
                                        ${userstatus.studentTerm ? '학생 인증 완료' : '일반 계정'}
                                    </span>
                                    <span style="font-size:11px; font-weight:700; background:${isDark ? 'rgba(255,255,255,0.08)' : '#F8FAFC'}; color:${isDark ? '#CBD5E1' : '#475569'}; padding:3px 10px; border-radius:6px; border:1px solid ${isDark ? '#334155' : '#E2E8F0'};">
                                        상태: ${userStatusText}
                                    </span>
                                </div>

                                <div style="font-size:12px; color:${isDark ? '#94a3b8' : '#64748b'}; margin-top:8px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-weight:600;">
                                    <span style="display:inline-flex; align-items:center; gap:4px;">
                                        유저네임: <strong style="color:${isDark ? '#f8fafc' : '#0f172a'};">@${escapeHtml(userstatus.username || '없음')}</strong>
                                        ${userstatus.username ? `<button id="ent2-copy-username-btn" title="유저네임 복사" style="border:none; background:transparent; color:#3182f6; font-size:11px; font-weight:700; cursor:pointer; padding:0 4px;">복사</button>` : ''}
                                    </span>
                                    <span>•</span>
                                    <span style="display:inline-flex; align-items:center; gap:4px;">
                                        ID: <code style="background:${isDark ? '#1e293b' : '#f1f5f9'}; padding:2px 6px; border-radius:4px; font-family:monospace; color:#3182f6; font-weight:700;">${escapeHtml(userstatus.id)}</code>
                                        <button id="ent2-copy-id-btn" title="고유 ID 복사" style="border:none; background:transparent; color:#3182f6; font-size:11px; font-weight:700; cursor:pointer; padding:0 4px;">복사</button>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- 자기소개 설명 -->
                        ${userstatus.description ? `
                            <div style="font-size:13px; color:${isDark ? '#cbd5e1' : '#334155'}; line-height:1.6; margin-bottom:16px; font-weight:500; white-space:pre-wrap; background:${isDark ? '#1a2234' : '#f8fafc'}; padding:12px 16px; border-radius:10px; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'};">
                                ${escapeHtml(userstatus.description)}
                            </div>
                        ` : ''}

                        <!-- 주요 메타 정보 메인 바 -->
                        <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; font-size:12px; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:600; padding-top:12px; border-top:1px solid ${isDark ? '#2a3447' : '#f1f5f9'};">
                            <span style="display:inline-flex; align-items:center; gap:5px;">
                                <svg style="width:14px; height:14px; color:#3182f6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                가입: <strong>${relativeCreatedStr}</strong> (${new Date(userstatus.created).toLocaleDateString('ko-KR')})
                                <button id="ent2-created-info-btn" title="자세한 가입 시간" style="border:none; background:#E8F3FF; color:#3182f6; width:18px; height:18px; border-radius:50%; font-size:11px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; margin-left:2px;">i</button>
                            </span>
                            ${userstatus.shortUrl ? `
                                <span style="display:inline-flex; align-items:center; gap:5px;">
                                    <svg style="width:14px; height:14px; color:#4f7cff;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                                    단축 URL: <a href="${userstatus.shortUrl}" target="_blank" rel="noopener noreferrer" style="color:#3182f6; text-decoration:none; font-weight:700;">${escapeHtml(userstatus.shortUrl)}</a>
                                    <button id="ent2-copy-shorturl-btn" title="단축 URL 복사" style="border:none; background:transparent; color:#3182f6; font-size:11px; font-weight:700; cursor:pointer; padding:0 4px;">복사</button>
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- 2. 종합 활동 지표 요약 Grid -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
                    <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">팔로워</div>
                        <div style="font-size:18px; font-weight:800; color:#3182f6;">${(statusData.follower || 0).toLocaleString()}</div>
                    </div>
                    <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">팔로잉</div>
                        <div style="font-size:18px; font-weight:800; color:#4f7cff;">${(statusData.following || 0).toLocaleString()}</div>
                    </div>
                    <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">공개 작품</div>
                        <div style="font-size:18px; font-weight:800; color:#3182f6;">${(statusData.project || 0).toLocaleString()} <span style="font-size:11px; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:600;">/ ${statusData.projectAll || 0}</span></div>
                    </div>
                    <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">커뮤니티 글</div>
                        <div style="font-size:18px; font-weight:800; color:#8b5cf6;">${totalCommPosts.toLocaleString()}</div>
                    </div>
                    <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:11px; font-weight:700; color:${isDark ? '#94a3b8' : '#64748b'}; margin-bottom:4px;">북마크</div>
                        <div style="font-size:18px; font-weight:800; color:#ec4899;">${totalBookmarks.toLocaleString()}</div>
                    </div>
                </div>

                <!-- 3. 분야별 상세 통계 Grid -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
                    <!-- 작품 & 스터디 상세 통계 -->
                    <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:16px; padding:18px;">
                        <h3 style="font-size:14px; font-weight:800; margin:0 0 14px 0; color:${isDark ? '#f8fafc' : '#0f172a'}; display:flex; align-items:center; gap:8px;">
                            ${svgChartIcon}
                            <span>작품 & 스터디 현황</span>
                        </h3>
                        <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'};">
                                <span>공개 작품</span>
                                <strong style="color:#3182f6; font-weight:800;">${(statusData.project || 0).toLocaleString()}개</strong>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'};">
                                <span>비공개 / 임시 저장 작품</span>
                                <strong style="color:${isDark ? '#f8fafc' : '#0f172a'}; font-weight:800;">${privateProjects.toLocaleString()}개</strong>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'};">
                                <span>전체 생성 작품</span>
                                <strong style="color:${isDark ? '#f8fafc' : '#0f172a'}; font-weight:800;">${(statusData.projectAll || 0).toLocaleString()}개</strong>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'}; border-top:1px dashed ${isDark ? '#2a3447' : '#e2e8f0'}; padding-top:8px;">
                                <span>스터디 목록</span>
                                <strong style="color:#4f7cff; font-weight:800;">${statusData.studyAll || 0}개</strong>
                            </div>
                        </div>
                    </div>

                    <!-- 커뮤니티 작성글 상세 통계 -->
                    <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:16px; padding:18px;">
                        <h3 style="font-size:14px; font-weight:800; margin:0 0 14px 0; color:${isDark ? '#f8fafc' : '#0f172a'}; display:flex; align-items:center; gap:8px;">
                            ${svgCommIcon}
                            <span>커뮤니티 작성 글</span>
                        </h3>
                        <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'};">
                                <span>엔트리 이야기 (엔이)</span>
                                <strong style="color:#3182f6; font-weight:800;">${(commData.free || 0).toLocaleString()}개</strong>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'};">
                                <span>묻고 답하기 (묻답)</span>
                                <strong style="color:#8b5cf6; font-weight:800;">${(commData.qna || 0).toLocaleString()}개</strong>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'};">
                                <span>노하우 & 팁 (노팁)</span>
                                <strong style="color:#f59e0b; font-weight:800;">${(commData.tips || 0).toLocaleString()}개</strong>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'}; border-top:1px dashed ${isDark ? '#2a3447' : '#e2e8f0'}; padding-top:8px;">
                                <span>총 커뮤니티 게시글</span>
                                <strong style="color:#8b5cf6; font-weight:800;">${totalCommPosts.toLocaleString()}개</strong>
                            </div>
                        </div>
                    </div>

                    <!-- 북마크 (즐겨찾기) 상세 통계 -->
                    <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:16px; padding:18px;">
                        <h3 style="font-size:14px; font-weight:800; margin:0 0 14px 0; color:${isDark ? '#f8fafc' : '#0f172a'}; display:flex; align-items:center; gap:8px;">
                            ${svgBookmarkIcon}
                            <span>북마크 (즐겨찾기)</span>
                        </h3>
                        <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'};">
                                <span>북마크한 작품</span>
                                <strong style="color:#3182f6; font-weight:800;">${(bookmarkData.project || 0).toLocaleString()}개</strong>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'};">
                                <span>북마크한 커뮤니티 글</span>
                                <strong style="color:#8b5cf6; font-weight:800;">${(bookmarkData.discuss || 0).toLocaleString()}개</strong>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'};">
                                <span>북마크한 스터디</span>
                                <strong style="color:#4f7cff; font-weight:800;">${(bookmarkData.study || 0).toLocaleString()}개</strong>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; color:${isDark ? '#cbd5e1' : '#475569'}; border-top:1px dashed ${isDark ? '#2a3447' : '#e2e8f0'}; padding-top:8px;">
                                <span>총 북마크 항목</span>
                                <strong style="color:#ec4899; font-weight:800;">${totalBookmarks.toLocaleString()}개</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 4. 대표 뱃지 / 수상 내역 -->
                ${prizeList.length > 0 ? `
                    <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:16px; padding:18px;">
                        <h3 style="font-size:14px; font-weight:800; margin:0 0 14px 0; color:${isDark ? '#f8fafc' : '#0f172a'}; display:flex; align-items:center; gap:8px;">
                            ${svgTrophyIcon}
                            <span>대표 뱃지 및 수상 내역 (${prizeList.length}개)</span>
                        </h3>
                        <div style="display:flex; flex-wrap:wrap; gap:10px;">
                            ${prizeList.map(p => {
                                const pImg = p.prizeImageData?.path ? `https://playentry.org/uploads${p.prizeImageData.path}` : null;
                                return `
                                    <div style="background:${isDark ? '#1a2234' : '#f8fafc'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:10px; padding:10px 14px; display:flex; align-items:center; gap:10px;">
                                        ${pImg ? `<img src="${pImg}" style="width:32px; height:32px; object-fit:contain;">` : `<svg style="width:24px; height:24px; color:#f59e0b;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`}
                                        <div>
                                            <div style="font-size:12.5px; font-weight:800; color:${isDark ? '#f8fafc' : '#0f172a'};">${escapeHtml(p.prizeName || p.badgeText || '뱃지')}</div>
                                            <div style="font-size:11px; color:${isDark ? '#94a3b8' : '#64748b'}; margin-top:2px; font-weight:600;">${escapeHtml(p.category || p.contest?.name || '상장')}</div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- 5. 유저 커뮤니티 작성 기록 -->
                <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:16px; padding:18px;">
                    <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px;">
                        <h3 style="font-size:14px; font-weight:800; margin:0; color:${isDark ? '#f8fafc' : '#0f172a'}; display:flex; align-items:center; gap:8px;">
                            ${svgDocIcon}
                            <span>작성한 커뮤니티 글</span>
                        </h3>

                        <!-- 카테고리 선택 탭 -->
                        <div id="ent2-user-comm-cat-tabs" style="display:flex; align-items:center; gap:3px; background:${isDark ? '#1a2234' : '#f1f5f9'}; padding:3px; border-radius:8px; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; font-size:11px; font-weight:700;">
                            <button data-cat="all" class="ent2-user-comm-tab-btn" style="padding:5px 10px; border:none; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; background:${ent2UserCommCategory === 'all' ? '#3182f6' : 'transparent'}; color:${ent2UserCommCategory === 'all' ? '#fff' : (isDark ? '#94a3b8' : '#64748b')};">전체</button>
                            <button data-cat="free" class="ent2-user-comm-tab-btn" style="padding:5px 10px; border:none; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; background:${ent2UserCommCategory === 'free' ? '#3182f6' : 'transparent'}; color:${ent2UserCommCategory === 'free' ? '#fff' : (isDark ? '#94a3b8' : '#64748b')};">엔이</button>
                            <button data-cat="qna" class="ent2-user-comm-tab-btn" style="padding:5px 10px; border:none; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; background:${ent2UserCommCategory === 'qna' ? '#3182f6' : 'transparent'}; color:${ent2UserCommCategory === 'qna' ? '#fff' : (isDark ? '#94a3b8' : '#64748b')};">묻답</button>
                            <button data-cat="tips" class="ent2-user-comm-tab-btn" style="padding:5px 10px; border:none; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; background:${ent2UserCommCategory === 'tips' ? '#3182f6' : 'transparent'}; color:${ent2UserCommCategory === 'tips' ? '#fff' : (isDark ? '#94a3b8' : '#64748b')};">노팁</button>
                            <button data-cat="suggestion" class="ent2-user-comm-tab-btn" style="padding:5px 10px; border:none; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; background:${ent2UserCommCategory === 'suggestion' ? '#3182f6' : 'transparent'}; color:${ent2UserCommCategory === 'suggestion' ? '#fff' : (isDark ? '#94a3b8' : '#64748b')};">제건</button>
                        </div>
                    </div>

                    <div id="ent2-user-comm-posts-area">
                        <div style="padding:24px; text-align:center; color:#3182f6; font-weight:700; font-size:12.5px;">
                            불러오는 중입니다...
                        </div>
                    </div>
                </div>

                <!-- 6. 유저 공개 작품 리스트 -->
                <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:16px; padding:18px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
                        <h3 style="font-size:14px; font-weight:800; margin:0; color:${isDark ? '#f8fafc' : '#0f172a'}; display:flex; align-items:center; gap:8px;">
                            ${svgGamepadIcon}
                            <span>공개 작품 목록 (${userProjects?.total || projectList.length}개)</span>
                        </h3>
                    </div>

                    ${projectList.length === 0 ? `
                        <div style="padding:24px; text-align:center; color:${isDark ? '#94a3b8' : '#64748b'}; font-size:12.5px; font-weight:600;">
                            공개된 작품이 없습니다.
                        </div>
                    ` : `
                        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
                            ${projectList.map(proj => {
                                let thumbUrl = proj.thumb;
                                if (thumbUrl && thumbUrl.startsWith('/uploads/')) {
                                    thumbUrl = 'https://playentry.org' + thumbUrl;
                                }
                                return `
                                    <a href="https://playentry.org/project/${proj.id}" target="_blank" rel="noopener noreferrer" style="background:${isDark ? '#1a2234' : '#f8fafc'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:12px; overflow:hidden; text-decoration:none; display:flex; flex-direction:column; justify-content:space-between; transition:border-color 0.15s;">
                                        <div>
                                            <div style="width:100%; height:110px; background:#0f172a; position:relative; overflow:hidden;">
                                                <img src="${thumbUrl || 'https://playentry.org/img/DefaultCardUserThmb.svg'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                                                ${proj.staffPicked ? `<img src="https://playentry.org/img/IcoDefaultCardStaff.svg" alt="스선" style="position:absolute; top:4px; left:4px; width:34px; height:30px; object-fit:contain;">` : ''}
                                                ${proj.ranked ? `<img src="https://playentry.org/img/IcoDefaultCardPopular.svg" alt="인작" style="position:absolute; top:4px; right:4px; width:34px; height:30px; object-fit:contain;">` : ''}
                                            </div>
                                            <div style="padding:10px 12px;">
                                                <div style="font-size:12.5px; font-weight:800; color:${isDark ? '#f8fafc' : '#0f172a'}; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                    ${escapeHtml(proj.name || '무제')}
                                                </div>
                                                <div style="font-size:11px; color:#3182f6; font-weight:700;">
                                                    [${escapeHtml(proj.category || '기타')}]
                                                </div>
                                            </div>
                                        </div>

                                        <div style="padding:8px 12px; border-top:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; display:flex; align-items:center; justify-content:space-between; font-size:10.5px; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:600;">
                                            <span>조회 ${proj.visit || 0}</span>
                                            <span>좋아요 ${proj.likeCnt || 0}</span>
                                            <span>댓글 ${proj.comment || 0}</span>
                                        </div>
                                    </a>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>

                <!-- 7. 유저 북마크한 작품 목록 -->
                <div style="background:${isDark ? '#121826' : '#ffffff'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:16px; padding:18px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
                        <h3 style="font-size:14px; font-weight:800; margin:0; color:${isDark ? '#f8fafc' : '#0f172a'}; display:flex; align-items:center; gap:8px;">
                            ${svgBookmarkIcon}
                            <span>북마크한 작품 (${favoriteProjectTotal}개)</span>
                        </h3>
                    </div>

                    ${favoriteProjectList.length === 0 ? `
                        <div style="padding:24px; text-align:center; color:${isDark ? '#94a3b8' : '#64748b'}; font-size:12.5px; font-weight:600;">
                            북마크한 작품이 없습니다.
                        </div>
                    ` : `
                        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
                            ${favoriteProjectList.map(proj => {
                                let thumbUrl = proj.thumb;
                                if (thumbUrl && thumbUrl.startsWith('/uploads/')) {
                                    thumbUrl = 'https://playentry.org' + thumbUrl;
                                }
                                return `
                                    <a href="https://playentry.org/project/${proj.id}" target="_blank" rel="noopener noreferrer" style="background:${isDark ? '#1a2234' : '#f8fafc'}; border:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; border-radius:12px; overflow:hidden; text-decoration:none; display:flex; flex-direction:column; justify-content:space-between; transition:border-color 0.15s;">
                                        <div>
                                            <div style="width:100%; height:110px; background:#0f172a; position:relative; overflow:hidden;">
                                                <img src="${thumbUrl || 'https://playentry.org/img/DefaultCardUserThmb.svg'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                                                ${proj.staffPicked ? `<img src="https://playentry.org/img/IcoDefaultCardStaff.svg" alt="스선" style="position:absolute; top:4px; left:4px; width:34px; height:30px; object-fit:contain;">` : ''}
                                                ${proj.ranked ? `<img src="https://playentry.org/img/IcoDefaultCardPopular.svg" alt="인작" style="position:absolute; top:4px; right:4px; width:34px; height:30px; object-fit:contain;">` : ''}
                                            </div>
                                            <div style="padding:10px 12px;">
                                                <div style="font-size:12.5px; font-weight:800; color:${isDark ? '#f8fafc' : '#0f172a'}; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                    ${escapeHtml(proj.name || '무제')}
                                                </div>
                                                <div style="font-size:11px; color:#ec4899; font-weight:700;">
                                                    [${escapeHtml(proj.category || '기타')}]
                                                </div>
                                            </div>
                                        </div>

                                        <div style="padding:8px 12px; border-top:1px solid ${isDark ? '#2a3447' : '#e2e8f0'}; display:flex; align-items:center; justify-content:space-between; font-size:10.5px; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:600;">
                                            <span>조회 ${proj.visit || 0}</span>
                                            <span>좋아요 ${proj.likeCnt || 0}</span>
                                            <span>댓글 ${proj.comment || 0}</span>
                                        </div>
                                    </a>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;

        // Event Handlers
        const copyToClipboard = (text, msg) => {
            navigator.clipboard.writeText(text).then(() => {
                if (window.showEnt2CustomToast) {
                    window.showEnt2CustomToast('복사 완료', msg, '', 3000);
                } else {
                    alert(msg);
                }
            }).catch(() => {});
        };

        const copyUsernameBtn = container.querySelector('#ent2-copy-username-btn');
        if (copyUsernameBtn && userstatus.username) {
            copyUsernameBtn.onclick = () => copyToClipboard(`@${userstatus.username}`, `@${userstatus.username} 유저네임이 복사되었습니다.`);
        }

        const copyIdBtn = container.querySelector('#ent2-copy-id-btn');
        if (copyIdBtn) {
            copyIdBtn.onclick = () => copyToClipboard(userstatus.id, `유저 고유 ID (${userstatus.id})가 복사되었습니다.`);
        }

        const copyShortUrlBtn = container.querySelector('#ent2-copy-shorturl-btn');
        if (copyShortUrlBtn && userstatus.shortUrl) {
            copyShortUrlBtn.onclick = () => copyToClipboard(userstatus.shortUrl, `단축 URL (${userstatus.shortUrl})이 복사되었습니다.`);
        }

        // Raw JSON Modal Trigger
        const viewRawJsonBtn = container.querySelector('#ent2-view-raw-json-btn');
        if (viewRawJsonBtn) {
            viewRawJsonBtn.onclick = () => {
                const jsonStr = JSON.stringify({ userstatus }, null, 2);
                if (window.openEnt2JsonViewerModal) {
                    window.openEnt2JsonViewerModal(jsonStr, `${userstatus.nickname} 유저 원본 메타데이터`, isDark);
                } else {
                    alert(`[${userstatus.nickname} 메타데이터 JSON]\n\n` + jsonStr.slice(0, 1000) + '...');
                }
            };
        }

        // Official profile link stop propagation
        const officialLink = container.querySelector('#ent2-official-profile-link');
        if (officialLink) {
            officialLink.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Info button click for exact join date
        const infoCreatedBtn = container.querySelector('#ent2-created-info-btn');
        if (infoCreatedBtn) {
            infoCreatedBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.showEnt2CustomToast) {
                    window.showEnt2CustomToast('정확한 계정 가입 일시', `한국 표준시: ${fullCreatedDateStr}\n(ISO: ${userstatus.created})`, '', 6000);
                } else {
                    alert(`정확한 계정 생성 시간 (ISO): ${userstatus.created}\n한국 표준시 (KST): ${fullCreatedDateStr}`);
                }
            };
        }

        // Render user community posts initially
        const renderUserCommunityArea = async (cat) => {
            const postsArea = container.querySelector('#ent2-user-comm-posts-area');
            if (!postsArea) return;

            postsArea.innerHTML = `
                <div style="padding:28px; text-align:center; color:#3182f6; font-weight:700; font-size:13px;">
                    게시글을 불러오는 중입니다...
                </div>
            `;

            const { list: posts, total: totalCount } = await fetchUserCommunityList(userId, cat);

            if (posts.length === 0) {
                postsArea.innerHTML = `
                    <div style="padding:28px; text-align:center; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:600; font-size:13px;">
                        이 카테고리에 작성된 게시글이 없습니다.
                    </div>
                `;
                return;
            }

            const catMap = { free: '엔이', qna: '묻고 답하기', tips: '노하우&팁', entrystory: '엔이', suggestion: '제안 및 건의' };
            const recentPosts = posts.slice(0, 6);
            const displayedCount = recentPosts.length;
            const resolvedTotalCount = Number.isFinite(totalCount) && totalCount > 0 ? totalCount : posts.length;

            postsArea.innerHTML = `
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px;">
                    ${recentPosts.map((p, pIdx) => {
                        const postCat = p.category || (cat === 'free' ? 'entrystory' : 'community');
                        const catLabel = catMap[postCat] || postCat;
                        const postUrl = (postCat === 'entrystory' || postCat === 'free')
                            ? `https://playentry.org/community/entrystory/${p.id}`
                            : `https://playentry.org/community/${postCat === 'qna' ? 'qna' : (postCat === 'suggestion' ? 'suggestion' : 'tips')}/${p.id}`;

                        const rawTitle = (postCat === 'free' || postCat === 'entrystory')
                            ? (p.content || p.title || '(내용 없음)')
                            : (p.title || p.content || '(제목 없음)');

                        const titleText = typeof extractPlainTextFromHtml === 'function' ? extractPlainTextFromHtml(rawTitle) : rawTitle;
                        const thumbnail = typeof getPostThumbnail === 'function' ? getPostThumbnail(p) : null;

                        const dateStr = new Date(p.created).toLocaleDateString('ko-KR', {
                            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                        });

                        return `
                            <div style="background:${isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff'}; border:1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}; border-radius:18px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 4px 12px rgba(0,0,0,0.02); transition:all 0.2s;">
                                <div>
                                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                                        <span style="font-size:11px; font-weight:800; color:#3182f6; background:rgba(49,130,246,0.12); padding:3px 8px; border-radius:8px;">${catLabel}</span>
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <span style="font-size:10.5px; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:600;">${dateStr}</span>
                                            <button data-post-idx="${pIdx}" class="ent2-post-info-btn" title="게시글 상세 정보 및 본문 내용" style="border:none; background:rgba(49,130,246,0.12); color:#3182f6; border-radius:6px; padding:2px 6px; font-size:10.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:2px;">
                                                ${svgInfoIcon} 정보
                                            </button>
                                        </div>
                                    </div>

                                    ${thumbnail ? `
                                        <div class="ent2-post-card-thumb" data-post-idx="${pIdx}" style="width:100%; height:120px; border-radius:12px; overflow:hidden; margin-bottom:10px; background:${isDark ? '#0f172a' : '#f1f5f9'}; cursor:pointer; position:relative; border:1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};" title="이미지 미리보기 (클릭 시 상세보기)">
                                            <img src="${escapeHtml(thumbnail)}" style="width:100%; height:100%; object-fit:cover; transition:transform 0.2s;" onerror="this.parentElement.style.display='none';" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='scale(1)';">
                                        </div>
                                    ` : ''}

                                    <a href="${postUrl}" target="_blank" style="text-decoration:none; font-size:13px; font-weight:700; color:${isDark ? '#f8fafc' : '#0f172a'}; line-height:1.45; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:12px;">
                                        ${escapeHtml(titleText)}
                                    </a>
                                </div>
                                <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; color:${isDark ? '#94a3b8' : '#64748b'}; font-weight:600; padding-top:8px; border-top:1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};">
                                    <span>조회 ${p.visit || 0}</span>
                                    <span>좋아요 ${p.likesLength || 0}</span>
                                    <span>댓글 ${p.commentsLength || 0}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div style="margin-top:20px; padding:16px 20px; background:${isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc'}; border:1px dashed ${isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'}; border-radius:16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
                    <div style="font-size:12.5px; color:${isDark ? '#cbd5e1' : '#475569'}; font-weight:600;">
                        최근 게시글 <strong style="color:#3182f6;">${displayedCount}개</strong>를 표시 중입니다. ${resolvedTotalCount > displayedCount ? `(전체 ${resolvedTotalCount}개 중 ${displayedCount}개)` : `(전체 ${resolvedTotalCount}개)`}
                    </div>
                    <button id="ent2-profile-go-comm-btn" style="padding:8px 16px; background:#3182f6; color:#ffffff; border:none; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; box-shadow:0 3px 10px rgba(49,130,246,0.25); display:inline-flex; align-items:center; gap:6px;">
                        <span>커뮤니티 탐색에서 더보기</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                </div>
            `;

            // Bind Post Info Button and Thumbnail modal clicks
            postsArea.querySelectorAll('.ent2-post-info-btn, .ent2-post-card-thumb').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const pIdx = parseInt(btn.getAttribute('data-post-idx'), 10);
                    if (recentPosts[pIdx] && window.openEnt2PostDetailModal) {
                        window.openEnt2PostDetailModal(recentPosts[pIdx], isDark);
                    }
                };
            });

            const goCommBtn = postsArea.querySelector('#ent2-profile-go-comm-btn');
            if (goCommBtn) {
                goCommBtn.onclick = () => {
                    const targetId = userstatus?.id || userId;
                    const commPath = `/ent2/comm?user=${encodeURIComponent(targetId)}`;
                    if (window.location.hostname === 'playentry.org' && window.location.pathname.startsWith('/ent2')) {
                        history.pushState({}, '', commPath);
                        if (typeof handleEnt2PageRoute === 'function') handleEnt2PageRoute();
                    } else {
                        window.location.href = commPath;
                    }
                };
            }
        };

        // Bind community tab clicks
        const commTabs = container.querySelectorAll('.ent2-user-comm-tab-btn');
        commTabs.forEach(btn => {
            btn.onclick = () => {
                commTabs.forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = isDark ? '#94a3b8' : '#64748b';
                });
                btn.style.background = '#3182f6';
                btn.style.color = '#fff';
                const cat = btn.getAttribute('data-cat');
                ent2UserCommCategory = cat;
                renderUserCommunityArea(cat);
            };
        });

        // Trigger initial fetch
        renderUserCommunityArea(ent2UserCommCategory);

    } catch (err) {
        console.error("[ent2] Full profile load error:", err);
        container.innerHTML = `
            <div style="background:${isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.85)'}; backdrop-filter:blur(24px); border:1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}; border-radius:28px; padding:48px; text-align:center;">
                <h3 style="color:#ef4444; font-size:18px; font-weight:800; margin:0 0 12px 0;">오류가 발생했습니다</h3>
                <p style="color:${isDark ? '#94a3b8' : '#64748b'}; font-size:13px; margin:0 0 20px 0;">(${escapeHtml(err.message)})</p>
            </div>
        `;
    }
}

