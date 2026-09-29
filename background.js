/**
 * ============================================================================
 * Study Tab Collections - Background Service Worker (Manifest V3)
 * ============================================================================
 * 
 * Purpose:
 * Runs in the background to:
 * 1. Maintain persistent storage of study collections (`studyCollections`).
 * 2. Maintain a live mapping between open Chrome tabs and saved items (`trackedTabs`).
 * 3. Dynamically update saved tab URLs, titles, and video timestamps as the user browses.
 * 4. Clean and normalize YouTube playlist URLs so reopening a saved tab always resumes
 *    the exact video where the user left off, without falling back to the first video.
 */

const STORAGE_KEY = "studyCollections";
const TRACKED_TABS_KEY = "trackedTabs";

/**
 * Helper: Retrieve collections and tracked tabs from local storage.
 * Storage is local to the user's browser, completely offline and private.
 */
async function getStore() {
  const data = await chrome.storage.local.get([STORAGE_KEY, TRACKED_TABS_KEY]);
  return {
    collections: data[STORAGE_KEY] || [],
    trackedTabs: data[TRACKED_TABS_KEY] || {}
  };
}

/**
 * Helper: Save study collections back to local storage.
 */
async function saveCollections(collections) {
  await chrome.storage.local.set({ [STORAGE_KEY]: collections });
}

/**
 * Helper: Save tracked tabs map back to local storage.
 */
async function saveTrackedTabs(trackedTabs) {
  await chrome.storage.local.set({ [TRACKED_TABS_KEY]: trackedTabs });
}

/**
 * Helper: Locate a saved tab and its containing group within nested collections.
 * Recursively searches root collections and nested subgroups.
 * Tracks if any ancestor group has dynamic updates enabled.
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
 * Helper: Clean and format YouTube URLs for playlists and resume timestamps.
 */
function cleanYouTubeUrl(rawUrl, seconds = 0) {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.includes("youtube.com")) return rawUrl;

    const videoId = parsed.searchParams.get("v");
    if (!videoId) return rawUrl; // Channel, home, or playlist-only page

    const playlistId = parsed.searchParams.get("list");

    // Construct canonical watch URL
    const clean = new URL("https://www.youtube.com/watch");
    clean.searchParams.set("v", videoId);

    // Keep playlist context if user is watching in a playlist
    if (playlistId) {
      clean.searchParams.set("list", playlistId);
    }

    // Append playback resume timestamp if available
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
 * Only updates if dynamic update is enabled on the tab OR the containing group.
 */
async function updateTrackedTab(tabId, changes = {}) {
  const { collections, trackedTabs } = await getStore();
  const tracked = trackedTabs[String(tabId)];
  if (!tracked) return;

  const { group, savedTab, isGroupDynamic } = findGroupAndTab(collections, tracked.groupId, tracked.savedTabId);
  if (!savedTab) {
    // If saved tab was deleted by user, untrack this tab
    delete trackedTabs[String(tabId)];
    await saveTrackedTabs(trackedTabs);
    return;
  }

  // DYNAMIC TRACKING CHECK:
  // Tab-level setting has highest priority: users can unselect individual tabs to stay static.
  // If not explicitly set on the tab, it inherits from the containing folder.
  const isDynamic = typeof savedTab.dynamic === "boolean" ? savedTab.dynamic : isGroupDynamic;
  if (!isDynamic) {
    // Tab is in static bookmark mode: preserve existing saved URL and timestamps
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

    // If navigated to a completely different YouTube video, reset progress
    if (oldVideoId !== newVideoId) {
      savedTab.youtubeSeconds = 0;
    }

    // Update thumbnail if it's YouTube
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
 * Works across all websites (articles, docs, github, etc.)
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
 * Removes the open tab ID from `trackedTabs` mapping.
 * The saved collection item remains safely preserved in storage!
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
  // 0. Generic SPA navigation (animepahe, crunchyroll, any history.pushState site)
  //    Fired by spa-content.js which patches pushState/replaceState on ALL pages.
  if (message?.type === "spa-navigated" && sender.tab?.id) {
    updateTrackedTab(sender.tab.id, {
      url: message.url,
      title: message.title,
      favIconUrl: message.favIconUrl
    });
    sendResponse({ ok: true });
    return true;
  }

  // 1. YouTube Video Navigated (Playlist next/prev, clicked video)
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

  // 3. Register a tab for tracking (Enforces 1-to-1 Mapping Protocol)
  if (message?.type === "track-saved-tab") {
    getStore()
      .then(({ trackedTabs }) => {
        // PROTOCOL PRECAUTION: Single Active Binding
        // A collection item can only be bound dynamically to ONE open browser tab at a time.
        // If another tab was previously bound to this savedTabId, remove that old mapping
        // so multiple open tabs cannot fight or clobber each other's state.
        for (const [existingTabId, info] of Object.entries(trackedTabs)) {
          if (info.savedTabId === message.savedTabId && existingTabId !== String(message.tabId)) {
            delete trackedTabs[existingTabId];
          }
        }
        trackedTabs[String(message.tabId)] = {
          groupId: message.groupId,
          savedTabId: message.savedTabId
        };
        return saveTrackedTabs(trackedTabs);
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // 4. Untrack a tab
  if (message?.type === "untrack-saved-tab") {
    getStore()
      .then(({ trackedTabs }) => {
        delete trackedTabs[String(message.tabId)];
        return saveTrackedTabs(trackedTabs);
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // 5. Query active tracked tab mappings (used by popup to show live "Active" badges)
  if (message?.type === "get-tracked-tabs") {
    getStore()
      .then(({ trackedTabs }) => {
        sendResponse({ ok: true, trackedTabs });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // 6. Capture visible tab thumbnail (Microsoft Collections style)
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

  return false;
});
