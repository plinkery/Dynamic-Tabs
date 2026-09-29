/**
 * ============================================================================
 * Study Tab Collections - YouTube Content Script
 * ============================================================================
 * 
 * Purpose:
 * Runs inside YouTube pages to dynamically monitor:
 * 1. SPA (Single Page Application) navigation when moving between playlist videos.
 * 2. Current video playback progress (timestamp in seconds).
 * 3. Exact URL and document title directly from the page context.
 * 
 * Why this is needed:
 * YouTube does not reload the page when playing the next video in a playlist.
 * Relying on background events alone can result in stale URLs or mismatched
 * playlist index parameters. By reading `window.location.href` directly from
 * inside the page, we guarantee the saved tab always has the exact active video!
 */

let lastKnownUrl = window.location.href;
let lastSentSeconds = -1;

/**
 * Safely send a message to the background service worker.
 * Handles the edge case where the extension was reloaded in chrome://extensions.
 */
function notifyBackground(type, extra = {}) {
  try {
    if (!chrome.runtime?.id) return; // Extension context invalidated

    const video = document.querySelector("video");
    const seconds = video && Number.isFinite(video.currentTime)
      ? Math.floor(video.currentTime)
      : 0;

    chrome.runtime.sendMessage({
      type: type,
      url: window.location.href,
      title: document.title || "YouTube",
      seconds: seconds,
      ...extra
    }).catch(() => {
      // Ignored: extension popup or worker temporarily sleeping
    });
  } catch (err) {
    // Ignore context invalidation errors
  }
}

/**
 * Handle URL / Video change (e.g. Next video in a playlist, clicked related video)
 */
function handleUrlChange() {
  const currentUrl = window.location.href;

  // Only trigger if URL actually changed
  if (currentUrl === lastKnownUrl) return;

  lastKnownUrl = currentUrl;
  lastSentSeconds = 0; // Reset seconds for new video

  // Small delay to allow YouTube to update document.title
  setTimeout(() => {
    notifyBackground("youtube-navigated", { seconds: 0 });
  }, 400);
}

/**
 * Send playback progress (timestamp) periodically while watching
 */
function checkPlaybackProgress() {
  const video = document.querySelector("video");
  if (!video || Number.isNaN(video.currentTime)) return;

  const currentSeconds = Math.floor(video.currentTime);

  // Send update if elapsed time moved by at least 3 seconds, or video just started
  if (Math.abs(currentSeconds - lastSentSeconds) >= 3 || (lastSentSeconds === -1 && currentSeconds > 0)) {
    lastSentSeconds = currentSeconds;
    notifyBackground("youtube-progress", { seconds: currentSeconds });
  }
}

/**
 * YouTube-specific SPA Navigation Events:
 * YouTube dispatches custom events when changing videos inside its SPA player.
 */
window.addEventListener("yt-navigate-finish", handleUrlChange);
document.addEventListener("yt-page-data-updated", handleUrlChange);
window.addEventListener("popstate", handleUrlChange);

// Fallback observer: Detect title changes which always accompany video navigation
const titleObserver = new MutationObserver(() => {
  if (window.location.href !== lastKnownUrl) {
    handleUrlChange();
  }
});

const titleElement = document.querySelector("title");
if (titleElement) {
  titleObserver.observe(titleElement, { childList: true });
}

// Check playback progress every 3 seconds
setInterval(checkPlaybackProgress, 3000);

// Capture final playback timestamp before tab is closed or switched
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    checkPlaybackProgress();
  }
});

window.addEventListener("pagehide", checkPlaybackProgress);
window.addEventListener("beforeunload", checkPlaybackProgress);

// Initial notification when page first loads
setTimeout(() => {
  notifyBackground("youtube-navigated");
}, 1000);
