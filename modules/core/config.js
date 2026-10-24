var settings = {
  imageSize: 400,
  enableExpand: true,
  enableImage: true,
  enableOG: true,
  showOGInfo: true,
  enableBlock: "none", // 기본값: "none" (홍보글 차단 없음)
  enableLiveStory: false, // 실시간 글 미리보기 기본값 (비활성화)
  enableLiveStoryAutoStart: false, // 실시간 엔이 자동 활성화 기본값 (기본값 정지 상태)
  enableStandaloneLink: false, // 더보기 내 단독 링크 열기 기본값 (비활성화)
  enableNoMyPostAlarm: false, // 최근 9개 글 중 내 글 없을 때 알림 음원 재생 기본값 (비활성화)
  noMyPostMode: "both", // 알림 방식 기본값: 둘 다 ("both" | "sound" | "floating")
  noMyPostAudioData: "", // 설정한 알림 음원 데이터 (Base64)
  noMyPostAudioName: "", // 설정한 알림 음원 파일명
  noMyPostAudioStart: 0, // 음원 재생 시작 시간 (초)
  noMyPostAudioEnd: 0, // 음원 재생 종료 시간 (초, 0이면 전체)
  noMyPostKeywords: "", // 음악 재생 예외 키워드 (쉼표 구분)
  enableCombineCapture: true, // 다중 캡처 이미지 합치기 기본값
  enablePreview: true, // 링크 미리보기 (이미지, 유튜브, OG 등 전체 미리보기 효과) On/Off 기본값
  enableFavBeta: false, // 즐겨찾기 베타 설정 기본값 off
  enableDarkTheme: false, // 다크 테마 설정 기본값 off
  enableDiscordTheme: false, // 디스코드 스타일 테마 기본값 off
  enableSimplifyTime: false, // 날짜 표기 단순화 설정 기본값 off
  enableAnonymous: false, // 익명 모드 설정 기본값 off
  anonymousSeed: 1, // 익명 시드/번호 기본값: 1
  anonymousProfileMode: "hide", // 익명 프로필 사진 처리 방식 기본값: hide
  captureFormat: "png", // 화면 캡처 기본 포맷: png
  apiServerUrl: "https://ais-dev-3ptxwh3b2yqydi7oot7dr4-212151393979.asia-northeast1.run.app", // 기본 API 프록시 서버 주소
  blockList: ["playentry.org/project/"],
  shortLinkDomains: ["naver.me", "m.site.naver.com", "숏.한국", "link.naver.com"], // 맞춤형 단축링크 수용 리스트

  // 마크다운 상세 설정 무구
  mdBold: true,
  mdItalic: true,
  mdUnderline: true,
  mdStrikethrough: true,
  mdSpoiler: true,
  mdCode: true,
  mdQuote: true,
  mdEnter: true,

  // 링크 미리보기 상세 설정
  previewStory: true,
  previewTips: true,
  previewProfile: true, // 프로필 미리보기 On/Off
  previewDiscuss: true // 묻답/자게 등 미리보기 On/Off
};

if (typeof IMAGE_EXTENSIONS === 'undefined') {
    var IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
}
if (typeof VIDEO_EXTENSIONS === 'undefined') {
    var VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v", ".avi", ".ogg", ".gifv"];
}

// 확장 컨텍스트가 유효한지 검사하는 안전 장치
function isContextValid() {
    try {
        return typeof chrome !== "undefined" && chrome?.runtime && !!chrome?.runtime?.id;
    } catch (e) {
        return false;
    }
}

function updateSettings(callback) {
    if (!isContextValid()) return;
    try {
        chrome.storage.local.get(settings, (res) => {
            if (!isContextValid()) return;
            settings = { ...settings, ...res };
            if (callback) callback();
        });
    } catch (e) {}
}

// 실시간 크롬 스토리지 업데이트 리스너
try {
    if (isContextValid() && chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (!isContextValid()) return;
            if (areaName === "local") {
                let updated = false;
                let liveStoryChanged = false;
                for (let key in changes) {
                    if (key in settings) {
                        const oldVal = settings[key];
                        const newVal = changes[key].newValue;
                        if (oldVal !== newVal) {
                            settings[key] = newVal;
                            updated = true;
                            if (key === "enableLiveStory" || key === "enableLiveStoryAutoStart") {
                                liveStoryChanged = true;
                            }
                        }
                    }
                }
                if (updated) {
                    document.querySelectorAll("div.css-6wq60h.eqt5hs60").forEach(container => {
                        container.removeAttribute("data-formatted");
                        if (container.dataset.rawHtmlBackup) {
                            container.innerHTML = container.dataset.rawHtmlBackup;
                        }
                    });
                    document.querySelectorAll(".css-lz5fzu em, [class*='e143sozh0'] em").forEach(em => {
                        em.removeAttribute("data-processed");
                    });
                    if (typeof processElements === 'function') {
                        processElements();
                    }
                    if (typeof handleDarkTheme === 'function') handleDarkTheme();
                    if (typeof handleDiscordTheme === 'function') handleDiscordTheme();
                    if (liveStoryChanged) {
                        window.postMessage({ type: 'LITEENTRY_SET_LIVESTORY', enabled: settings.enableLiveStory, autoStart: settings.enableLiveStoryAutoStart }, "*");
                    }
                }
            }
        });
    }
} catch (e) {}

// inject.js 로딩 직후 세팅 요청에 동적 대응하는 브릿지 리스너
window.addEventListener('message', (event) => {
    if (!event.data) return;
    
    if (event.data.type === 'LITEENTRY_LIVESTORY_READY') {
        window.postMessage({ type: 'LITEENTRY_SET_LIVESTORY', enabled: settings.enableLiveStory, autoStart: settings.enableLiveStoryAutoStart }, "*");
    }
});
