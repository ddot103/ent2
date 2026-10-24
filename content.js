// ent2 Extension Content Script - ONLY ent2 Features
(function() {
  if (window.__ent2ContentInjected) return;
  window.__ent2ContentInjected = true;

  var settings = {
    ent2_enabled: true,
    ent2_mobile_enabled: true,
    ent2OnlyMode: true,
    apiServerUrl: "https://playentry.org",
    blockList: ["playentry.org/project/"]
  };

  function removeAllInjectedEnt2UI() {
    document.querySelectorAll('.lite-ent2-analyze-item, .ent2-header-search-btn, .ent2-mobile-drawer-link, .ent2-group-link').forEach(el => el.remove());
  }

  function removeMobileEnt2UI() {
    document.querySelectorAll('.ent2-mobile-drawer-link').forEach(el => el.remove());
  }

  // Load settings & listen for changes
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(settings, (res) => {
      if (res) {
        settings = Object.assign(settings, res);
      }
      if (!settings.ent2_enabled) {
        removeAllInjectedEnt2UI();
      } else if (!settings.ent2_mobile_enabled) {
        removeMobileEnt2UI();
      }
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.ent2_enabled) {
          settings.ent2_enabled = changes.ent2_enabled.newValue;
          if (!settings.ent2_enabled) {
            removeAllInjectedEnt2UI();
          } else {
            injectEnt2DropdownOptions();
            injectEnt2HeaderSearchBtn();
            if (settings.ent2_mobile_enabled) injectEnt2MobileDrawerItem();
            injectEnt2MyInfoGroupLink();
          }
        }
        if (changes.ent2_mobile_enabled) {
          settings.ent2_mobile_enabled = changes.ent2_mobile_enabled.newValue;
          if (!settings.ent2_mobile_enabled) {
            removeMobileEnt2UI();
          } else if (settings.ent2_enabled) {
            injectEnt2MobileDrawerItem();
          }
        }
      }
    });
  }

  // 1. Helper: Extract original post URL
  function getPostOriginalUrl(cardTarget) {
    if (!cardTarget) return null;
    const link = cardTarget.querySelector('a[href*="/community/entrystory/"], a[href*="/community/qna/"], a[href*="/community/tips/"]');
    if (link && link.href) return link.href;

    const currentUrl = window.location.href;
    if (/\/community\/(tips|qna|discuss|free|entrystory)\/[a-f0-9]{24}/i.test(currentUrl)) {
      return currentUrl;
    }
    return null;
  }

  // 2. Inject "ent2에서 분석하기" into Community Post Dropdowns
  function injectEnt2DropdownOptions() {
    if (!settings.ent2_enabled) return;
    document.querySelectorAll('.css-c5zb45 ul, .css-1807f3l ul, .css-cch4l3 ul, .e1omy4ml2 ul, .e19ceda91 ul, .css-8dfp38 ul, [class*="e1omy4ml"] ul, div[class*="1807f3l"] ul').forEach(ul => {
      // Remove any legacy injected options
      ul.querySelectorAll('.lite-original-post-item, .lite-like-list-item, .lite-comment-like-list-item').forEach(el => el.remove());

      if (ul.querySelector('.lite-ent2-analyze-item')) return;

      const cardTarget = ul.closest('[data-entrystory-id]') || ul.closest('[data-id]') || ul.closest('li') || ul.closest('.css-12e6n38') || ul;
      const origUrl = getPostOriginalUrl(cardTarget);

      let postId = cardTarget.getAttribute?.('data-entrystory-id') || cardTarget.getAttribute?.('data-id');
      if (!postId && origUrl) {
        const match = origUrl.match(/([a-f0-9]{24})/i);
        if (match) postId = match[1];
      }
      if (!postId) {
        const link = cardTarget.querySelector?.('a[href*="/community/entrystory/"], a[href*="/community/qna/"], a[href*="/community/tips/"]');
        if (link) {
          const match = link.href.match(/([a-f0-9]{24})/i);
          if (match) postId = match[1];
        }
      }
      if (!postId) {
        const matchLoc = window.location.href.match(/\/community\/(tips|qna|discuss|free|entrystory)\/([a-f0-9]{24})/i);
        if (matchLoc) postId = matchLoc[2];
      }

      const li = document.createElement('li');
      li.className = 'lite-ent2-analyze-item';

      const a = document.createElement('a');
      a.textContent = 'ent2 분석';
      a.style.cursor = 'pointer';

      a.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
        
        const cardEl = a.closest('[data-entrystory-id]') || a.closest('[data-id]') || a.closest('.eqmdslz0') || a.closest('li');
        let clickPostId = cardEl?.getAttribute('data-entrystory-id') || cardEl?.getAttribute('data-id') || postId;

        if (!clickPostId) {
          const esLink = ul.querySelector('a[href*="/community/entrystory/"], a[href*="/community/qna/"], a[href*="/community/tips/"], a[href*="/discuss/"]');
          if (esLink) {
            const m = esLink.href.match(/([a-f0-9]{24})/i);
            if (m) clickPostId = m[1];
          }
        }

        if (!clickPostId) {
          const matchLoc = window.location.href.match(/\/community\/(tips|qna|discuss|free|entrystory)\/([a-f0-9]{24})/i);
          if (matchLoc) clickPostId = matchLoc[2];
        }

        let postCardEl = a.closest('li.eqmdslz0, li.css-tasfte, li.css-ncb8mb, li.css-118xwv2, li.css-12e6n38, li') || cardEl;
        if ((!postCardEl || postCardEl === document.body) && clickPostId) {
          const postLink = document.querySelector(`a[href*="${clickPostId}"]`);
          if (postLink) {
            postCardEl = postLink.closest('li.eqmdslz0, li.css-tasfte, li');
          }
        }

        if (clickPostId) {
          if (typeof window.openEnt2AnalysisSidePanel === 'function') {
            window.openEnt2AnalysisSidePanel(clickPostId, isDark, postCardEl);
          } else if (typeof openEnt2AnalysisSidePanel === 'function') {
            openEnt2AnalysisSidePanel(clickPostId, isDark, postCardEl);
          } else if (typeof window.openEnt2PostDetailModal === 'function') {
            window.openEnt2PostDetailModal(clickPostId, isDark, postCardEl);
          }
        } else if (origUrl) {
          window.open(origUrl, '_blank');
        }
      };

      li.appendChild(a);
      
      // Place right after '신고하기' if present, otherwise append
      const reportItem = Array.from(ul.children).find(child => child.textContent.includes('신고하기'));
      if (reportItem && reportItem.nextSibling) {
        ul.insertBefore(li, reportItem.nextSibling);
      } else {
        ul.appendChild(li);
      }
    });
  }

  // 3. Inject ent2 Main Navigation Bar & Header Search Button
  function injectEnt2HeaderSearchBtn() {
    if (!settings.ent2_enabled) return;
    if (document.querySelector('.ent2-header-search-btn')) return;

    // Search button finding
    let searchBtn = Array.from(document.querySelectorAll('a[role="button"]')).find(el => {
      const blindText = el.querySelector('.blind')?.textContent?.toLowerCase() || '';
      return blindText.includes('search') || blindText.includes('검색');
    }) || document.querySelector('.css-r0w8v6') || document.querySelector('[class*="css-r0w8v6"]');

    const searchWrapper = searchBtn ? searchBtn.closest('.css-1nyftcs, [class*="1nyftcs"], .e141lsuo1') : null;
    const headerRightBox = document.querySelector('.css-1foze19, [class*="1foze19"], .e141lsuo0, .css-7tomri, [class*="7tomri"], .css-1vlcof9, .efghtgk2');

    if (!searchWrapper && !headerRightBox) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'css-1nyftcs e141lsuo1 ent2-header-search-btn';
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';

    const btn = document.createElement('a');
    btn.role = 'button';
    btn.title = 'ent2 이동';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.width = '32px';
    btn.style.height = '32px';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
    btn.style.background = 'transparent';
    btn.style.padding = '0';
    btn.style.margin = '0 4px';

    let logoUrl = '/ent2-extension/logo.png';
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      logoUrl = chrome.runtime.getURL('logo.png');
    }

    const img = document.createElement('img');
    img.src = logoUrl;
    img.alt = 'ent2 logo';
    img.style.width = '24px';
    img.style.height = '24px';
    img.style.borderRadius = '6px';
    img.style.objectFit = 'cover';
    img.style.boxShadow = '0 2px 6px rgba(49, 130, 246, 0.3)';

    btn.appendChild(img);

    btn.onmouseover = () => {
      btn.style.transform = 'scale(1.1)';
      img.style.boxShadow = '0 4px 12px rgba(49, 130, 246, 0.5)';
    };
    btn.onmouseout = () => {
      btn.style.transform = 'scale(1)';
      img.style.boxShadow = '0 2px 6px rgba(49, 130, 246, 0.3)';
    };

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = 'https://playentry.org/ent2';
    };

    wrapper.appendChild(btn);

    if (searchWrapper && searchWrapper.parentNode) {
      searchWrapper.parentNode.insertBefore(wrapper, searchWrapper);
    } else if (headerRightBox) {
      if (headerRightBox.classList.contains('css-1vlcof9') || headerRightBox.classList.contains('efghtgk2')) {
        headerRightBox.insertBefore(wrapper, headerRightBox.firstChild);
      } else {
        headerRightBox.prepend(wrapper);
      }
    }
  }

  // 4. Inject ent2 link and Group link into Mobile Drawer / Hamburger Menu
  function injectEnt2MobileDrawerItem() {
    if (!settings.ent2_enabled || !settings.ent2_mobile_enabled) return;
    // Check if ent2 mobile drawer link already exists anywhere in the document
    if (document.querySelector('.ent2-mobile-drawer-link')) return;

    // Target the primary menu category list in mobile drawer
    const primaryCategoryList = document.querySelector('ul.css-1ffw8mf, ul.e1tah1jq5, .css-1lt8iit ul');
    if (!primaryCategoryList) return;

    let logoUrl = '/ent2-extension/logo.png';
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      logoUrl = chrome.runtime.getURL('logo.png');
    }

    const li = document.createElement('li');
    li.className = 'ent2-mobile-drawer-link';

    const a = document.createElement('a');
    a.className = 'main_category_link';
    a.href = '/ent2';
    a.style.color = '#3182f6';
    a.style.fontWeight = '700';
    a.style.display = 'inline-flex';
    a.style.alignItems = 'center';
    a.style.gap = '8px';
    a.innerHTML = `<img src="${logoUrl}" alt="ent2" style="width:18px; height:18px; border-radius:4px; object-fit:cover; vertical-align:middle;"><span>ent2 분석</span>`;

    a.onclick = (e) => {
      e.preventDefault();
      window.location.href = 'https://playentry.org/ent2';
    };

    li.appendChild(a);
    primaryCategoryList.appendChild(li);
  }

  // 5. Inject '나의 학급' into my_info section above '회원 정보 수정'
  function injectEnt2MyInfoGroupLink() {
    if (!settings.ent2_enabled) return;
    const myInfoBox = document.querySelector('.my_info');
    if (!myInfoBox) return;

    // Check if group link already exists in my_info
    if (myInfoBox.querySelector('.ent2-group-link') || Array.from(myInfoBox.querySelectorAll('a')).some(a => a.href && a.href.includes('/group'))) return;

    const groupLink = document.createElement('a');
    groupLink.className = 'cell ent2-group-link';
    groupLink.href = 'https://playentry.org/group';
    groupLink.innerHTML = `<span>나의 학급</span>`;

    const modifyInfoBtn = Array.from(myInfoBox.querySelectorAll('a')).find(a => a.href && a.href.includes('/personal'));
    if (modifyInfoBtn && modifyInfoBtn.parentNode) {
      myInfoBox.insertBefore(groupLink, modifyInfoBtn);
    } else {
      myInfoBox.appendChild(groupLink);
    }
  }

  // Observer Loop for DOM Dynamic Updates
  const observer = new MutationObserver(() => {
    injectEnt2DropdownOptions();
    injectEnt2HeaderSearchBtn();
    injectEnt2MobileDrawerItem();
    injectEnt2MyInfoGroupLink();
    const existingNavBtn = document.querySelector('.ent2-nav-item');
    if (existingNavBtn) existingNavBtn.remove();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Initial run
  document.addEventListener('DOMContentLoaded', () => {
    injectEnt2DropdownOptions();
    injectEnt2HeaderSearchBtn();
    injectEnt2MobileDrawerItem();
    injectEnt2MyInfoGroupLink();
    const existingNavBtn = document.querySelector('.ent2-nav-item');
    if (existingNavBtn) existingNavBtn.remove();
  });
  setTimeout(() => {
    injectEnt2DropdownOptions();
    injectEnt2HeaderSearchBtn();
    injectEnt2MobileDrawerItem();
    injectEnt2MyInfoGroupLink();
    const existingNavBtn = document.querySelector('.ent2-nav-item');
    if (existingNavBtn) existingNavBtn.remove();
  }, 500);
})();

