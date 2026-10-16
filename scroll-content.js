/**
 * ============================================================================
 * Study Tab Collections – Scroll Position Content Script
 * ============================================================================
 *
 * Purpose:
 *   1. On page load: asks the background worker if this tab has a pending
 *      scroll-restore position. Restores smoothly even on dynamically rendered SPAs.
 *
 *   2. While the page is open: saves the user's current scroll position back
 *      to the saved tab record (only persisted if marked as dynamic).
 */

(function () {
  "use strict";

  // Guard: don't run if extension context is invalid
  if (!chrome?.runtime?.id) return;

  // ─── 1. Restore scroll position ──────────────────────────────────────────
  let targetScrollY = 0;
  let restoreAttempts = 0;
  let restoreInterval = null;

  function attemptScrollRestore() {
    if (targetScrollY <= 0) return;
    restoreAttempts++;

    // Try scrolling to target
    window.scrollTo({ top: targetScrollY, behavior: "instant" });

    // Check if we are close to the target or document reached sufficient height
    const reached = Math.abs(window.scrollY - targetScrollY) < 60;
    const documentReady = document.readyState === "complete";

    if (reached || (restoreAttempts >= 12 && documentReady)) {
      if (restoreInterval) {
        clearInterval(restoreInterval);
        restoreInterval = null;
      }
    }
  }

  function startScrollRestore(scrollY) {
    targetScrollY = Math.round(scrollY);
    if (targetScrollY <= 0) return;

    // First immediate attempt
    attemptScrollRestore();

    // Repeated attempts for asynchronous / dynamically rendered content
    restoreInterval = setInterval(attemptScrollRestore, 250);

    // Stop trying after 4 seconds max
    setTimeout(() => {
      if (restoreInterval) {
        clearInterval(restoreInterval);
        restoreInterval = null;
      }
    }, 4000);
  }

  function requestScrollRestore() {
    try {
      chrome.runtime.sendMessage({ type: "get-pending-scroll" }, (response) => {
        if (chrome.runtime.lastError) return;
        const scrollY = response?.scrollY || 0;
        if (scrollY > 0) {
          if (document.readyState === "complete" || document.readyState === "interactive") {
            startScrollRestore(scrollY);
          } else {
            window.addEventListener("DOMContentLoaded", () => startScrollRestore(scrollY), { once: true });
            window.addEventListener("load", () => startScrollRestore(scrollY), { once: true });
          }
        }
      });
    } catch (_) {}
  }

  requestScrollRestore();

  // ─── 2. Save scroll position periodically & on unload ────────────────────
  let lastSavedScrollY = -1;
  let saveScrollTimer = null;

  function flushScrollSave() {
    const currentY = Math.round(window.scrollY);
    if (currentY === lastSavedScrollY) return;
    lastSavedScrollY = currentY;

    try {
      if (!chrome?.runtime?.id) return;
      chrome.runtime.sendMessage(
        {
          type: "save-scroll-position",
          scrollY: currentY
        },
        () => {
          if (chrome.runtime.lastError) {}
        }
      );
    } catch (_) {}
  }

  function scheduleSaveScroll() {
    clearTimeout(saveScrollTimer);
    saveScrollTimer = setTimeout(flushScrollSave, 1200);
  }

  window.addEventListener("scroll", scheduleSaveScroll, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushScrollSave();
    }
  });

  window.addEventListener("pagehide", flushScrollSave, { capture: true });
  window.addEventListener("beforeunload", flushScrollSave, { capture: true });

})();
