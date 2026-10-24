chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. 단축 링크를 처리합니다 (클라이언트 먼저 시도 -> 실패 시 서버 폴백)
  if (request.action === "expandLink") {
    const originalUrl = request.url;
    
    // URL 프로토콜 간이 검증 (안전장치)
    if (!originalUrl || (!originalUrl.startsWith("http://") && !originalUrl.startsWith("https://"))) {
      sendResponse({ data: originalUrl || "" });
      return;
    }
    
    // 1단계: 클라이언트 직접 해결 시도
    const clientExpand = () => {
      return new Promise((resolve, reject) => {
        fetch(originalUrl, { method: "HEAD", redirect: "follow" })
          .then(response => {
            if (response.url && response.url !== originalUrl) {
              resolve(response.url);
            } else {
              throw new Error("HEAD resolved to same URL or returned empty, trying GET");
            }
          })
          .catch(() => {
            // HEAD 실패 시 일반 GET 시도
            fetch(originalUrl, { method: "GET", redirect: "follow" })
              .then(response => {
                if (response.url && response.url !== originalUrl) {
                  resolve(response.url);
                } else {
                  reject(new Error("GET resolved to same URL or failed"));
                }
              })
              .catch(err => {
                reject(err);
              });
          });
      });
    };

    clientExpand()
      .then(expandedUrl => {
        sendResponse({ data: expandedUrl });
      })
      .catch(() => {
        // 2단계: 클라이언트 실패 시 서버(Cloud Run API) 경유 처리 폴백 이행
        chrome.storage.local.get({ apiServerUrl: "https://ais-dev-3ptxwh3b2yqydi7oot7dr4-212151393979.asia-northeast1.run.app" }, (res) => {
          const apiServer = res.apiServerUrl || "https://ais-dev-3ptxwh3b2yqydi7oot7dr4-212151393979.asia-northeast1.run.app";
          
          let expandApi;
          if (apiServer.includes(".php")) {
            expandApi = apiServer.includes("?") ? `${apiServer}&action=expand` : `${apiServer}?action=expand`;
          } else {
            expandApi = `${apiServer}/api/expand`;
          }
          
          const finalUrl = expandApi.includes("?") ? `${expandApi}&url=${encodeURIComponent(originalUrl)}` : `${expandApi}?url=${encodeURIComponent(originalUrl)}`;
          
          fetch(finalUrl)
            .then(r => r.text())
            .then(text => {
              const trimmed = text ? text.trim() : "";
              if (trimmed.startsWith("http")) {
                sendResponse({ data: trimmed });
              } else {
                sendResponse({ data: originalUrl }); // 완전히 실패한 경우 원본 반환
              }
            })
            .catch(() => {
              sendResponse({ data: originalUrl }); // 서버 통신 장애 시 최종 원본 반환
            });
        });
      });

    return true; // 비동기 응답 채널 유지
  }

  // 2. 링크의 Open Graph 태그 정보를 가져옵니다 (img.bloupla.net, ifh.cc, playentry.org 빼고 모두 서버 제공)
  if (request.action === "getOGData") {
    const targetUrl = request.url;
    if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
      sendResponse({ error: "Invalid URL protocol" });
      return;
    }

    let hostname = "";
    try {
      hostname = new URL(targetUrl).hostname.toLowerCase();
    } catch (e) {
      sendResponse({ error: "Invalid URL format" });
      return;
    }

    // 예외 대상 도메인 목록: img.bloupla.net, ifh.cc, playentry.org
    const isExcluded = ["img.bloupla.net", "ifh.cc", "playentry.org"].some(domain => {
      return hostname === domain || hostname.endsWith("." + domain);
    });

    if (isExcluded) {
      // 예외 도메인은 클라이언트 직접 파싱 진행
      fetch(targetUrl)
        .then(r => r.text())
        .then(html => {
          const tM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const title = tM ? tM[1] : "";
          const getMeta = (p) => {
            const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)["']`, "i");
            const m1 = html.match(r1);
            if (m1) return m1[1];
            const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, "i");
            const m2 = html.match(r2);
            return m2 ? m2[1] : null;
          };
          sendResponse({
            title: getMeta("og:title") || title,
            image: getMeta("og:image"),
            description: getMeta("og:description")
          });
        })
        .catch(e => sendResponse({ error: e.message }));
    } else {
      // 예외가 아니면 서버에서 미리보기 정보 가져옴
      chrome.storage.local.get({ apiServerUrl: "https://ais-dev-3ptxwh3b2yqydi7oot7dr4-212151393979.asia-northeast1.run.app" }, (res) => {
        const apiServer = res.apiServerUrl || "https://ais-dev-3ptxwh3b2yqydi7oot7dr4-212151393979.asia-northeast1.run.app";
        
        let ogApi;
        if (apiServer.includes(".php")) {
          ogApi = apiServer.includes("?") ? `${apiServer}&action=og` : `${apiServer}?action=og`;
        } else {
          ogApi = `${apiServer}/api/og`;
        }

        const finalUrl = ogApi.includes("?") ? `${ogApi}&url=${encodeURIComponent(targetUrl)}` : `${ogApi}?url=${encodeURIComponent(targetUrl)}`;

        fetch(finalUrl)
          .then(r => r.json())
          .then(data => {
            if (data && !data.error) {
              sendResponse({
                title: data.title || "",
                image: data.image || "",
                description: data.description || ""
              });
            } else {
              throw new Error(data ? data.error : "Server returned error status");
            }
          })
          .catch(() => {
            // 서버 통신 실패 혹은 오류 발생 시, 클라이언트 측 직접 파싱으로 최후의 폴백
            fetch(targetUrl)
              .then(r => r.text())
              .then(html => {
                const tM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                const title = tM ? tM[1] : "";
                const getMeta = (p) => {
                  const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)["']`, "i");
                  const m1 = html.match(r1);
                  if (m1) return m1[1];
                  const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, "i");
                  const m2 = html.match(r2);
                  return m2 ? m2[1] : null;
                };
                sendResponse({
                  title: getMeta("og:title") || title,
                  image: getMeta("og:image"),
                  description: getMeta("og:description")
                });
              })
              .catch(e => sendResponse({ error: e.message }));
          });
      });
    }

    return true;
  }

  // 3. 파일 다운로드 트리거 (브라우저 CSP 우회 보장용 백그라운드 다운로더)
  if (request.action === "downloadFile") {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      conflictAction: "uniquify",
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download failed:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    return true;
  }

  // 4. OS 시스템 알림 (Chrome Notifications API)
  if (request.action === "showNotification") {
    const notifId = request.id || "liteentry-no-mypost-alert";
    chrome.notifications.create(notifId, {
      type: "basic",
      iconUrl: "icon.png",
      title: request.title || "LiteEntry 알림",
      message: request.message || "최근 9개 이야기 글 중 작성하신 글이 없습니다!",
      priority: 2,
      requireInteraction: true
    }, (id) => {
      sendResponse({ success: true, notificationId: id });
    });
    return true;
  }

  if (request.action === "clearNotification") {
    const notifId = request.id || "liteentry-no-mypost-alert";
    chrome.notifications.clear(notifId, (wasCleared) => {
      sendResponse({ success: true, wasCleared });
    });
    return true;
  }
});
