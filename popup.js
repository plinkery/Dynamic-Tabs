/**
 * Recursively update dynamic tracking mode for a group, all its subgroups, and all its tabs.
 */
function setDynamicRecursively(group, dynamicState) {
  group.dynamic = dynamicState;
  group.updatedAt = Date.now();
  if (Array.isArray(group.tabs)) {
    group.tabs.forEach((tab) => {
      tab.dynamic = dynamicState;
      tab.updatedAt = Date.now();
    });
  }
  if (Array.isArray(group.subgroups)) {
    group.subgroups.forEach((sub) => {
      setDynamicRecursively(sub, dynamicState);
    });
  }
}

/**
 * ============================================================================
 * Collections - Popup Script (Microsoft Edge Collections Style)
 * ============================================================================
 * 
 * Features:
 * - Rebranded Collections manager with hierarchical sub-folders.
 * - Optional dynamic live tracking for individual tabs or entire folders.
 * - Color palette GUI with preset swatches, shade picker, and hex code input.
 * - Drag-and-drop reordering for groups, sub-folders, and tabs.
 * - Tab thumbnails (YouTube video stills, browser page captures, domain banners).
 * - Custom group cover thumbnails (pick from member tabs, image URL, or upload).
 * - Offline, local-first Chrome storage with real-time synchronization.
 */

// Storage Keys matching background.js
const STORAGE_KEY = "studyCollections";
const TRACKED_TABS_KEY = "trackedTabs";

// Default curated palette colors
const DEFAULT_COLORS = [
  "#0284c7", // Sky Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ec4899", // Rose
  "#6366f1", // Indigo
  "#06b6d4", // Cyan
  "#64748b"  // Slate
];

// DOM Elements Cache
const els = {
  statsLine: document.getElementById("statsLine"),
  quickAddCurrentBtn: document.getElementById("quickAddCurrentBtn"),
  openPickerBtn: document.getElementById("openPickerBtn"),
  openFullTabBtn: document.getElementById("openFullTabBtn"),
  closeTrackedTabsBtn: document.getElementById("closeTrackedTabsBtn"),
  menuToggleBtn: document.getElementById("menuToggleBtn"),
  moreMenu: document.getElementById("moreMenu"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),

  // Color Palette GUI
  colorPaletteSwatches: document.getElementById("colorPaletteSwatches"),
  paletteColorPicker: document.getElementById("paletteColorPicker"),
  customColorPreview: document.getElementById("customColorPreview"),
  hexColorInput: document.getElementById("hexColorInput"),

  // Collection creation
  subjectInput: document.getElementById("subjectInput"),
  createSubjectBtn: document.getElementById("createSubjectBtn"),

  // Search & Container
  searchInput: document.getElementById("searchInput"),
  groupsContainer: document.getElementById("groupsContainer"),

  // Open Tabs Picker Modal
  pickerModal: document.getElementById("pickerModal"),
  closePickerBtn: document.getElementById("closePickerBtn"),
  closePickerBackdrop: document.getElementById("closePickerBackdrop"),
  cancelPickerBtn: document.getElementById("cancelPickerBtn"),
  pickerTargetGroup: document.getElementById("pickerTargetGroup"),
  selectAllTabsBtn: document.getElementById("selectAllTabsBtn"),
  deselectAllTabsBtn: document.getElementById("deselectAllTabsBtn"),
  selectCurrentTabOnlyBtn: document.getElementById("selectCurrentTabOnlyBtn"),
  pickerTabsList: document.getElementById("pickerTabsList"),
  confirmAddTabsBtn: document.getElementById("confirmAddTabsBtn"),
  confirmAddCurrentTabBtn: document.getElementById("confirmAddCurrentTabBtn"),

  // Context Menu
  tabContextMenu: document.getElementById("tabContextMenu"),
  contextOpenNewWindow: document.getElementById("contextOpenNewWindow"),
  contextToggleDynamic: document.getElementById("contextToggleDynamic"),
  contextToggleDynamicLabel: document.getElementById("contextToggleDynamicLabel"),
  contextDeleteTab: document.getElementById("contextDeleteTab"),

  // Quick Add Active Tab Modal
  quickAddModal: document.getElementById("quickAddModal"),
  closeQuickAddBtn: document.getElementById("closeQuickAddBtn"),
  closeQuickAddBackdrop: document.getElementById("closeQuickAddBackdrop"),
  cancelQuickAddBtn: document.getElementById("cancelQuickAddBtn"),
  activeTabTitle: document.getElementById("activeTabTitle"),
  activeTabUrl: document.getElementById("activeTabUrl"),
  activeTabPreview: document.getElementById("activeTabPreview"),
  quickAddTargetGroup: document.getElementById("quickAddTargetGroup"),
  confirmQuickAddBtn: document.getElementById("confirmQuickAddBtn"),

  // Move Tab Modal
  moveModal: document.getElementById("moveModal"),
  closeMoveBtn: document.getElementById("closeMoveBtn"),
  closeMoveBackdrop: document.getElementById("closeMoveBackdrop"),
  cancelMoveBtn: document.getElementById("cancelMoveBtn"),
  moveTabTitle: document.getElementById("moveTabTitle"),
  moveTabUrl: document.getElementById("moveTabUrl"),
  moveTabFavicon: document.getElementById("moveTabFavicon"),
  moveModalGroupsList: document.getElementById("moveModalGroupsList"),

  // Toast Notification
  toastNotification: document.getElementById("toastNotification"),

  // Create Sub-folder Modal
  subfolderModal: document.getElementById("subfolderModal"),
  closeSubfolderBtn: document.getElementById("closeSubfolderBtn"),
  closeSubfolderBackdrop: document.getElementById("closeSubfolderBackdrop"),
  cancelSubfolderBtn: document.getElementById("cancelSubfolderBtn"),
  confirmSubfolderBtn: document.getElementById("confirmSubfolderBtn"),
  subfolderParentLabel: document.getElementById("subfolderParentLabel"),
  subfolderNameInput: document.getElementById("subfolderNameInput"),

  // Group Thumbnail Selector Modal
  thumbnailModal: document.getElementById("thumbnailModal"),
  closeThumbnailBtn: document.getElementById("closeThumbnailBtn"),
  closeThumbnailBackdrop: document.getElementById("closeThumbnailBackdrop"),
  cancelThumbnailBtn: document.getElementById("cancelThumbnailBtn"),
  thumbnailModalSubtitle: document.getElementById("thumbnailModalSubtitle"),
  thumbTabsGrid: document.getElementById("thumbTabsGrid"),
  customThumbUrlInput: document.getElementById("customThumbUrlInput"),
  applyThumbUrlBtn: document.getElementById("applyThumbUrlBtn"),
  thumbFileInput: document.getElementById("thumbFileInput"),
  removeThumbBtn: document.getElementById("removeThumbBtn"),

  // HTML Templates
  groupTemplate: document.getElementById("groupTemplate"),
  savedTabTemplate: document.getElementById("savedTabTemplate"),
  pickerTabTemplate: document.getElementById("pickerTabTemplate")
};

// Application State
let collections = [];
let openTabs = [];
let activeTrackedMap = {}; // Maps savedTabId -> open tabId
let selectedColor = DEFAULT_COLORS[0];
let searchQuery = "";
let currentActiveTab = null;
const expandedGroupIds = new Set(); // Tracks expanded dropdown groups/subgroups

// Modal Contexts
let targetSubfolderParentId = null;
let targetThumbnailGroupId = null;

// Drag and drop state
let draggedTabId = null;
let draggedTabSourceGroupId = null;
let draggedGroupId = null;

// Auto-scroll state for drag
let autoScrollRaf = null;
let autoScrollContainer = null;

// Storage lock flag to prevent race conditions during saves
let isSaving = false;

/**
 * Generate a unique ID (UUID v4 or timestamp fallback)
 */
function uid() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extract YouTube video ID if URL is a YouTube watch or embed URL
 */
function getYouTubeVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate YouTube video thumbnail URL
 */
function getYouTubeThumbnail(url) {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
}

/**
 * Clean up a URL for visual display
 */
function displayDomain(url) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${domain}${path}`.slice(0, 45);
  } catch {
    return url;
  }
}

/**
 * Format elapsed seconds into MM:SS or HH:MM:SS
 */
function formatVideoTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Relative time helper (e.g. "Just now", "5m ago", "2h ago")
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  const diffSecs = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSecs < 60) return "Just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  return `${Math.floor(diffSecs / 86400)}d ago`;
}

/**
 * Filter tabs that can be saved
 */
function isSavableTab(tab) {
  return tab && tab.url && /^(https?|file):/i.test(tab.url);
}

/**
 * Normalize a URL for accurate duplicate comparison
 */
function normalizeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    const pathname = u.pathname.replace(/\/+$/, "") || "/";
    return (u.origin + pathname + u.search).toLowerCase();
  } catch {
    return String(url).trim().toLowerCase().replace(/\/+$/, "");
  }
}

/* ==========================================================================
   Recursive Tree Helpers
   ========================================================================== */

/**
 * Recursively find a group by ID
 */
function findGroupById(groups, id) {
  if (!Array.isArray(groups)) return null;
  for (const g of groups) {
    if (g.id === id) return g;
    if (Array.isArray(g.subgroups) && g.subgroups.length > 0) {
      const found = findGroupById(g.subgroups, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Locate direct parent group of a subgroup
 */
function findParentGroup(groups, targetId, parent = null) {
  if (!Array.isArray(groups)) return undefined;
  for (const g of groups) {
    if (g.id === targetId) return parent;
    if (Array.isArray(g.subgroups) && g.subgroups.length > 0) {
      const found = findParentGroup(g.subgroups, targetId, g);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/**
 * When any tab or subgroup is manually set to non-dynamic,
 * turn off the dynamic button on its group and all ancestor groups.
 */
function updateAncestorsDynamicStateOnDisable(groupId) {
  let currentId = groupId;
  while (currentId) {
    const group = findGroupById(collections, currentId);
    if (group) {
      group.dynamic = false;
      group.updatedAt = Date.now();
    }
    const parent = findParentGroup(collections, currentId);
    currentId = parent ? parent.id : null;
  }
}

/**
 * Recursively find the parent array and index of a group
 */
function findGroupContainer(groups, id) {
  if (!Array.isArray(groups)) return null;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].id === id) {
      return { parentList: groups, index: i, parentGroup: null };
    }
    if (Array.isArray(groups[i].subgroups) && groups[i].subgroups.length > 0) {
      const nested = findGroupContainer(groups[i].subgroups, id);
      if (nested) {
        if (!nested.parentGroup) nested.parentGroup = groups[i];
        return nested;
      }
    }
  }
  return null;
}

/**
 * Flatten all groups/folders into a list with hierarchy depth and labels
 */
function getAllGroupsFlat(groups = collections, depth = 0, parentPath = "") {
  const result = [];
  if (!Array.isArray(groups)) return result;

  for (const g of groups) {
    const prefix = depth === 0 ? "📁 " : "📂 " + "— ".repeat(depth);
    const label = `${prefix}${g.name}`;
    result.push({
      group: g,
      depth: depth,
      label: label,
      fullPath: parentPath ? `${parentPath} / ${g.name}` : g.name
    });

    if (Array.isArray(g.subgroups) && g.subgroups.length > 0) {
      result.push(...getAllGroupsFlat(g.subgroups, depth + 1, parentPath ? `${parentPath} / ${g.name}` : g.name));
    }
  }

  return result;
}

/**
 * Recursively collect all tabs inside a group and all its nested sub-folders
 */
function getAllTabsInGroup(group) {
  const tabs = [];
  if (!group) return tabs;
  if (Array.isArray(group.tabs)) {
    tabs.push(...group.tabs);
  }
  if (Array.isArray(group.subgroups)) {
    for (const sub of group.subgroups) {
      tabs.push(...getAllTabsInGroup(sub));
    }
  }
  return tabs;
}

/**
 * Count all tabs across the entire tree
 */
function countAllTabs(groups = collections) {
  let count = 0;
  if (!Array.isArray(groups)) return 0;
  for (const g of groups) {
    count += (g.tabs?.length || 0);
    if (Array.isArray(g.subgroups)) {
      count += countAllTabs(g.subgroups);
    }
  }
  return count;
}

/**
 * Count total number of collections and sub-folders
 */
function countAllGroups(groups = collections) {
  let count = 0;
  if (!Array.isArray(groups)) return 0;
  for (const g of groups) {
    count += 1;
    if (Array.isArray(g.subgroups)) {
      count += countAllGroups(g.subgroups);
    }
  }
  return count;
}

/* ==========================================================================
   Data Loading & Storage
   ========================================================================== */

/**
 * Load collections and active tracking map from Chrome storage
 */
async function loadState() {
  const data = await chrome.storage.local.get([STORAGE_KEY, TRACKED_TABS_KEY, "_dynamicV2"]);
  const rawCollections = data[STORAGE_KEY] || [];
  const isMigratedV2 = Boolean(data._dynamicV2);

  // Normalize data with backward compatibility
  function normalizeGroup(g, parentId = null, parentDynamic = false) {
    if (!g.id) g.id = uid();
    g.parentId = parentId;
    if (!Array.isArray(g.tabs)) g.tabs = [];
    if (!Array.isArray(g.subgroups)) g.subgroups = [];
    if (typeof g.dynamic !== "boolean") g.dynamic = parentDynamic;
    if (!g.thumbnail) g.thumbnail = null;

    // Backward compat: if old group was dynamic, ensure all its tabs/subgroups are dynamic
    if (!isMigratedV2 && g.dynamic) {
      g.tabs.forEach((t) => { t.dynamic = true; });
      g.subgroups.forEach((sub) => { sub.dynamic = true; });
    }

    // Normalize tabs (skip heavy thumbnail re-compute on every popup open)
    g.tabs.forEach((t) => {
      if (!t.id) t.id = uid();
      if (typeof t.dynamic !== "boolean") t.dynamic = g.dynamic;
      if (!t.thumbnail && t.url) {
        const ytThumb = getYouTubeThumbnail(t.url);
        if (ytThumb) t.thumbnail = ytThumb;
      }
    });

    // Normalize nested subgroups
    g.subgroups.forEach((sub) => normalizeGroup(sub, g.id, g.dynamic));
    return g;
  }

  collections = rawCollections.map((g) => normalizeGroup(g, null, false));
  if (!isMigratedV2) {
    await chrome.storage.local.set({ _dynamicV2: true, [STORAGE_KEY]: collections });
  }

  // Query live reconciled tracked tabs from background service worker (guarantees in sync with real browser tabs)
  try {
    const res = await chrome.runtime.sendMessage({ type: "get-tracked-tabs" });
    const liveTracked = res?.trackedTabs || {};
    activeTrackedMap = {};
    Object.entries(liveTracked).forEach(([tabId, tracked]) => {
      if (tracked?.savedTabId) {
        activeTrackedMap[tracked.savedTabId] = Number(tabId);
      }
    });
  } catch (_) {
    activeTrackedMap = {};
  }
}

/**
 * Save collections to Chrome storage
 */
async function saveCollections() {
  isSaving = true;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: collections });
  } finally {
    setTimeout(() => {
      isSaving = false;
    }, 200);
  }
}

/**
 * Query all currently open tabs in the current browser window
 */
async function loadOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    openTabs = tabs.filter(isSavableTab);
    currentActiveTab = openTabs.find((t) => t.active) || openTabs[0] || null;
  } catch (err) {
    console.warn("Failed to load open tabs:", err);
  }
}

/**
 * Send a message to background service worker to track a tab
 */
async function trackSavedTab(tabId, groupId, savedTabId, scrollY = 0) {
  try {
    await chrome.runtime.sendMessage({
      type: "track-saved-tab",
      tabId: tabId,
      groupId: groupId,
      savedTabId: savedTabId,
      scrollY: scrollY
    });
    activeTrackedMap[savedTabId] = tabId;
  } catch (err) {
    console.warn("Could not register tracking with background:", err);
  }
}

/**
 * Untrack a tab when removed
 */

/**
 * Send a message to background service worker to track multiple tabs in one atomic batch
 */
async function trackSavedTabsBatch(items = []) {
  if (!items || items.length === 0) return;
  try {
    await chrome.runtime.sendMessage({
      type: "track-saved-tabs-batch",
      items: items
    });
    items.forEach((item) => {
      if (item.savedTabId && item.tabId) {
        activeTrackedMap[item.savedTabId] = item.tabId;
      }
    });
  } catch (err) {
    console.warn("Could not register tracking batch with background:", err);
  }
}

async function untrackSavedTab(tabId) {
  try {
    await chrome.runtime.sendMessage({
      type: "untrack-saved-tab",
      tabId: tabId
    });
  } catch (err) {
    console.warn("Could not untrack tab:", err);
  }
}

/**
 * Capture visible tab thumbnail using canvas compression with timeout protection
 */
async function captureTabThumbnail() {
  return new Promise((resolve) => {
    // Safety timeout: never let thumbnail capture hang execution
    const timeout = setTimeout(() => resolve(null), 500);

    try {
      chrome.runtime.sendMessage({ type: "capture-tab-thumbnail" }, (res) => {
        clearTimeout(timeout);
        if (!res?.ok || !res.dataUrl) {
          resolve(null);
          return;
        }

        // Compress on canvas to 200x120 JPEG
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 200;
            canvas.height = 120;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, 200, 120);
            const compressed = canvas.toDataURL("image/jpeg", 0.6);
            resolve(compressed);
          } catch {
            resolve(res.dataUrl);
          }
        };
        img.onerror = () => resolve(null);
        img.src = res.dataUrl;
      });
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

/* ==========================================================================
   Color Palette GUI Handlers
   ========================================================================== */

/**
 * Validate and normalize a hex color string
 */
function normalizeHex(hex) {
  let cleaned = hex.trim().replace(/^#/, "");
  if (cleaned.length === 3) {
    cleaned = cleaned.split("").map((c) => c + c).join("");
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`;
  }
  return null;
}

/**
 * Apply selected color to preview and inputs
 */
function setSelectedColor(color, source = "internal") {
  const norm = normalizeHex(color);
  if (!norm) return;

  selectedColor = norm;

  if (source !== "picker" && els.paletteColorPicker) {
    els.paletteColorPicker.value = norm;
  }
  if (source !== "hex" && els.hexColorInput) {
    els.hexColorInput.value = norm.replace(/^#/, "");
  }
  if (els.customColorPreview) {
    els.customColorPreview.style.backgroundColor = norm;
  }

  // Update swatches active state
  const swatches = els.colorPaletteSwatches?.querySelectorAll(".color-swatch") || [];
  swatches.forEach((s) => {
    if (s.dataset.color?.toLowerCase() === norm) {
      s.classList.add("active");
    } else {
      s.classList.remove("active");
    }
  });
}

// Preset swatch clicks
if (els.colorPaletteSwatches) {
  els.colorPaletteSwatches.addEventListener("click", (e) => {
    const swatch = e.target.closest(".color-swatch");
    if (swatch && swatch.dataset.color) {
      setSelectedColor(swatch.dataset.color, "swatch");
    }
  });
}

// Native Shade Picker (<input type="color">)
if (els.paletteColorPicker) {
  els.paletteColorPicker.addEventListener("input", (e) => {
    setSelectedColor(e.target.value, "picker");
  });
}

// Hex Code Input
if (els.hexColorInput) {
  els.hexColorInput.addEventListener("input", (e) => {
    const val = e.target.value;
    const norm = normalizeHex(val);
    if (norm) {
      setSelectedColor(norm, "hex");
    }
  });

  els.hexColorInput.addEventListener("blur", (e) => {
    const val = e.target.value;
    const norm = normalizeHex(val);
    if (norm) {
      setSelectedColor(norm, "hex");
    } else {
      // Revert to valid selected color
      e.target.value = selectedColor.replace(/^#/, "");
    }
  });
}

/* ==========================================================================
   Rendering Collections, Sub-folders, & Tabs
   ========================================================================== */

/**
 * Main render function
 */
function render() {
  renderStats();
  renderGroupSelectOptions();
  renderGroups();
}

/**
 * Render header statistics
 */
function renderStats() {
  const totalCollections = collections.length;
  const totalTabs = countAllTabs(collections);
  const activeCount = Object.keys(activeTrackedMap).length;

  if (totalCollections === 0) {
    els.statsLine.textContent = "Select a topic or group to get started";
  } else {
    els.statsLine.textContent = `${totalCollections} ${totalCollections === 1 ? "collection" : "collections"} · ${totalTabs} tabs (${activeCount} active)`;
  }

  if (els.closeTrackedTabsBtn) {
    const textSpan = els.closeTrackedTabsBtn.querySelector("span");
    if (textSpan) {
      textSpan.textContent = activeCount > 0 ? `Close Tracked (${activeCount})` : "Close Tracked";
    }
    els.closeTrackedTabsBtn.title = activeCount > 0
      ? `Save state and close ${activeCount} currently open tracked tab${activeCount !== 1 ? 's' : ''}`
      : "No tracked tabs are currently open in the browser";
    els.closeTrackedTabsBtn.style.opacity = activeCount > 0 ? "1" : "0.5";
    els.closeTrackedTabsBtn.style.pointerEvents = activeCount > 0 ? "auto" : "none";
    els.closeTrackedTabsBtn.style.cursor = activeCount > 0 ? "pointer" : "default";
  }
}

/**
 * Populate destination dropdown options in modals with hierarchical tree indentation
 */
function renderGroupSelectOptions() {
  const selects = [els.pickerTargetGroup, els.quickAddTargetGroup];
  const flatGroups = getAllGroupsFlat(collections);

  selects.forEach((select) => {
    if (!select) return;
    const prevValue = select.value;
    select.innerHTML = "";

    if (flatGroups.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No collections available";
      select.append(opt);
      return;
    }

    flatGroups.forEach(({ group, label }) => {
      const opt = document.createElement("option");
      opt.value = group.id;
      opt.textContent = label;
      select.append(opt);
    });

    if (prevValue && flatGroups.some((item) => item.group.id === prevValue)) {
      select.value = prevValue;
    }
  });
}

/**
 * Render all root collections and nested folders
 */
function renderGroups() {
  const prevScrollTop = els.groupsContainer ? els.groupsContainer.scrollTop : 0;
  els.groupsContainer.innerHTML = "";

  const query = searchQuery.trim().toLowerCase();

  // Filter groups if search is active
  function matchesSearch(group) {
    if (!query) return true;
    const nameMatch = group.name.toLowerCase().includes(query);
    const tabMatch = group.tabs?.some(
      (t) => (t.title && t.title.toLowerCase().includes(query)) || (t.url && t.url.toLowerCase().includes(query))
    );
    const subMatch = group.subgroups?.some((s) => matchesSearch(s));
    return nameMatch || tabMatch || subMatch;
  }

  const visibleGroups = collections.filter(matchesSearch);

  if (visibleGroups.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <div class="empty-state-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
          <path d="M6 6h10"></path>
          <path d="M6 10h10"></path>
        </svg>
      </div>
      <div class="empty-state-title">${collections.length === 0 ? "No collections yet" : "No matching results"}</div>
      <div class="empty-state-desc">${
        collections.length === 0
          ? "Enter a collection name above or click 'Add Active Tab' to get started."
          : "Try searching with a different keyword."
      }</div>
    `;
    els.groupsContainer.append(emptyState);
    return;
  }

  visibleGroups.forEach((group) => {
    const node = createGroupElement(group, 0, null);
    els.groupsContainer.append(node);
  });
}

/**
 * Create a DOM card for a group or nested sub-folder
 */
function createGroupElement(group, depth = 0, parentGroup = null) {
  const node = els.groupTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.groupId = group.id;

  const isSubfolder = depth > 0;
  if (isSubfolder) {
    node.classList.add("subfolder-card");
    node.style.marginLeft = `${depth * 10}px`;
  }

  // 0. Dropdown Collapse / Expand State
  const isExpanded = expandedGroupIds.has(group.id) || (searchQuery.trim().length > 0);
  if (!isExpanded) {
    node.classList.add("is-collapsed");
  } else {
    node.classList.remove("is-collapsed");
  }

  // 1. Prominent Left Color Code Region Fill (Directly scoped to this group header)
  const groupHeader = node.querySelector(":scope > .group-header");
  const colorBlock = groupHeader?.querySelector(".group-header-color-block");
  const folderIcon = groupHeader?.querySelector(".group-folder-icon");
  const groupColor = group.color || parentGroup?.color || DEFAULT_COLORS[0];

  if (colorBlock) {
    colorBlock.style.backgroundColor = groupColor;
  }

  if (isSubfolder) {
    folderIcon?.classList.remove("hidden");
  } else {
    folderIcon?.classList.add("hidden");
  }

  // Header Click Handler for Dropdown Expand / Collapse
  groupHeader?.addEventListener("click", (e) => {
    if (e.target.closest("button, input, .group-drag-handle")) {
      return;
    }

    if (expandedGroupIds.has(group.id)) {
      expandedGroupIds.delete(group.id);
    } else {
      expandedGroupIds.add(group.id);
    }
    renderGroups();
  });

  // 2. Group Thumbnail / Cover Button
  const thumbBtn = groupHeader?.querySelector(".group-thumb-btn");
  const thumbImg = groupHeader?.querySelector(".group-thumb-img");
  const thumbPlaceholder = groupHeader?.querySelector(".group-thumb-placeholder");

  const coverUrl = group.thumbnail || (group.tabs?.find((t) => t.thumbnail)?.thumbnail) || null;

  if (coverUrl && thumbImg && thumbPlaceholder) {
    thumbImg.src = coverUrl;
    thumbImg.classList.remove("hidden");
    thumbPlaceholder.classList.add("hidden");
  } else if (thumbImg && thumbPlaceholder) {
    thumbImg.classList.add("hidden");
    thumbPlaceholder.classList.remove("hidden");
  }

  thumbBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openThumbnailModal(group.id);
  });

  // 3. Title Input (inline rename)
  const titleInput = groupHeader?.querySelector(".group-title-input");
  if (titleInput) {
    titleInput.value = group.name;
    titleInput.addEventListener("change", async () => {
      const newName = titleInput.value.trim();
      if (newName) {
        group.name = newName;
        group.updatedAt = Date.now();
        await saveCollections();
        renderStats();
        renderGroupSelectOptions();
      } else {
        titleInput.value = group.name;
      }
    });
  }

  // 4. Tab Count Pill
  const countPill = groupHeader?.querySelector(".group-tab-count");
  const totalTabs = (group.tabs?.length || 0);
  if (countPill) {
    countPill.textContent = `${totalTabs} ${totalTabs === 1 ? "tab" : "tabs"}`;
  }

  // 5. Dynamic Folder Toggle Badge
  const dynamicToggleBtn = groupHeader?.querySelector(".group-dynamic-toggle-btn");
  const isGroupDynamic = Boolean(group.dynamic);

  if (dynamicToggleBtn) {
    if (isGroupDynamic) {
      dynamicToggleBtn.classList.add("is-active");
      dynamicToggleBtn.title = isSubfolder
        ? "Dynamic tracking is ON for this sub-folder. Click to make static bookmark."
        : "Dynamic tracking is ON for this collection. All content syncs live. Click to turn off.";
    } else {
      dynamicToggleBtn.classList.remove("is-active");
      dynamicToggleBtn.title = isSubfolder
        ? "Dynamic tracking is OFF for this sub-folder. Click to make all content dynamic."
        : "Dynamic tracking is OFF for this collection. Click to make all content dynamic.";
    }

    dynamicToggleBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const nextState = !isGroupDynamic;
      setDynamicRecursively(group, nextState);
      if (!nextState) {
        updateAncestorsDynamicStateOnDisable(group.id);
      }
      await saveCollections();
      render();
    });
  }

  // 6. Header Actions
  const addSubgroupBtn = groupHeader?.querySelector(".group-add-subgroup-btn");
  addSubgroupBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openSubfolderModal(group.id, group.name);
  });

  const addTabBtn = groupHeader?.querySelector(".group-add-tab-btn");
  addTabBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openPickerModal(group.id);
  });

  const restoreBtn = groupHeader?.querySelector(".group-restore-btn");
  restoreBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    restoreAllTabs(group);
  });

  const deleteBtn = groupHeader?.querySelector(".group-delete-btn");
  deleteBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const typeLabel = isSubfolder ? "sub-folder" : "collection";
    if (confirm(`Delete ${typeLabel} "${group.name}" and all its saved tabs?`)) {
      await deleteGroupRecursively(group.id);
    }
  });

  // 7. Drag & Drop Reordering for Groups
  setupGroupDragAndDrop(node, group, parentGroup);

  // Drop Tab directly onto group card or header
  [node, groupHeader].forEach((targetEl) => {
    if (!targetEl) return;
    targetEl.addEventListener("dragover", (e) => {
      if (!draggedTabId || draggedTabSourceGroupId === group.id) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      node.classList.add("drop-tab-target");
    });

    targetEl.addEventListener("dragleave", (e) => {
      if (!node.contains(e.relatedTarget)) {
        node.classList.remove("drop-tab-target");
      }
    });

    targetEl.addEventListener("drop", async (e) => {
      if (!draggedTabId || draggedTabSourceGroupId === group.id) return;
      e.preventDefault();
      e.stopPropagation();
      node.classList.remove("drop-tab-target");

      const sourceId = draggedTabSourceGroupId;
      const tabIdToMove = draggedTabId;
      draggedTabId = null;
      draggedTabSourceGroupId = null;

      await moveTabToGroup(sourceId, group.id, tabIdToMove);
    });
  });


  // 8. Render Sub-folders Container (Scoped directly to this node's direct child)
  const subgroupsContainer = node.querySelector(":scope > .group-subgroups-container");
  if (subgroupsContainer && Array.isArray(group.subgroups) && group.subgroups.length > 0) {
    group.subgroups.forEach((sub) => {
      const subNode = createGroupElement(sub, depth + 1, group);
      subgroupsContainer.append(subNode);
    });
  }

  // 9. Render Saved Tabs (CRITICAL: Scoped to direct child :scope > .group-tabs-list)
  const tabsList = node.querySelector(":scope > .group-tabs-list");
  if (tabsList) {
    setupTabsListDropTarget(tabsList, group);

    // Scroll Chaining: scroll outer groups-container when inner list reaches boundaries
    tabsList.addEventListener("wheel", (e) => {
      const atBottom = e.deltaY > 0 && Math.ceil(tabsList.scrollTop + tabsList.clientHeight) >= (tabsList.scrollHeight - 1);
      const atTop = e.deltaY < 0 && tabsList.scrollTop <= 0;
      if (atBottom || atTop) {
        els.groupsContainer.scrollTop += e.deltaY;
      }
    }, { passive: true });

    if (!group.tabs || group.tabs.length === 0) {
      const emptyNote = document.createElement("div");
      emptyNote.className = "group-tabs-empty";
      emptyNote.textContent = isSubfolder
        ? "Subgroup is empty. Drag tabs here or click '+' to add."
        : "No tabs saved yet. Click '+' to add tabs.";
      tabsList.append(emptyNote);
    } else {
      group.tabs.forEach((savedTab) => {
        const query = searchQuery.trim().toLowerCase();
        if (query) {
          const matchTitle = savedTab.title && savedTab.title.toLowerCase().includes(query);
          const matchUrl = savedTab.url && savedTab.url.toLowerCase().includes(query);
          if (!matchTitle && !matchUrl) return;
        }

        const tabNode = renderSavedTabItem(group, savedTab);
        tabsList.append(tabNode);
      });
    }
  }

  return node;
}

/**
 * Render individual tab card with Microsoft Collections aesthetic & thumbnail
 */
function renderSavedTabItem(group, savedTab) {
  const node = els.savedTabTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.savedTabId = savedTab.id;
  node.dataset.groupId = group.id;

  // 1. Thumbnail
  const thumbImg = node.querySelector(".saved-tab-thumb-img");
  const thumbFallback = node.querySelector(".saved-tab-thumb-fallback");
  const faviconEl = node.querySelector(".tab-favicon");

  // Determine thumbnail
  const thumbUrl = savedTab.thumbnail || getYouTubeThumbnail(savedTab.url);

  if (thumbUrl) {
    thumbImg.src = thumbUrl;
    thumbImg.classList.remove("hidden");
    thumbFallback.classList.add("hidden");

    thumbImg.onerror = () => {
      thumbImg.classList.add("hidden");
      thumbFallback.classList.remove("hidden");
    };
  } else {
    thumbImg.classList.add("hidden");
    thumbFallback.classList.remove("hidden");
  }

  // Favicon fallback
  if (savedTab.favIconUrl) {
    faviconEl.style.backgroundImage = `url("${savedTab.favIconUrl}")`;
    faviconEl.textContent = "";
  } else {
    faviconEl.style.backgroundImage = "";
    faviconEl.textContent = (savedTab.title || "T").charAt(0).toUpperCase();
  }

  // 2. Title & Domain
  const titleEl = node.querySelector(".saved-tab-title");
  titleEl.textContent = savedTab.title || savedTab.url;
  titleEl.title = `${savedTab.title || ""}\n${savedTab.lastUrl || savedTab.url}`;

  const domainEl = node.querySelector(".saved-tab-domain");
  domainEl.textContent = displayDomain(savedTab.lastUrl || savedTab.url);

  // 3. YouTube Progress Badge
  const ytBadge = node.querySelector(".youtube-badge");
  if (savedTab.youtubeSeconds && savedTab.youtubeSeconds > 0) {
    ytBadge.classList.remove("hidden");
    ytBadge.innerHTML = `
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      <span>${formatVideoTime(savedTab.youtubeSeconds)}</span>
    `;
  } else {
    ytBadge.classList.add("hidden");
  }

  // 4. Active Status Indicator
  const statusPill = node.querySelector(".saved-tab-status-pill");
  const isOpenInBrowser = Boolean(activeTrackedMap[savedTab.id]);

  if (isOpenInBrowser) {
    statusPill.innerHTML = `<span class="status-active-dot"></span><span>Active</span>`;
    statusPill.title = "This tab is currently open in Chrome.";
  } else {
    statusPill.textContent = formatTimeAgo(savedTab.updatedAt || savedTab.createdAt);
  }

  // 5. Dynamic Toggle Badge for this specific tab
  const dynamicBtn = node.querySelector(".btn-tab-dynamic");
  const isTabDynamic = Boolean(savedTab.dynamic);

  if (isTabDynamic) {
    dynamicBtn.classList.add("is-active");
    dynamicBtn.title = "Dynamic tracking is ON for this tab. Updates in Chrome sync automatically. Click to track normally (static bookmark).";
  } else {
    dynamicBtn.classList.remove("is-active");
    dynamicBtn.title = "Static bookmark mode (updates OFF). Click to enable dynamic tracking.";
  }

  dynamicBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const nextTabDynamic = !isTabDynamic;
    savedTab.dynamic = nextTabDynamic;
    savedTab.updatedAt = Date.now();
    group.updatedAt = Date.now();

    if (!nextTabDynamic) {
      // Tab manually set to non-dynamic: turn off dynamic button on this group & all ancestor groups
      updateAncestorsDynamicStateOnDisable(group.id);
    }
    await saveCollections();
    render();
  });

  // Move Tab button click -> Opens dedicated Move Tab modal
  const moveBtn = node.querySelector(".move-tab-btn");
  if (moveBtn) {
    moveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMoveModal(group, savedTab);
    });
  }

  // Right-click Context Menu on tab card
  node.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showTabContextMenu(e, group, savedTab);
  });

  // 6. Click card to open or focus tab
  node.addEventListener("click", (e) => {
    if (e.target.closest(".saved-tab-actions") || e.target.closest(".tab-drag-handle")) return;
    openOrFocusSavedTab(group, savedTab);
  });

  // 7. Actions: Open & Delete
  const openBtn = node.querySelector(".open-tab-btn");
  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openOrFocusSavedTab(group, savedTab);
  });

  const deleteBtn = node.querySelector(".delete-tab-btn");
  deleteBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    group.tabs = group.tabs.filter((t) => t.id !== savedTab.id);
    group.updatedAt = Date.now();

    const openTabId = activeTrackedMap[savedTab.id];
    if (openTabId) {
      await untrackSavedTab(openTabId);
      delete activeTrackedMap[savedTab.id];
    }

    await saveCollections();
    render();
  });

  // 8. Tab Drag & Drop setup
  setupTabDragAndDrop(node, savedTab, group);

  return node;
}

/* ==========================================================================
   Drag and Drop Reordering
   ========================================================================== */

/**
 * Smooth velocity-based auto-scroll during drag.
 * Scrolls faster the closer the cursor is to the edge.
 */
function startAutoScroll(container) {
  if (autoScrollContainer === container && autoScrollRaf) return; // already running for this container
  stopAutoScroll();
  autoScrollContainer = container;

  function step() {
    if (!autoScrollContainer) return;
    const rect = autoScrollContainer.getBoundingClientRect();
    const EDGE_ZONE = 60;  // px from top/bottom edge that triggers scroll
    const MAX_SPEED = 18;  // max px per frame

    let speed = 0;
    const distFromTop = _dragClientY - rect.top;
    const distFromBottom = rect.bottom - _dragClientY;

    if (distFromTop < EDGE_ZONE && distFromTop > 0) {
      // Closer to top = faster negative scroll
      const ratio = 1 - (distFromTop / EDGE_ZONE);
      speed = -(ratio * ratio * MAX_SPEED);
    } else if (distFromBottom < EDGE_ZONE && distFromBottom > 0) {
      // Closer to bottom = faster positive scroll
      const ratio = 1 - (distFromBottom / EDGE_ZONE);
      speed = ratio * ratio * MAX_SPEED;
    }

    if (speed !== 0) {
      autoScrollContainer.scrollTop += speed;
    }

    autoScrollRaf = requestAnimationFrame(step);
  }

  autoScrollRaf = requestAnimationFrame(step);
}

function stopAutoScroll() {
  if (autoScrollRaf) {
    cancelAnimationFrame(autoScrollRaf);
    autoScrollRaf = null;
  }
  autoScrollContainer = null;
}

/**
 * Update the cursor Y position used by auto-scroll during drag
 */
let _dragClientY = 0;
document.addEventListener("dragover", (e) => { _dragClientY = e.clientY; }, { passive: true });

/**
 * Setup group & sub-folder drag-and-drop
 */
function setupGroupDragAndDrop(node, group, parentGroup) {
  const dragHandle = node.querySelector(".group-drag-handle");
  if (!dragHandle) return;

  dragHandle.addEventListener("mousedown", () => {
    node.setAttribute("draggable", "true");
  });

  dragHandle.addEventListener("mouseup", () => {
    node.setAttribute("draggable", "false");
  });

  node.addEventListener("dragstart", (e) => {
    draggedGroupId = group.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", group.id);
    node.classList.add("is-dragging");
    // Begin auto-scroll on the groups container
    startAutoScroll(els.groupsContainer, e.clientY);
  });

  node.addEventListener("dragend", () => {
    draggedGroupId = null;
    node.setAttribute("draggable", "false");
    node.classList.remove("is-dragging");
    stopAutoScroll();
    document.querySelectorAll(".drop-target-above, .drop-target-below").forEach((el) => {
      el.classList.remove("drop-target-above", "drop-target-below");
    });
  });

  node.addEventListener("dragover", (e) => {
    if (!draggedGroupId || draggedGroupId === group.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Update scroll speed based on current cursor position
    startAutoScroll(els.groupsContainer, e.clientY);

    const rect = node.getBoundingClientRect();
    const isAbove = (e.clientY - rect.top) < (rect.height / 2);

    node.classList.toggle("drop-target-above", isAbove);
    node.classList.toggle("drop-target-below", !isAbove);
  });

  node.addEventListener("dragleave", () => {
    node.classList.remove("drop-target-above", "drop-target-below");
  });

  node.addEventListener("drop", async (e) => {
    if (!draggedGroupId || draggedGroupId === group.id) return;
    e.preventDefault();
    e.stopPropagation();
    stopAutoScroll();

    const rect = node.getBoundingClientRect();
    const dropAbove = (e.clientY - rect.top) < (rect.height / 2);

    node.classList.remove("drop-target-above", "drop-target-below");

    // Locate source and target lists
    const source = findGroupContainer(collections, draggedGroupId);
    const target = findGroupContainer(collections, group.id);

    if (source && target) {
      // Remember scroll position so we can restore it after re-render
      const scrollTop = els.groupsContainer.scrollTop;

      const [movedGroup] = source.parentList.splice(source.index, 1);
      movedGroup.parentId = target.parentGroup?.id || null;

      const newIndex = target.parentList.findIndex((g) => g.id === group.id);
      const insertAt = dropAbove ? newIndex : newIndex + 1;
      target.parentList.splice(insertAt, 0, movedGroup);

      await saveCollections();
      render();
      // Restore scroll position — don't jump to top/bottom after drop
      els.groupsContainer.scrollTop = scrollTop;
    }
  });
}

/**
 * Setup tab drag-and-drop
 */
function setupTabDragAndDrop(node, savedTab, group) {
  node.addEventListener("dragstart", (e) => {
    draggedTabId = savedTab.id;
    draggedTabSourceGroupId = group.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/tab-id", savedTab.id);
    node.classList.add("is-dragging");
    startAutoScroll(els.groupsContainer, e.clientY);
  });

  node.addEventListener("dragend", () => {
    draggedTabId = null;
    draggedTabSourceGroupId = null;
    node.classList.remove("is-dragging");
    stopAutoScroll();
    document.querySelectorAll(".drop-target-above, .drop-target-below").forEach((el) => {
      el.classList.remove("drop-target-above", "drop-target-below");
    });
  });

  node.addEventListener("dragover", (e) => {
    if (!draggedTabId || draggedTabId === savedTab.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    startAutoScroll(els.groupsContainer, e.clientY);

    const rect = node.getBoundingClientRect();
    const isAbove = (e.clientY - rect.top) < (rect.height / 2);
    node.classList.toggle("drop-target-above", isAbove);
    node.classList.toggle("drop-target-below", !isAbove);
  });

  node.addEventListener("dragleave", () => {
    node.classList.remove("drop-target-above", "drop-target-below");
  });

  node.addEventListener("drop", async (e) => {
    if (!draggedTabId || draggedTabId === savedTab.id) return;
    e.preventDefault();
    e.stopPropagation();
    stopAutoScroll();

    const rect = node.getBoundingClientRect();
    const dropAbove = (e.clientY - rect.top) < (rect.height / 2);
    node.classList.remove("drop-target-above", "drop-target-below");

    const sourceGroup = findGroupById(collections, draggedTabSourceGroupId);
    if (!sourceGroup) return;

    const sourceIndex = sourceGroup.tabs.findIndex((t) => t.id === draggedTabId);
    if (sourceIndex === -1) return;

    // Remember scroll position so we don't jump after re-render
    const scrollTop = els.groupsContainer.scrollTop;

    const [movedTab] = sourceGroup.tabs.splice(sourceIndex, 1);
    const targetIndex = group.tabs.findIndex((t) => t.id === savedTab.id);
    const insertAt = dropAbove ? targetIndex : targetIndex + 1;
    group.tabs.splice(insertAt, 0, movedTab);

    // Update tracking mapping in background if group changed
    const openTabId = activeTrackedMap[movedTab.id];
    if (openTabId) {
      await trackSavedTab(openTabId, group.id, movedTab.id);
    }

    group.updatedAt = Date.now();
    sourceGroup.updatedAt = Date.now();
    await saveCollections();
    render();
    // Restore scroll — don't teleport to top/bottom after drop
    els.groupsContainer.scrollTop = scrollTop;
  });
}

/**
 * Setup empty tabs list as drop target
 */
function setupTabsListDropTarget(tabsList, group) {
  tabsList.addEventListener("dragover", (e) => {
    if (!draggedTabId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  tabsList.addEventListener("drop", async (e) => {
    if (!draggedTabId) return;
    e.preventDefault();
    e.stopPropagation();

    // If dropping into empty container or at bottom
    const sourceGroup = findGroupById(collections, draggedTabSourceGroupId);
    if (!sourceGroup) return;

    const sourceIndex = sourceGroup.tabs.findIndex((t) => t.id === draggedTabId);
    if (sourceIndex === -1) return;

    const [movedTab] = sourceGroup.tabs.splice(sourceIndex, 1);
    group.tabs.push(movedTab);

    const openTabId = activeTrackedMap[movedTab.id];
    if (openTabId) {
      await trackSavedTab(openTabId, group.id, movedTab.id);
    }

    group.updatedAt = Date.now();
    sourceGroup.updatedAt = Date.now();
    await saveCollections();
    render();
  });
}


/* ==========================================================================
   Tab Context Menu & Move Tab Helpers
   ========================================================================== */

let currentContextMenuTab = null;
let currentContextMenuGroup = null;

function showTabContextMenu(e, group, savedTab) {
  if (!els.tabContextMenu) return;
  currentContextMenuTab = savedTab;
  currentContextMenuGroup = group;

  const headerFavicon = els.tabContextMenu.querySelector(".context-menu-favicon");
  const headerTitle = els.tabContextMenu.querySelector(".context-menu-title");
  const groupsList = els.tabContextMenu.querySelector(".context-menu-groups-list");

  if (headerFavicon) {
    if (savedTab.favIconUrl) {
      headerFavicon.style.backgroundImage = `url("${savedTab.favIconUrl}")`;
      headerFavicon.textContent = "";
    } else {
      headerFavicon.style.backgroundImage = "";
      headerFavicon.textContent = (savedTab.title || "T").charAt(0).toUpperCase();
    }
  }

  if (headerTitle) {
    headerTitle.textContent = savedTab.title || savedTab.url;
    headerTitle.title = savedTab.title || savedTab.url;
  }

  if (els.contextToggleDynamicLabel) {
    els.contextToggleDynamicLabel.textContent = savedTab.dynamic ? "Make Tab Static" : "Make Tab Dynamic";
  }

  if (groupsList) {
    groupsList.innerHTML = "";
    const allGroups = getAllGroupsFlat(collections);

    if (allGroups.length === 0) {
      groupsList.innerHTML = `<div style="padding: 8px 14px; color: var(--text-muted); font-size: 11.5px;">No folders available.</div>`;
    } else {
      allGroups.forEach(({ group: destGroup, depth, label }) => {
        const btn = document.createElement("button");
        btn.className = "context-menu-dest-item";
        btn.type = "button";

        const isCurrent = (destGroup.id === group.id);
        if (isCurrent) {
          btn.disabled = true;
        }

        const indentPx = Math.min(depth * 14, 42);
        btn.style.paddingLeft = `${14 + indentPx}px`;

        const colorDot = document.createElement("span");
        colorDot.className = "context-dest-color-dot";
        colorDot.style.backgroundColor = destGroup.color || DEFAULT_COLORS[0];

        const nameSpan = document.createElement("span");
        nameSpan.className = "context-dest-name";
        nameSpan.textContent = destGroup.name;

        btn.append(colorDot, nameSpan);

        if (isCurrent) {
          const currentBadge = document.createElement("span");
          currentBadge.className = "context-dest-current";
          currentBadge.textContent = "(Current)";
          btn.append(currentBadge);
        } else {
          const countBadge = document.createElement("span");
          countBadge.className = "context-dest-badge";
          countBadge.textContent = `${destGroup.tabs?.length || 0} tabs`;
          btn.append(countBadge);

          btn.addEventListener("click", async () => {
            hideTabContextMenu();
            await moveTabToGroup(group.id, destGroup.id, savedTab.id);
          });
        }

        groupsList.append(btn);
      });
    }
  }

  els.tabContextMenu.classList.remove("hidden");
  const menuWidth = els.tabContextMenu.offsetWidth || 260;
  const menuHeight = els.tabContextMenu.offsetHeight || 280;
  const winWidth = window.innerWidth;
  const winHeight = window.innerHeight;

  let left = e.clientX;
  let top = e.clientY;

  if (left + menuWidth > winWidth - 10) {
    left = Math.max(10, winWidth - menuWidth - 10);
  }
  if (top + menuHeight > winHeight - 10) {
    top = Math.max(10, winHeight - menuHeight - 10);
  }

  els.tabContextMenu.style.left = `${left}px`;
  els.tabContextMenu.style.top = `${top}px`;
}

function hideTabContextMenu() {
  if (els.tabContextMenu) {
    els.tabContextMenu.classList.add("hidden");
  }
  currentContextMenuTab = null;
  currentContextMenuGroup = null;
}

/**
 * Move a tab from one group/subgroup to another group/subgroup
 */

/* ==========================================================================
   Toast Notification & Move Tab Modal
   ========================================================================== */

let _toastTimer = null;
function showToast(message) {
  const toast = els.toastNotification || document.getElementById("toastNotification");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 220);
  }, 2400);
}

function openMoveModal(sourceGroup, savedTab) {
  if (!els.moveModal) return;
  currentContextMenuTab = savedTab;
  currentContextMenuGroup = sourceGroup;

  if (els.moveTabTitle) {
    els.moveTabTitle.textContent = savedTab.title || savedTab.url;
  }
  if (els.moveTabUrl) {
    els.moveTabUrl.textContent = displayDomain(savedTab.lastUrl || savedTab.url);
  }

  if (els.moveTabFavicon) {
    if (savedTab.favIconUrl) {
      els.moveTabFavicon.style.backgroundImage = `url("${savedTab.favIconUrl}")`;
      els.moveTabFavicon.textContent = "";
    } else {
      els.moveTabFavicon.style.backgroundImage = "";
      els.moveTabFavicon.textContent = (savedTab.title || "T").charAt(0).toUpperCase();
    }
  }

  if (els.moveModalGroupsList) {
    els.moveModalGroupsList.innerHTML = "";
    const allGroups = getAllGroupsFlat(collections);

    if (allGroups.length === 0) {
      els.moveModalGroupsList.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 12px; text-align: center;">No folders found.</div>`;
    } else {
      allGroups.forEach(({ group: destGroup, depth }) => {
        const btn = document.createElement("button");
        btn.className = "move-dest-btn";
        btn.type = "button";

        const isCurrent = (destGroup.id === sourceGroup.id);
        if (isCurrent) {
          btn.disabled = true;
        }

        const indentPx = Math.min(depth * 14, 42);
        btn.style.paddingLeft = `${12 + indentPx}px`;

        const left = document.createElement("div");
        left.className = "move-dest-left";

        const dot = document.createElement("span");
        dot.className = "move-dest-dot";
        dot.style.backgroundColor = destGroup.color || DEFAULT_COLORS[0];

        const name = document.createElement("span");
        name.className = "move-dest-name";
        name.textContent = destGroup.name;

        left.append(dot, name);
        btn.append(left);

        if (isCurrent) {
          const badge = document.createElement("span");
          badge.className = "move-dest-current-badge";
          badge.textContent = "Current Folder";
          btn.append(badge);
        } else {
          const badge = document.createElement("span");
          badge.className = "move-dest-badge";
          badge.textContent = `${destGroup.tabs?.length || 0} tabs`;
          btn.append(badge);

          btn.addEventListener("click", async () => {
            closeMoveModal();
            await moveTabToGroup(sourceGroup.id, destGroup.id, savedTab.id);
          });
        }

        els.moveModalGroupsList.append(btn);
      });
    }
  }

  els.moveModal.classList.remove("hidden");
}

function closeMoveModal() {
  if (els.moveModal) {
    els.moveModal.classList.add("hidden");
  }
}

async function moveTabToGroup(sourceGroupId, targetGroupId, savedTabId) {
  if (!sourceGroupId || !targetGroupId || sourceGroupId === targetGroupId) return;

  const sourceGroup = findGroupById(collections, sourceGroupId);
  const targetGroup = findGroupById(collections, targetGroupId);
  if (!sourceGroup || !targetGroup) return;

  if (!Array.isArray(targetGroup.tabs)) {
    targetGroup.tabs = [];
  }

  const sourceIndex = sourceGroup.tabs.findIndex((t) => t.id === savedTabId);
  if (sourceIndex === -1) return;

  const [movedTab] = sourceGroup.tabs.splice(sourceIndex, 1);
  targetGroup.tabs.unshift(movedTab);

  const openTabId = activeTrackedMap[movedTab.id];
  if (openTabId) {
    await trackSavedTab(openTabId, targetGroup.id, movedTab.id);
  }

  targetGroup.updatedAt = Date.now();
  sourceGroup.updatedAt = Date.now();

  // Expand destination group and ALL its ancestor groups so moved tab is visible
  let curr = targetGroup;
  while (curr) {
    expandedGroupIds.add(curr.id);
    curr = curr.parentId ? findGroupById(collections, curr.parentId) : null;
  }

  await saveCollections();
  render();

  // Scroll to moved tab & flash highlight
  setTimeout(() => {
    const tabEl = document.querySelector(`[data-saved-tab-id="${savedTabId}"]`);
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      tabEl.classList.add("just-moved");
      setTimeout(() => tabEl.classList.remove("just-moved"), 2000);
    }
  }, 60);

  showToast(`✓ Moved "${movedTab.title || 'Tab'}" to "${targetGroup.name}"`);
}

/**
 * Directly add the current active browser tab to a designated group/subgroup
 */
async function addActiveTabDirectlyToGroup(targetGroupId) {
  if (!currentActiveTab) {
    await loadOpenTabs();
  }
  if (!currentActiveTab) return;

  const targetGroup = findGroupById(collections, targetGroupId);
  if (!targetGroup) {
    alert("Please select or create a collection first.");
    return;
  }

  if (!Array.isArray(targetGroup.tabs)) {
    targetGroup.tabs = [];
  }

  const normActiveUrl = normalizeUrl(currentActiveTab.url);
  const isDuplicate = targetGroup.tabs.some(
    (t) => normalizeUrl(t.url || t.lastUrl) === normActiveUrl
  );

  if (isDuplicate) {
    expandedGroupIds.add(targetGroup.id);
    render();
    return;
  }

  const ytThumb = getYouTubeThumbnail(currentActiveTab.url);
  const savedTab = {
    id: uid(),
    title: currentActiveTab.title || currentActiveTab.url,
    url: currentActiveTab.url,
    lastUrl: currentActiveTab.url,
    favIconUrl: currentActiveTab.favIconUrl || "",
    thumbnail: ytThumb || null,
    dynamic: Boolean(targetGroup.dynamic),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  targetGroup.tabs.unshift(savedTab);
  targetGroup.updatedAt = Date.now();
  expandedGroupIds.add(targetGroup.id);

  await saveCollections();
  render();

  trackSavedTab(currentActiveTab.id, targetGroup.id, savedTab.id);
}

/* ==========================================================================
   Tab Opening & Restoration
   ========================================================================== */

/**
 * Open a saved tab or switch to it if already open
 */
async function openOrFocusSavedTab(group, savedTab) {
  const existingTabId = activeTrackedMap[savedTab.id];

  if (existingTabId) {
    try {
      const tab = await chrome.tabs.get(existingTabId);
      if (tab) {
        await chrome.tabs.update(existingTabId, { active: true });
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        window.close();
        return;
      }
    } catch {
      // Tab was closed, open afresh
    }
  }

  const targetUrl = savedTab.lastUrl || savedTab.url;
  const newTab = await chrome.tabs.create({ url: targetUrl, active: true });

  // Pass scroll position to background so content script can restore it
  await trackSavedTab(newTab.id, group.id, savedTab.id, savedTab.scrollY || 0);
  window.close();
}


/**
 * Close all browser tabs that are currently being tracked by the extension.
 * Saves their current state first, then closes them to unclutter the browser.
 */
async function closeAllTrackedTabs() {
  // Query all actual open browser tabs across all windows
  let openBrowserTabs = [];
  try {
    openBrowserTabs = await chrome.tabs.query({});
  } catch (_) {}

  const openTabIdsSet = new Set(openBrowserTabs.map((t) => t.id));

  // Validate activeTrackedMap: only keep tab IDs that actually exist in the browser
  const validTabIdsToClose = [];
  for (const [savedTabId, tabId] of Object.entries(activeTrackedMap)) {
    if (tabId && openTabIdsSet.has(tabId)) {
      validTabIdsToClose.push(tabId);
    } else {
      delete activeTrackedMap[savedTabId];
    }
  }

  if (validTabIdsToClose.length === 0) {
    showToast("No tracked tabs are currently open in the browser.");
    renderStats();
    return;
  }

  const count = validTabIdsToClose.length;
  const confirmed = confirm(
    `Close ${count} tracked tab${count !== 1 ? "s" : ""}?

Your scroll positions and progress are saved. You can reopen them anytime from your collections.`
  );
  if (!confirmed) return;

  // Flush background memory state to disk first
  try {
    await chrome.runtime.sendMessage({ type: "flush-store" });
  } catch (_) {}

  // Atomic close: Chrome closes all specified tabs simultaneously in one smooth call!
  try {
    await chrome.tabs.remove(validTabIdsToClose);
  } catch (err) {
    console.warn("Could not remove some tabs:", err);
  }

  // Clear trackedTabs in background
  try {
    await chrome.runtime.sendMessage({ type: "clear-all-tracked-tabs" });
  } catch (_) {}

  activeTrackedMap = {};
  showToast(`✓ Closed ${count} tracked tab${count !== 1 ? "s" : ""}`);
  await loadOpenTabs();
  render();
}

/**
 * Restore all tabs in a group and all its sub-folders without creating duplicates
 */
async function restoreAllTabs(group) {
  const tabs = getAllTabsInGroup(group);
  if (tabs.length === 0) return;

  const trackingBatch = [];

  for (const savedTab of tabs) {
    const existingTabId = activeTrackedMap[savedTab.id];
    if (existingTabId) {
      try {
        const openTab = await chrome.tabs.get(existingTabId);
        if (openTab) {
          // Tab is already open in browser, do not create a duplicate
          continue;
        }
      } catch {
        delete activeTrackedMap[savedTab.id];
      }
    }
    const targetUrl = savedTab.lastUrl || savedTab.url;
    const newTab = await chrome.tabs.create({ url: targetUrl, active: false });
    trackingBatch.push({
      tabId: newTab.id,
      groupId: group.id,
      savedTabId: savedTab.id,
      scrollY: savedTab.scrollY || 0
    });
  }

  if (trackingBatch.length > 0) {
    await trackSavedTabsBatch(trackingBatch);
  }

  render();
}

/* ==========================================================================
   Creating & Managing Collections and Sub-folders
   ========================================================================== */

/**
 * Create a new root collection
 */
async function createCollection() {
  const name = els.subjectInput.value.trim();
  if (!name) return;

  const newGroup = {
    id: uid(),
    name: name,
    color: selectedColor || DEFAULT_COLORS[0],
    parentId: null,
    dynamic: false,
    thumbnail: null,
    tabs: [],
    subgroups: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  collections.unshift(newGroup);
  expandedGroupIds.add(newGroup.id);
  els.subjectInput.value = "";
  await saveCollections();
  render();
}

/**
 * Open Sub-folder Modal
 */
function openSubfolderModal(parentId, parentName) {
  targetSubfolderParentId = parentId;
  els.subfolderParentLabel.textContent = `Inside: ${parentName}`;
  els.subfolderNameInput.value = "";
  els.subfolderModal.classList.remove("hidden");
  setTimeout(() => els.subfolderNameInput.focus(), 50);
}

/**
 * Close Sub-folder Modal
 */
function closeSubfolderModal() {
  els.subfolderModal.classList.add("hidden");
  targetSubfolderParentId = null;
}

/**
 * Confirm creating a sub-folder
 */
async function confirmCreateSubfolder() {
  const name = els.subfolderNameInput.value.trim();
  if (!name || !targetSubfolderParentId) return;

  const parent = findGroupById(collections, targetSubfolderParentId);
  if (!parent) return;

  if (!Array.isArray(parent.subgroups)) {
    parent.subgroups = [];
  }

  const newSubfolder = {
    id: uid(),
    name: name,
    parentId: parent.id,
    dynamic: Boolean(parent.dynamic),
    thumbnail: null,
    tabs: [],
    subgroups: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  parent.subgroups.push(newSubfolder);
  parent.updatedAt = Date.now();

  expandedGroupIds.add(parent.id);
  expandedGroupIds.add(newSubfolder.id);

  await saveCollections();
  closeSubfolderModal();
  render();
}

/**
 * Delete a group or sub-folder recursively
 */
async function deleteGroupRecursively(groupId) {
  const container = findGroupContainer(collections, groupId);
  if (!container) return;

  const group = container.parentList[container.index];

  // Untrack tabs
  const allTabs = getAllTabsInGroup(group);
  for (const t of allTabs) {
    const openTabId = activeTrackedMap[t.id];
    if (openTabId) {
      await untrackSavedTab(openTabId);
      delete activeTrackedMap[t.id];
    }
  }

  container.parentList.splice(container.index, 1);
  await saveCollections();
  render();
}

/* ==========================================================================
   Group Thumbnail Selector Modal Logic
   ========================================================================== */

/**
 * Open Group Thumbnail Selector Modal
 */
function openThumbnailModal(groupId) {
  targetThumbnailGroupId = groupId;
  const group = findGroupById(collections, groupId);
  if (!group) return;

  els.thumbnailModalSubtitle.textContent = `Cover for: ${group.name}`;
  els.customThumbUrlInput.value = "";
  els.thumbTabsGrid.innerHTML = "";

  const memberTabs = getAllTabsInGroup(group);

  if (memberTabs.length === 0) {
    els.thumbTabsGrid.innerHTML = `<div class="empty-state-desc" style="padding: 10px; grid-column: 1 / -1;">No tabs in this group yet. Add tabs or enter a custom image below.</div>`;
  } else {
    memberTabs.forEach((tab) => {
      const thumb = tab.thumbnail || getYouTubeThumbnail(tab.url);
      const card = document.createElement("div");
      card.className = "thumb-choice-card";
      card.title = `Use thumbnail from: ${tab.title || tab.url}`;

      card.innerHTML = `
        <div class="thumb-choice-preview">
          ${
            thumb
              ? `<img src="${thumb}" alt="" />`
              : `<span class="tab-favicon" style="${tab.favIconUrl ? `background-image: url('${tab.favIconUrl}')` : ''}">${tab.favIconUrl ? '' : (tab.title || 'T').charAt(0)}</span>`
          }
        </div>
        <div class="thumb-choice-title">${tab.title || tab.url}</div>
      `;

      card.addEventListener("click", async () => {
        group.thumbnail = thumb || tab.favIconUrl || null;
        group.updatedAt = Date.now();
        await saveCollections();
        closeThumbnailModal();
        render();
      });

      els.thumbTabsGrid.append(card);
    });
  }

  els.thumbnailModal.classList.remove("hidden");
}

/**
 * Close Group Thumbnail Modal
 */
function closeThumbnailModal() {
  els.thumbnailModal.classList.add("hidden");
  targetThumbnailGroupId = null;
}

/**
 * Apply custom image URL as group thumbnail
 */
async function applyCustomThumbUrl() {
  const url = els.customThumbUrlInput.value.trim();
  if (!url || !targetThumbnailGroupId) return;

  const group = findGroupById(collections, targetThumbnailGroupId);
  if (group) {
    group.thumbnail = url;
    group.updatedAt = Date.now();
    await saveCollections();
    closeThumbnailModal();
    render();
  }
}

/**
 * Handle local image file upload for group thumbnail
 */
function handleThumbFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file || !targetThumbnailGroupId) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const rawDataUrl = event.target?.result;
    if (!rawDataUrl) return;

    // Compress on canvas to max 320x180
    const img = new Image();
    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 320, 180);
        const compressed = canvas.toDataURL("image/jpeg", 0.7);

        const group = findGroupById(collections, targetThumbnailGroupId);
        if (group) {
          group.thumbnail = compressed;
          group.updatedAt = Date.now();
          await saveCollections();
          closeThumbnailModal();
          render();
        }
      } catch (err) {
        console.warn("Could not compress thumbnail:", err);
      }
    };
    img.src = rawDataUrl;
  };
  reader.readAsDataURL(file);
  e.target.value = "";
}

/**
 * Remove group thumbnail cover
 */
async function removeGroupThumb() {
  if (!targetThumbnailGroupId) return;
  const group = findGroupById(collections, targetThumbnailGroupId);
  if (group) {
    group.thumbnail = null;
    group.updatedAt = Date.now();
    await saveCollections();
    closeThumbnailModal();
    render();
  }
}

/* ==========================================================================
   Add Open Tabs Modal
   ========================================================================== */

/**
 * Open the Add Open Tabs picker modal
 */
async function openPickerModal(preferredGroupId = null) {
  await loadOpenTabs();
  renderGroupSelectOptions();

  if (preferredGroupId && findGroupById(collections, preferredGroupId)) {
    els.pickerTargetGroup.value = preferredGroupId;
  }

  els.pickerTabsList.innerHTML = "";

  if (openTabs.length === 0) {
    els.pickerTabsList.innerHTML = `<div class="empty-state-desc" style="text-align:center; padding: 20px;">No readable open tabs found.</div>`;
  } else {
    openTabs.forEach((tab) => {
      const node = els.pickerTabTemplate.content.firstElementChild.cloneNode(true);
      const checkbox = node.querySelector(".picker-tab-checkbox");
      const favicon = node.querySelector(".tab-favicon");
      const title = node.querySelector(".picker-tab-title");
      const url = node.querySelector(".picker-tab-url");
      const activeBadge = node.querySelector(".picker-active-badge");

      checkbox.value = String(tab.id);
      checkbox.checked = true;

      const isCurrent = Boolean(currentActiveTab && tab.id === currentActiveTab.id);
      if (isCurrent && activeBadge) {
        activeBadge.classList.remove("hidden");
      } else if (activeBadge) {
        activeBadge.classList.add("hidden");
      }

      if (tab.favIconUrl) {
        favicon.style.backgroundImage = `url("${tab.favIconUrl}")`;
      } else {
        favicon.textContent = (tab.title || "T").charAt(0).toUpperCase();
      }

      title.textContent = tab.title || tab.url;
      url.textContent = displayDomain(tab.url);

      els.pickerTabsList.append(node);
    });
  }

  els.pickerModal.classList.remove("hidden");
}

/**
 * Close the Add Open Tabs modal
 */
function closePickerModal() {
  els.pickerModal.classList.add("hidden");
}

/**
 * Save selected open tabs into the destination collection or folder
 */
async function confirmAddTabs() {
  const targetGroupId = els.pickerTargetGroup.value;
  const targetGroup = findGroupById(collections, targetGroupId);

  if (!targetGroup) {
    alert("Please select or create a collection first.");
    return;
  }

  const checkedCheckboxes = [...els.pickerTabsList.querySelectorAll(".picker-tab-checkbox:checked")];
  const selectedTabIds = checkedCheckboxes.map((cb) => Number(cb.value));
  const selectedTabs = openTabs.filter((t) => selectedTabIds.includes(t.id));

  if (selectedTabs.length === 0) {
    closePickerModal();
    return;
  }

  if (!Array.isArray(targetGroup.tabs)) {
    targetGroup.tabs = [];
  }

  // Avoid duplicates: check normalized URLs against already saved tabs in this group
  const existingUrls = new Set(
    targetGroup.tabs.map((t) => normalizeUrl(t.url || t.lastUrl))
  );

  const tabsToAdd = [];
  const trackingQueue = [];

  for (const tab of selectedTabs) {
    const norm = normalizeUrl(tab.url);
    if (existingUrls.has(norm)) {
      // Disallow duplicate URLs in the same group as requested
      continue;
    }
    existingUrls.add(norm);

    const ytThumb = getYouTubeThumbnail(tab.url);
    const savedTab = {
      id: uid(),
      title: tab.title || tab.url,
      url: tab.url,
      lastUrl: tab.url,
      favIconUrl: tab.favIconUrl || "",
      thumbnail: ytThumb || null,
      dynamic: Boolean(targetGroup.dynamic),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    tabsToAdd.push(savedTab);
    trackingQueue.push({ tabId: tab.id, savedTabId: savedTab.id });
  }

  if (tabsToAdd.length > 0) {
    targetGroup.tabs.unshift(...tabsToAdd);
    targetGroup.updatedAt = Date.now();
    expandedGroupIds.add(targetGroup.id);

    // 1. Persist to local storage FIRST before any background operations
    await saveCollections();

    // 2. Render UI immediately so tabs show up with zero delay
    render();
  }

  closePickerModal();

  // 3. Register tracking in background atomically in one batch (prevents race conditions)
  if (trackingQueue.length > 0) {
    const batchItems = trackingQueue.map(({ tabId, savedTabId }) => ({
      tabId: tabId,
      groupId: targetGroup.id,
      savedTabId: savedTabId
    }));
    await trackSavedTabsBatch(batchItems);
    renderStats();
  }
}

/* ==========================================================================
   Quick Add Active Tab Dialog
   ========================================================================== */

/**
 * Open the Quick Add Active Tab dialog
 */
async function openQuickAddModal() {
  await loadOpenTabs();

  if (!currentActiveTab) {
    alert("No active tab found.");
    return;
  }

  els.activeTabTitle.textContent = currentActiveTab.title || currentActiveTab.url;
  els.activeTabUrl.textContent = displayDomain(currentActiveTab.url);

  const favicon = els.activeTabPreview.querySelector(".tab-favicon");
  if (currentActiveTab.favIconUrl) {
    favicon.style.backgroundImage = `url("${currentActiveTab.favIconUrl}")`;
  } else {
    favicon.textContent = (currentActiveTab.title || "T").charAt(0).toUpperCase();
  }

  renderGroupSelectOptions();
  els.quickAddModal.classList.remove("hidden");
}

/**
 * Close the Quick Add dialog
 */
function closeQuickAddModal() {
  els.quickAddModal.classList.add("hidden");
}

/**
 * Confirm Quick Add
 */
async function confirmQuickAdd() {
  await addActiveTabDirectlyToGroup(els.quickAddTargetGroup.value);
  closeQuickAddModal();
}

/* ==========================================================================
   Export & Import Data (JSON)
   ========================================================================== */

/**
 * Export collections to JSON file
 */
function exportData() {
  const dataBlob = new Blob([JSON.stringify(collections, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `collections-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  els.moreMenu.classList.add("hidden");
}

/**
 * Import collections from JSON file
 */
function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target?.result);
      if (Array.isArray(imported)) {
        collections = imported;
        await saveCollections();
        render();
        alert("Collections successfully imported!");
      } else {
        alert("Invalid file format. Please upload a valid Collections JSON file.");
      }
    } catch {
      alert("Could not parse file. Make sure it is valid JSON.");
    }
  };
  reader.readAsText(file);
  els.moreMenu.classList.add("hidden");
  event.target.value = "";
}

/* ==========================================================================
   Event Listeners & Initialization
   ========================================================================== */

// Create Collection
els.createSubjectBtn.addEventListener("click", createCollection);
els.subjectInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createCollection();
});

// Search filter
els.searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderGroups();
});

// Open Picker Modal
els.openPickerBtn.addEventListener("click", () => openPickerModal());
els.closePickerBtn.addEventListener("click", closePickerModal);
els.closePickerBackdrop.addEventListener("click", closePickerModal);
els.cancelPickerBtn.addEventListener("click", closePickerModal);
els.confirmAddTabsBtn.addEventListener("click", confirmAddTabs);

// Open Tabs Picker Modal Selection Actions
els.selectAllTabsBtn.addEventListener("click", () => {
  const checkboxes = els.pickerTabsList.querySelectorAll(".picker-tab-checkbox");
  checkboxes.forEach((cb) => { cb.checked = true; });
});

if (els.deselectAllTabsBtn) {
  els.deselectAllTabsBtn.addEventListener("click", () => {
    const checkboxes = els.pickerTabsList.querySelectorAll(".picker-tab-checkbox");
    checkboxes.forEach((cb) => { cb.checked = false; });
  });
}

if (els.selectCurrentTabOnlyBtn) {
  els.selectCurrentTabOnlyBtn.addEventListener("click", () => {
    const activeId = currentActiveTab ? String(currentActiveTab.id) : null;
    const checkboxes = els.pickerTabsList.querySelectorAll(".picker-tab-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = Boolean(activeId && cb.value === activeId);
    });
  });
}

if (els.confirmAddCurrentTabBtn) {
  els.confirmAddCurrentTabBtn.addEventListener("click", async () => {
    const targetGroupId = els.pickerTargetGroup.value;
    await addActiveTabDirectlyToGroup(targetGroupId);
    closePickerModal();
  });
}

// Context Menu Global Actions
if (els.contextOpenNewWindow) {
  els.contextOpenNewWindow.addEventListener("click", () => {
    if (currentContextMenuTab) {
      chrome.windows.create({ url: currentContextMenuTab.lastUrl || currentContextMenuTab.url });
    }
    hideTabContextMenu();
  });
}

if (els.contextToggleDynamic) {
  els.contextToggleDynamic.addEventListener("click", async () => {
    if (currentContextMenuTab && currentContextMenuGroup) {
      const nextDynamic = !currentContextMenuTab.dynamic;
      currentContextMenuTab.dynamic = nextDynamic;
      currentContextMenuTab.updatedAt = Date.now();
      currentContextMenuGroup.updatedAt = Date.now();

      if (!nextDynamic) {
        updateAncestorsDynamicStateOnDisable(currentContextMenuGroup.id);
      }
      await saveCollections();
      render();
    }
    hideTabContextMenu();
  });
}

if (els.contextDeleteTab) {
  els.contextDeleteTab.addEventListener("click", async () => {
    if (currentContextMenuTab && currentContextMenuGroup) {
      const savedTab = currentContextMenuTab;
      const group = currentContextMenuGroup;
      group.tabs = group.tabs.filter((t) => t.id !== savedTab.id);
      group.updatedAt = Date.now();

      const openTabId = activeTrackedMap[savedTab.id];
      if (openTabId) {
        await untrackSavedTab(openTabId);
        delete activeTrackedMap[savedTab.id];
      }

      await saveCollections();
      render();
    }
    hideTabContextMenu();
  });
}

// Hide context menu on outside click, Escape key, or window blur
document.addEventListener("click", (e) => {
  if (els.tabContextMenu && !els.tabContextMenu.classList.contains("hidden")) {
    if (!e.target.closest("#tabContextMenu") && !e.target.closest(".move-tab-btn")) {
      hideTabContextMenu();
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideTabContextMenu();
  }
});

window.addEventListener("blur", hideTabContextMenu);

// Quick Add Active Tab Dialog
els.quickAddCurrentBtn.addEventListener("click", openQuickAddModal);
els.closeQuickAddBtn.addEventListener("click", closeQuickAddModal);
els.closeQuickAddBackdrop.addEventListener("click", closeQuickAddModal);
els.cancelQuickAddBtn.addEventListener("click", closeQuickAddModal);
els.confirmQuickAddBtn.addEventListener("click", confirmQuickAdd);

// Create Sub-folder Modal
els.closeSubfolderBtn.addEventListener("click", closeSubfolderModal);
els.closeSubfolderBackdrop.addEventListener("click", closeSubfolderModal);
els.cancelSubfolderBtn.addEventListener("click", closeSubfolderModal);
els.confirmSubfolderBtn.addEventListener("click", confirmCreateSubfolder);
els.subfolderNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") confirmCreateSubfolder();
});

// Group Thumbnail Modal
els.closeThumbnailBtn.addEventListener("click", closeThumbnailModal);
els.closeThumbnailBackdrop.addEventListener("click", closeThumbnailModal);
els.cancelThumbnailBtn.addEventListener("click", closeThumbnailModal);
els.applyThumbUrlBtn.addEventListener("click", applyCustomThumbUrl);
els.customThumbUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") applyCustomThumbUrl();
});
els.thumbFileInput.addEventListener("change", handleThumbFileUpload);
els.removeThumbBtn.addEventListener("click", removeGroupThumb);

// Open in Full Browser Tab
if (els.openFullTabBtn) {
  els.openFullTabBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?fullpage=1") });
    window.close();
  });
}

// Close all browser tabs currently tracked by the extension
if (els.closeTrackedTabsBtn) {
  els.closeTrackedTabsBtn.addEventListener("click", closeAllTrackedTabs);
}

// More Menu Dropdown
els.menuToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  els.moreMenu.classList.toggle("hidden");
});

document.addEventListener("click", () => {
  els.moreMenu.classList.add("hidden");
});

// Export / Import
els.exportBtn.addEventListener("click", exportData);
els.importInput.addEventListener("change", importData);

// Real-time synchronization when Chrome storage updates in background
// Debounced so rapid background writes don't spam re-renders
let _storageUpdateTimer = null;
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (isSaving) return; // Ignore events triggered by popup's own write operations
  if (areaName === "local" && (changes[STORAGE_KEY] || changes[TRACKED_TABS_KEY])) {
    clearTimeout(_storageUpdateTimer);
    _storageUpdateTimer = setTimeout(() => {
      loadState().then(() => render());
    }, 250);
  }
});

/**
 * Initialize extension popup
 */
// Move Modal Listeners
if (els.closeMoveBtn) els.closeMoveBtn.addEventListener("click", closeMoveModal);
if (els.closeMoveBackdrop) els.closeMoveBackdrop.addEventListener("click", closeMoveModal);
if (els.cancelMoveBtn) els.cancelMoveBtn.addEventListener("click", closeMoveModal);
if (els.closeTrackedTabsBtn) els.closeTrackedTabsBtn.addEventListener("click", closeAllTrackedTabs);

async function init() {
  // Detect full-page mode (opened as a browser tab via ?fullpage=1 or window width > 550px)
  function checkFullPageMode() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("fullpage") === "1" || window.innerWidth > 680) {
      document.body.classList.add("fullpage-mode");
    } else {
      document.body.classList.remove("fullpage-mode");
    }
  }

  checkFullPageMode();
  window.addEventListener("resize", checkFullPageMode);

  setSelectedColor(DEFAULT_COLORS[0]);
  // Load state FIRST so the UI appears immediately, then lazily load open tabs
  await loadState();
  render();
  // Defer open-tab query so popup opens instantly
  loadOpenTabs().catch(() => {});
}

init();
