if (typeof observer === 'undefined') {
    var observer = null;
}
if (typeof processTimeout === 'undefined') {
    var processTimeout = null;
}

function triggerProcessElements() {
    if (document.hidden) return;
    if (processTimeout) clearTimeout(processTimeout);
    processTimeout = setTimeout(() => {
        if (typeof processElements === 'function') {
            processElements();
        }
    }, 100);
}

function startObserver() {
    if (!isContextValid()) return;
    if (observer) return;
    
    observer = new MutationObserver((mutations) => {
        if (document.hidden) return;
        let shouldProcess = false;
        for (let mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                let hasRelevantNode = false;
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.classList.contains("lite-entry-preview") || 
                            node.classList.contains("lite-sticker-fav-board") || 
                            node.id === "lite-fav-dropdown-popover" ||
                            node.classList.contains("lite-btn-fav-toggle") ||
                            node.classList.contains("lite-sticker-fav")) {
                            continue;
                        }
                        hasRelevantNode = true;
                        break;
                    }
                }
                if (hasRelevantNode) {
                    shouldProcess = true;
                    break;
                }
            }
        }
        if (shouldProcess) {
            triggerProcessElements();
        }
    });
    
    try {
        observer.observe(document.body, { childList: true, subtree: true });
        console.log("[LiteEntry] MutationObserver successfully started.");
    } catch (e) {
        console.error("[LiteEntry] Failed to start MutationObserver:", e);
    }
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        if (observer) {
            observer.disconnect();
            observer = null;
            console.log("[LiteEntry] Observer paused (tab hidden).");
        }
        if (processTimeout) {
            clearTimeout(processTimeout);
            processTimeout = null;
        }
    } else {
        console.log("[LiteEntry] Tab activated. Restoring observer...");
        startObserver();
        triggerProcessElements();
    }
});
