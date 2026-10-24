// ent2 Search History Module
async function logEnt2SearchHistory(searchResult) {
    if (!searchResult || !searchResult.id) return;
    const history = await Ent2Storage.get('ent2_search_history', []);
    const filtered = history.filter(item => item.profileId !== searchResult.id);
    
    const record = {
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        query: searchResult.query,
        nickname: searchResult.nickname || searchResult.query,
        profileId: searchResult.id,
        avatar: searchResult.avatar || 'https://playentry.org/img/DefaultCardUserThmb.svg',
        timestamp: new Date().toISOString()
    };

    filtered.unshift(record);
    if (filtered.length > 100) filtered.pop();

    await Ent2Storage.set('ent2_search_history', filtered);
}

async function renderEnt2SearchHistoryTab(container, isDark, navTo) {
    const svgClockIcon = `<svg style="width:20px; height:20px; color:#007aff;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

    container.innerHTML = `
        <div style="background:${isDark ? '#1e293b' : '#ffffff'}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; border-radius:24px; padding:32px; box-shadow:0 10px 30px rgba(0,0,0,0.05);">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
                <div>
                    <h2 style="font-size:22px; font-weight:800; margin:0 0 6px 0; display:flex; align-items:center; gap:8px;">
                        ${svgClockIcon} 내 기기 프로필 검색 기록
                    </h2>
                    <p style="font-size:13px; color:${isDark ? '#94a3b8' : '#64748b'}; margin:0;">
                        지금까지 ent2에서 탐색한 유저 프로필 기록입니다. 기록을 클릭하면 해당 프로필 탐색 페이지로 이동합니다.
                    </p>
                </div>
                <button id="ent2-clear-history-btn" style="padding:8px 16px; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); border-radius:10px; font-size:12px; font-weight:700; cursor:pointer;">
                    전체 기록 삭제
                </button>
            </div>

            <div id="ent2-history-list-area">
                <div style="padding:32px; text-align:center; color:${isDark ? '#94a3b8' : '#64748b'}; font-size:13px;">기록 불러오는 중...</div>
            </div>
        </div>
    `;

    const listArea = container.querySelector('#ent2-history-list-area');
    const clearBtn = container.querySelector('#ent2-clear-history-btn');

    const loadHistoryItems = async () => {
        const history = await Ent2Storage.get('ent2_search_history', []);
        if (!history || history.length === 0) {
            listArea.innerHTML = `
                <div style="padding:48px 20px; text-align:center; color:${isDark ? '#64748b' : '#94a3b8'}; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <svg style="width:18px; height:18px; color:${isDark ? '#64748b' : '#94a3b8'};" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>아직 저장된 프로필 검색 기록이 없습니다.</span>
                </div>
            `;
            return;
        }

        listArea.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${history.map(item => `
                    <div style="background:${isDark ? '#0f172a' : '#f8fafc'}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; border-radius:14px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
                        <div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
                            <img src="${item.avatar || 'https://playentry.org/img/DefaultCardUserThmb.svg'}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; flex-shrink:0;" onerror="this.src='https://playentry.org/img/DefaultCardUserThmb.svg'">
                            <div style="overflow:hidden;">
                                <div style="font-size:14px; font-weight:700; color:${isDark ? '#f8fafc' : '#0f172a'};">${escapeHtml(item.nickname || item.query)}</div>
                                <div style="font-size:11px; font-family:monospace; color:${isDark ? '#94a3b8' : '#64748b'}; margin-top:2px;">ID: ${escapeHtml(item.profileId)} • ${new Date(item.timestamp).toLocaleString('ko-KR')}</div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                            <button data-nav-id="${item.profileId}" class="ent2-nav-history-item-btn" style="padding:6px 14px; background:#007aff; color:#ffffff; border:none; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">
                                프로필 탐색
                            </button>
                            <button data-del-id="${item.id}" class="ent2-del-history-item-btn" style="padding:6px 12px; background:transparent; color:#ef4444; border:1px solid rgba(239,68,68,0.3); border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">
                                삭제
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        listArea.querySelectorAll('.ent2-nav-history-item-btn').forEach(btn => {
            btn.onclick = () => {
                const navId = btn.getAttribute('data-nav-id');
                navTo(`/ent2/profile/${navId}`);
            };
        });

        listArea.querySelectorAll('.ent2-del-history-item-btn').forEach(btn => {
            btn.onclick = async () => {
                const delId = btn.getAttribute('data-del-id');
                const currHistory = await Ent2Storage.get('ent2_search_history', []);
                const updated = currHistory.filter(h => h.id !== delId);
                await Ent2Storage.set('ent2_search_history', updated);
                loadHistoryItems();
            };
        });
    };

    clearBtn.onclick = async () => {
        if (confirm('모든 검색 기록을 삭제하시겠습니까?')) {
            await Ent2Storage.set('ent2_search_history', []);
            loadHistoryItems();
        }
    };

    loadHistoryItems();
}
