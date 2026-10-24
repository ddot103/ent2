function isTargetPage() {
    const href = window.location.href;
    if (href.includes("/community/qna")) return false;
    return href.includes("/community/");
}

function getActualUrl(url) {
    try {
        if (url.includes("/redirect?external=")) {
            const fullUrl = url.startsWith("http") ? url : window.location.origin + url;
            const urlObj = new URL(fullUrl);
            return urlObj.searchParams.get("external") || url;
        }
        return url;
    } catch (e) { return url; }
}

function getEntryDiscussId(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname !== "playentry.org") return null;
        const path = urlObj.pathname;
        if (path.includes("/list")) return null;
        const match = path.match(/^\/community\/(tips|qna|discuss|free|entrystory)\/([a-f0-9]{24})/i);
        if (match) {
            return {
                category: match[1],
                id: match[2]
            };
        }
    } catch (e) {}
    return null;
}

function getEntryProfileId(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname !== "playentry.org") return null;
        const path = urlObj.pathname;
        const match = path.match(/^\/profile\/([a-f0-9]{24})/i);
        if (match) {
            return match[1];
        }
    } catch (e) {}
    return null;
}

async function getCSRFToken() {
    let token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                document.querySelector('meta[name="csrf"]')?.getAttribute('content');
    if (token) return token;

    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
        if (script.textContent) {
            const match = script.textContent.match(/csrf-token["']?\s*:\s*["']([^"']+)["']/i) ||
                          script.textContent.match(/csrfToken["']?\s*[:=]\s*["']([^"']+)["']/i);
            if (match && match[1]) {
                return match[1];
            }
        }
    }

    try {
        const res = await fetch('/');
        const html = await res.text();
        const match = html.match(/csrf-token["']?\s*:\s*["']([^"']+)["']/i) ||
                      html.match(/csrfToken["']?\s*[:=]\s*["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']csrf-token["']/i) ||
                      html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i);
        if (match && match[1]) {
            return match[1];
        }
    } catch (e) {}

    return "xgk9H6z0--epT6oaVE5caazb13_vY0qCiKb4";
}

function stripHtml(html) {
    if (!html) return "";
    let clean = html.replace(/<[^>]*>/g, " ");
    return clean.replace(/\s+/g, " ").trim();
}

function safeUrl(url) {
    if (!url) return "about:blank";
    try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            return parsed.toString();
        }
    } catch (e) {}
    return "about:blank";
}

function isVideoUrl(url) {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.toLowerCase();
        return VIDEO_EXTENSIONS.some(ext => path.endsWith(ext)) || urlObj.searchParams.get("video") === "1";
    } catch (e) { return false; }
}

function isImageUrl(url) {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.toLowerCase();
        if (IMAGE_EXTENSIONS.some(ext => path.endsWith(ext))) return true;
        const domain = urlObj.hostname;
        if (domain.includes("img.bloupla.net") || domain.includes("ifh.cc")) return true;
        return false;
    } catch (e) { return false; }
}

function getImageDisplayUrl(url) {
    if (url.includes("img.bloupla.net") && !url.includes("raw=1")) {
        return url + (url.includes("?") ? "&" : "?") + "raw=1";
    }
    return url;
}

function getYoutubeId(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === "youtu.be") return urlObj.pathname.slice(1);
        if (urlObj.hostname.includes("youtube.com")) return urlObj.searchParams.get("v");
        return null;
    } catch (e) { return null; }
}

function shouldExpandLink(url) {
    try {
        const domain = new URL(url).hostname.toLowerCase();
        return settings.shortLinkDomains.some(d => {
            const cleanD = d.toLowerCase().trim();
            return domain === cleanD || domain.endsWith("." + cleanD);
        });
    } catch (e) { return false; }
}

function isPromotionLink(url) {
    if (!settings.enableBlock || settings.enableBlock === "none") return false;
    const actualUrl = getActualUrl(url);
    return settings.blockList.some(pattern => {
        const cleanPattern = pattern.trim().replace("*", "");
        return actualUrl.includes(cleanPattern);
    });
}

function extractImageUrlsFromUrl(urlStr) {
    if (!urlStr) return [];
    const results = [];
    const actual = getActualUrl(urlStr);

    if (actual.includes(",")) {
        try {
            const urlObj = new URL(actual);
            const basePath = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
            
            const parts = actual.split(",");
            for (let i = 0; i < parts.length; i++) {
                let part = parts[i].trim();
                if (!part) continue;
                if (part.startsWith("http://") || part.startsWith("https://")) {
                    results.push(part);
                } else if (part.startsWith("/")) {
                    results.push(urlObj.origin + part);
                } else {
                    results.push(basePath + part);
                }
            }
        } catch (e) {
            results.push(actual);
        }
    } else {
        results.push(actual);
    }
    return results;
}
