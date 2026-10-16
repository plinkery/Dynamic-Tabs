/**
 * ============================================================================
 * Study Tab Collections - Background Service Worker (Manifest V3)
 * ============================================================================
 * 
 * Purpose:
 * Runs in the background to:
 * 1. Maintain persistent storage of study collections (`studyCollections`).
 * 2. Maintain a live, authoritative mapping between open Chrome tabs and saved items (`trackedTabs`).
 * 3. Reconcile tracked tabs with actual open browser tabs to prevent stale tab IDs.
 * 4. Dynamically update saved tab URLs, titles, and video timestamps as the user browses.
 * 5. Clean and normalize YouTube playlist URLs so reopening a saved tab always resumes
 *    the exact video where the user left off, without falling back to the first video.
 * 6. Track and restore website scroll positions for dynamic tabs.
 * 7. Provide atomic batch operations and instant memory caching for zero lag.
 */

const STORAGE_KEY = "studyCollections";
const TRACKED_TABS_KEY = "trackedTabs";

// In-memory cache to prevent repeated disk I/O and storage lock contention
let _cachedCollections = null;
let _cachedTrackedTabs = null;
let _saveCollectionsTimer = null;
let _saveTrackedTimer = null;

/**
 * Helper: Retrieve collections and tracked tabs from local storage or memory cache.
 */
async function getStore() {
  if (_cachedCollections !== null && _cachedTrackedTabs !== null) {
    return {
      collections: _cachedCollections,
      trackedTabs: _cachedTrackedTabs
    };
  }

  const data = await chrome.storage.local.get([STORAGE_KEY, TRACKED_TABS_KEY]);
  _cachedCollections = data[STORAGE_KEY] || [];
  _cachedTrackedTabs = data[TRACKED_TABS_KEY] || {};
  return {
    collections: _cachedCollections,
    trackedTabs: _cachedTrackedTabs
  };
}

/**
 * Helper: Save study collections back to local storage with debouncing.
 */
async function saveCollections(collections, immediate = false) {
  _cachedCollections = collections;
  clearTimeout(_saveCollectionsTimer);

  if (immediate) {
    await chrome.storage.local.set({ [STORAGE_KEY]: _cachedCollections });
    return;
  }

  return new Promise((resolve) => {
    _saveCollectionsTimer = setTimeout(async () => {
      try {
        if (_cachedCollections) {
          await chrome.storage.local.set({ [STORAGE_KEY]: _cachedCollections });
        }
      } catch (_) {}
      resolve();
    }, 400);
  });
}

/**
 * Helper: Save tracked tabs map back to local storage with debouncing.
 */
async function saveTrackedTabs(trackedTabs, immediate = false) {
  _cachedTrackedTabs = trackedTabs;
  clearTimeout(_saveTrackedTimer);

  if (immediate) {
    await chrome.storage.local.set({ [TRACKED_TABS_KEY]: _cachedTrackedTabs });
    return;
  }

  return new Promise((resolve) => {
    _saveTrackedTimer = setTimeout(async () => {
      try {
        if (_cachedTrackedTabs) {
          await chrome.storage.local.set({ [TRACKED_TABS_KEY]: _cachedTrackedTabs });
        }
      } catch (_) {}
      resolve();
    }, 250);
  });
}

/**
 * Helper: Flush any pending memory writes to disk immediately.
 */
async function flushStore() {
  clearTimeout(_saveCollectionsTimer);
  clearTimeout(_saveTrackedTimer);
  const writes = [];
  if (_cachedCollections !== null) {
    writes.push(chrome.storage.local.set({ [STORAGE_KEY]: _cachedCollections }));
  }
  if (_cachedTrackedTabs !== null) {
    writes.push(chrome.storage.local.set({ [TRACKED_TABS_KEY]: _cachedTrackedTabs }));
  }
  await Promise.all(writes);
}

/**
 * Sync memory cache if storage is modified externally
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEY]) {
    _cachedCollections = changes[STORAGE_KEY].newValue || [];
  }
  if (changes[TRACKED_TABS_KEY]) {
    _cachedTrackedTabs = changes[TRACKED_TABS_KEY].newValue || {};
  }
});

/**
 * Authoritative: Reconcile tracked tabs with the REAL browser tabs currently open.
 * - Removes dead tab IDs from previous browser sessions or closed windows.
 * - Auto-binds open browser tabs that match saved collection tabs (e.g. after browser restart with restored tabs).
 */
async function getLiveTrackedTabs() {
  const { collections, trackedTabs } = await getStore();
  
  let allBrowserTabs = [];
  try {
    allBrowserTabs = await chrome.tabs.query({});
  } catch (_) {
    return trackedTabs;
  }

  const browserTabMap = new Map();
  allBrowserTabs.forEach((t) => {
    if (t.id) browserTabMap.set(t.id, t);
  });

  let modified = false;

  // 1. Purge dead tab IDs that no longer exist in Chrome
  for (const tabIdStr of Object.keys(trackedTabs)) {
    const numId = Number(tabIdStr);
    if (!browserTabMap.has(numId)) {
      delete trackedTabs[tabIdStr];
      modified = true;
    }
  }

  // 2. Build index of collection tabs
  const savedTabsByUrl = new Map();
  function indexGroup(group) {
    if (Array.isArray(group.tabs)) {
      group.tabs.forEach((t) => {
        const u = t.lastUrl || t.url;
        if (u) {
          savedTabsByUrl.set(u, { groupId: group.id, savedTab: t });
        }
      });
    }
    if (Array.isArray(group.subgroups)) {
      group.subgroups.forEach(indexGroup);
    }
  }
  collections.forEach(indexGroup);

  // 3. Auto-match open tabs with collection tabs if not already tracked
  const currentlyBoundSavedIds = new Set(
    Object.values(trackedTabs).map((info) => info.savedTabId)
  );

  for (const tab of allBrowserTabs) {
    if (!tab.id || !tab.url || trackedTabs[String(tab.id)]) continue;

    // Match exact URL or canonical URL
    let match = savedTabsByUrl.get(tab.url);
    if (!match) {
      for (const [savedUrl, info] of savedTabsByUrl.entries()) {
        if (!currentlyBoundSavedIds.has(info.savedTab.id)) {
          try {
            const u1 = new URL(tab.url);
            const u2 = new URL(savedUrl);
            if (u1.origin === u2.origin && u1.pathname === u2.pathname) {
              match = info;
              break;
            }
          } catch (_) {}
        }
      }
    }

    if (match && !currentlyBoundSavedIds.has(match.savedTab.id)) {
      trackedTabs[String(tab.id)] = {
        groupId: match.groupId,
        savedTabId: match.savedTab.id,
        pendingScrollY: match.savedTab.scrollY || 0
      };
      currentlyBoundSavedIds.add(match.savedTab.id);
      modified = true;
    }
  }

  if (modified) {
    await saveTrackedTabs(trackedTabs, true);
  }

  return trackedTabs;
}

// Reconcile on extension/browser startup
chrome.runtime.onStartup.addListener(() => {
  getLiveTrackedTabs().catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  getLiveTrackedTabs().catch(() => {});
});

/**
 * Helper: Locate a saved tab and its containing group within nested collections.
 */
function findGroupAndTab(groups, groupId, savedTabId, parentDynamic = false) {
  if (!Array.isArray(groups)) return {};

  for (const group of groups) {
    const isGroupDynamic = typeof group.dynamic === "boolean" ? group.dynamic : parentDynamic;

    // 1. If groupId matches directly
    if (group.id === groupId && Array.isArray(group.tabs)) {
      const savedTab = group.tabs.find((item) => item.id === savedTabId);
      if (savedTab) {
        return { group, savedTab, isGroupDynamic };
      }
    }

    // 2. Also search tabs in this group in case tab moved or groupId wasn't updated
    if (Array.isArray(group.tabs)) {
      const savedTab = group.tabs.find((item) => item.id === savedTabId);
      if (savedTab) {
        return { group, savedTab, isGroupDynamic };
      }
    }

    // 3. Search nested subgroups recursively
    if (Array.isArray(group.subgroups) && group.subgroups.length > 0) {
      const result = findGroupAndTab(group.subgroups, groupId, savedTabId, isGroupDynamic);
      if (result.savedTab) {
        return result;
      }
    }
  }

  return {};
}

/**
 * Helper: Extract clean YouTube video ID if URL is a YouTube video.
 */
function getYouTubeVideoId(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("youtube.com")) return null;
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

/**
 * Helper: Construct canonical clean YouTube URL that retains video ID,
 * playlist context, and resume timestamp (&t=X).
 */
function cleanYouTubeUrl(rawUrl, seconds = 0) {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.includes("youtube.com")) return rawUrl;

    const videoId = parsed.searchParams.get("v");
    if (!videoId) return rawUrl;

    const playlistId = parsed.searchParams.get("list");

    const clean = new URL("https://www.youtube.com/watch");
    clean.searchParams.set("v", videoId);

    if (playlistId) {
      clean.searchParams.set("list", playlistId);
    }

    if (Number.isFinite(seconds) && seconds > 0) {
      clean.searchParams.set("t", `${Math.floor(seconds)}s`);
    }

    return clean.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Update a tracked saved tab with latest URL, title, favicon, or video progress.
 */
async function updateTrackedTab(tabId, changes = {}) {
  const { collections, trackedTabs } = await getStore();
  const tracked = trackedTabs[String(tabId)];
  if (!tracked) return;

  const { group, savedTab, isGroupDynamic } = findGroupAndTab(collections, tracked.groupId, tracked.savedTabId);
  if (!savedTab) {
    delete trackedTabs[String(tabId)];
    await saveTrackedTabs(trackedTabs);
    return;
  }

  const isDynamic = typeof savedTab.dynamic === "boolean" ? savedTab.dynamic : isGroupDynamic;
  if (!isDynamic) {
    return;
  }

  const now = Date.now();
  let hasChanges = false;

  // 1. Handle URL change
  if (changes.url && changes.url !== savedTab.url) {
    const oldVideoId = getYouTubeVideoId(savedTab.url);
    const newVideoId = getYouTubeVideoId(changes.url);

    savedTab.url = changes.url;
    savedTab.lastUrl = changes.url;

    if (oldVideoId !== newVideoId) {
      savedTab.youtubeSeconds = 0;
      savedTab.scrollY = 0;
    }

    if (newVideoId) {
      savedTab.thumbnail = `https://img.youtube.com/vi/${newVideoId}/mqdefault.jpg`;
    }

    savedTab.updatedAt = now;
    hasChanges = true;
  }

  // 2. Handle Title change
  if (changes.title && changes.title.trim() && changes.title !== savedTab.title) {
    savedTab.title = changes.title.trim();
    savedTab.updatedAt = now;
    hasChanges = true;
  }

  // 3. Handle FavIcon change
  if (changes.favIconUrl && changes.favIconUrl !== savedTab.favIconUrl) {
    savedTab.favIconUrl = changes.favIconUrl;
    savedTab.updatedAt = now;
    hasChanges = true;
  }

  // 4. Handle YouTube playback progress (seconds)
  if (Number.isFinite(changes.youtubeSeconds)) {
    const seconds = Math.floor(changes.youtubeSeconds);
    savedTab.youtubeSeconds = seconds;
    savedTab.lastUrl = cleanYouTubeUrl(savedTab.url, seconds);
    savedTab.updatedAt = now;
    hasChanges = true;
  }

  if (hasChanges) {
    await saveCollections(collections);
  }
}

/**
 * Listener: Track standard tab updates (navigation, title changes, favicons).
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const changes = {};

  if (changeInfo.url) {
    changes.url = changeInfo.url;
  }
  if (tab.title) {
    changes.title = tab.title;
  }
  if (tab.favIconUrl) {
    changes.favIconUrl = tab.favIconUrl;
  }

  if (Object.keys(changes).length > 0) {
    updateTrackedTab(tabId, changes);
  }
});

/**
 * Listener: When a tab is closed in the browser.
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { trackedTabs } = await getStore();
  if (trackedTabs[String(tabId)]) {
    delete trackedTabs[String(tabId)];
    await saveTrackedTabs(trackedTabs);
  }
});

/**
 * Listener: Handle messages sent from popup.js or content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 0. Generic SPA navigation
  if (message?.type === "spa-navigated" && sender.tab?.id) {
    updateTrackedTab(sender.tab.id, {
      url: message.url,
      title: message.title,
      favIconUrl: message.favIconUrl
    });
    sendResponse({ ok: true });
    return true;
  }

  // 1. YouTube Video Navigated
  if (message?.type === "youtube-navigated" && sender.tab?.id) {
    updateTrackedTab(sender.tab.id, {
      url: message.url,
      title: message.title,
      youtubeSeconds: message.seconds || 0
    });
    sendResponse({ ok: true });
    return true;
  }

  // 2. YouTube Playback Progress
  if (message?.type === "youtube-progress" && sender.tab?.id) {
    updateTrackedTab(sender.tab.id, {
      url: message.url,
      title: message.title,
      youtubeSeconds: message.seconds
    });
    sendResponse({ ok: true });
    return true;
  }

  // 3. Register a tab for tracking (single)
  if (message?.type === "track-saved-tab") {
    getStore()
      .then(async ({ trackedTabs }) => {
        for (const [existingTabId, info] of Object.entries(trackedTabs)) {
          if (info.savedTabId === message.savedTabId && existingTabId !== String(message.tabId)) {
            delete trackedTabs[existingTabId];
          }
        }
        trackedTabs[String(message.tabId)] = {
          groupId: message.groupId,
          savedTabId: message.savedTabId,
          pendingScrollY: message.scrollY || 0
        };
        await saveTrackedTabs(trackedTabs, true);
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // 3-batch. Register multiple tabs in a single atomic batch (prevents race conditions)
  if (message?.type === "track-saved-tabs-batch") {
    getStore()
      .then(async ({ trackedTabs }) => {
        if (Array.isArray(message.items)) {
          for (const item of message.items) {
            for (const [existingTabId, info] of Object.entries(trackedTabs)) {
              if (info.savedTabId === item.savedTabId && existingTabId !== String(item.tabId)) {
                delete trackedTabs[existingTabId];
              }
            }
            trackedTabs[String(item.tabId)] = {
              groupId: item.groupId,
              savedTabId: item.savedTabId,
              pendingScrollY: item.scrollY || 0
            };
          }
          await saveTrackedTabs(trackedTabs, true);
        }
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // 3a. Content script requests pending scroll target for this tab (called on page load)
  if (message?.type === "get-pending-scroll" && sender.tab?.id) {
    getStore()
      .then(({ collections, trackedTabs }) => {
        const tracked = trackedTabs[String(sender.tab.id)];
        let scrollY = tracked?.pendingScrollY || 0;
        if (!scrollY && tracked) {
          const { savedTab } = findGroupAndTab(collections, tracked.groupId, tracked.savedTabId);
          if (savedTab?.scrollY) {
            scrollY = savedTab.scrollY;
          }
        }
        sendResponse({ ok: true, scrollY });
      })
      .catch(() => sendResponse({ ok: true, scrollY: 0 }));
    return true;
  }

  // 3b. Content script reports current scroll position for the tracked tab
  if (message?.type === "save-scroll-position" && sender.tab?.id) {
    getStore()
      .then(async ({ collections, trackedTabs }) => {
        const tracked = trackedTabs[String(sender.tab.id)];
        if (!tracked) return sendResponse({ ok: false });
        const { savedTab, isGroupDynamic } = findGroupAndTab(collections, tracked.groupId, tracked.savedTabId);
        if (savedTab) {
          const isDynamic = typeof savedTab.dynamic === "boolean" ? savedTab.dynamic : isGroupDynamic;
          if (isDynamic) {
            savedTab.scrollY = Math.round(message.scrollY || 0);
            savedTab.updatedAt = Date.now();
            await saveCollections(collections);
          }
        }
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  // 4. Untrack a tab
  if (message?.type === "untrack-saved-tab") {
    getStore()
      .then(async ({ trackedTabs }) => {
        delete trackedTabs[String(message.tabId)];
        await saveTrackedTabs(trackedTabs, true);
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // 5. Query active tracked tab mappings (guaranteed reconciled with live browser tabs)
  if (message?.type === "get-tracked-tabs") {
    getLiveTrackedTabs()
      .then((trackedTabs) => {
        sendResponse({ ok: true, trackedTabs });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // 6. Clear all tracked tabs (called when "Close Tracked" button executes)
  if (message?.type === "clear-all-tracked-tabs") {
    _cachedTrackedTabs = {};
    saveTrackedTabs({}, true)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // 7. Capture visible tab thumbnail
  if (message?.type === "capture-tab-thumbnail") {
    const windowId = message.windowId || null;
    try {
      chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 50 }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          sendResponse({ ok: false, error: chrome.runtime.lastError?.message || "Capture failed" });
        } else {
          sendResponse({ ok: true, dataUrl });
        }
      });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return true;
  }

  // 8. Flush memory cache to disk immediately
  if (message?.type === "flush-store") {
    flushStore()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  return false;
});
