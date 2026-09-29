/**
 * ============================================================================
 * Study Tab Collections - Generic SPA Content Script
 * ============================================================================
 *
 * Purpose:
 * Runs inside ALL pages to detect URL changes that happen via the History API
 * (pushState / replaceState) or the popstate event — without a full page reload.
 *
 * This is critical for Single Page Applications like animepahe, crunchyroll,
 * netflix, etc., where navigating from one episode to the next changes the URL
 * without reloading the page, meaning chrome.tabs.onUpdated never fires.
 *
 * Why chrome.tabs.onUpdated alone is NOT enough:
 *   - `changeInfo.url` in onUpdated is only fired on real HTTP navigations.
 *   - SPA navigation via history.pushState() does NOT trigger onUpdated.
 *   - This content script bridges that gap by patching the History API
 *     and listening to popstate, then forwarding the new URL to the background.
 */

(function () {
  "use strict";

  let lastKnownUrl = window.location.href;

  /**
   * Safely send a URL change notification to the background service worker.
   * Includes the updated title (waits a tick to let the SPA render the new title).
   */
  function notifyUrlChange(newUrl) {
    try {
      if (!chrome.runtime?.id) return; // Extension context invalidated

      // Small delay so the SPA has time to update document.title
      setTimeout(() => {
        try {
          if (!chrome.runtime?.id) return;

          const title = document.title || newUrl;
          const favIconUrl = (() => {
            const el = document.querySelector("link[rel~='icon']");
            if (el?.href) return el.href;
            return `${location.origin}/favicon.ico`;
          })();

          chrome.runtime.sendMessage({
            type: "spa-navigated",
            url: newUrl,
            title: title,
            favIconUrl: favIconUrl,
          }).catch(() => {
            // Ignored: background worker may be sleeping or popup closed
          });
        } catch (_) {
          // Ignore context invalidation errors on the inner call
        }
      }, 300);
    } catch (_) {
      // Ignore outer errors
    }
  }

  /**
   * Called whenever we detect the URL may have changed.
   * Guards against firing when the URL hasn't actually changed.
   */
  function handlePossibleNavigation(newUrl) {
    if (!newUrl || newUrl === lastKnownUrl) return;
    lastKnownUrl = newUrl;
    notifyUrlChange(newUrl);
  }

  // 1. Patch history.pushState
  // pushState is the primary way SPAs change URLs without a reload.
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    originalPushState(...args);
    handlePossibleNavigation(window.location.href);
  };

  // 2. Patch history.replaceState
  // Some SPAs use this for minor URL updates (e.g., adding query params).
  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function (...args) {
    originalReplaceState(...args);
    handlePossibleNavigation(window.location.href);
  };

  // 3. Listen to popstate
  // Fires when the user presses the browser Back/Forward button in a SPA.
  window.addEventListener("popstate", () => {
    handlePossibleNavigation(window.location.href);
  });

  // 4. Fallback: MutationObserver on <title>
  // Some SPAs update the <title> tag slightly after pushState.
  const titleElement = document.querySelector("title");
  if (titleElement) {
    const titleObserver = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastKnownUrl) {
        handlePossibleNavigation(currentUrl);
      }
    });
    titleObserver.observe(titleElement, { childList: true });
  }

  // 5. Fallback: Poll URL every 1.5s
  // Safety net for SPAs using exotic routing that bypasses pushState patching.
  setInterval(() => {
    handlePossibleNavigation(window.location.href);
  }, 1500);

})();
