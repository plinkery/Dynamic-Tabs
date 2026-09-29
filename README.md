# Collections (Microsoft Edge Collections for Google Chrome)

A modern, offline, local-first Chrome extension that brings the authentic Microsoft Edge Collections experience to Google Chrome. Organize tabs into hierarchical topic collections and sub-folders, configure optional dynamic tracking per tab or folder, select custom color shades or enter hex codes, reorder items with intuitive drag-and-drop, view rich 16:9 tab thumbnails, and set custom group cover images.

---

## ✨ Key Features

1. **Generalized Collections & Sub-Folders (Folders inside Folders)**:
   - Create root collections (e.g. *Work, Projects, Research, Learning*).
   - Create unlimited nested **sub-folders** within any collection or folder with clean folder hierarchy guides (sub-folders do not require color coding).
   - Inline folder renaming, one-click folder tab restoration, and clean deletion.

2. **Optional Dynamic Tracking (Tab-Level & Folder-Level)**:
   - **Tab-Level Dynamic Toggle**: Set individual tabs as `⚡ Dynamic` so their URLs, titles, and video timestamps update live as you browse.
   - **Folder-Level Dynamic Toggle**: Turn on `⚡ Dynamic` for an entire folder to automatically sync all tabs saved within it.
   - Static tabs remain preserved exactly as originally saved, protecting them from unintentional overwrites.

3. **Advanced Color Palette GUI**:
   - Curated palette swatches for quick one-click selection.
   - **Shade Picker GUI**: Drag and point across the color spectrum gradient to choose any shade.
   - **Hex Code Input**: Type or paste any 6-digit hex color code (`#6366f1`, `#0284c7`, etc.) with instant two-way live preview.

4. **Interactive Drag-and-Drop Reordering**:
   - Reorder collections and sub-folders by grabbing the drag handle (`⋮⋮`).
   - Reorder individual saved tabs within a folder or drag tabs across different folders with visual drop indicators.

5. **Microsoft Collections-Style Tab Thumbnails**:
   - Every saved tab displays a rich visual 16:9 thumbnail preview.
   - **YouTube Videos**: Automatically extracts crisp video stills directly from the video ID.
   - **Web Pages**: Captures visible page screenshot previews or clean domain favicon banners.

6. **Custom Group Cover Thumbnails**:
   - Customize each collection or folder cover with a dedicated thumbnail.
   - **Choose from Member Tabs**: 1-click selection from any tab already inside that folder.
   - **Custom Image URL**: Enter any direct web image URL.
   - **Local File Upload**: Select and compress any local image file.

7. **YouTube Playlist & Resume Progress**:
   - Normalized canonical YouTube watch URLs prevent the playlist index reload bug.
   - Video timestamps (e.g., `t=245s`) are preserved so resuming a video continues exactly where you paused.

8. **Offline, Private & Local-First**:
   - All data is securely stored on your machine using `chrome.storage.local`.
   - Export and Import backups as formatted JSON anytime.

---

## 🚀 How to Install & Load in Google Chrome

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select this directory:
   ```
   outputs/study-tab-collections
   ```
5. Click the puzzle icon in Chrome's toolbar and **Pin** "Collections".
6. Click the extension icon to start organizing your tabs!

---

## 📖 User Guide

### 1. Creating Collections & Picking Colors
- Select a preset swatch or click the color shade button to drag and point on the color spectrum.
- Alternatively, type a hex code (e.g., `10b981` or `#6366f1`) in the Hex field.
- Type your collection name and press <kbd>Enter</kbd> or click **Create**.

### 2. Creating Sub-Folders
- On any collection or folder card, click the **+ Sub-folder** icon in the header.
- Type the folder name (e.g., "Module 1", "Documentation", "Sprint Tasks") and click **Create Folder**.

### 3. Adding Tabs
- **Add Active Tab**: Click **Add Active Tab** in the top navigation bar to save your current page into any chosen folder.
- **Open Tabs**: Click **Open Tabs** to view all currently open browser tabs, check the ones you want, and save them in bulk.

### 4. Toggling Dynamic Updates
- **Individual Tab**: Click the `⚡ Dynamic` pill on any tab card to toggle live dynamic tracking on or off for that tab.
- **Folder**: Click the `⚡ Dynamic` pill in the folder header to toggle live dynamic tracking for all tabs inside the folder.

### 5. Setting Group Covers / Thumbnails
- Click the thumbnail icon/avatar on the left side of any folder header.
- Choose any tab thumbnail from the grid, enter an image URL, or upload a local image.

### 6. Dragging to Reorder
- Grab the `⋮⋮` grip on any folder or tab to drag it up or down to your preferred order.

---

## 🛠 File Structure

- **`manifest.json`**: Chrome Manifest V3 definition with `storage`, `tabs`, `activeTab`, `unlimitedStorage`, and host permissions.
- **`background.js`**: Background service worker handling recursive folder lookups, dynamic tracking logic, tab screenshot capture, and YouTube navigation.
- **`youtube-content.js`**: YouTube SPA navigation observer and playback timestamp tracker.
- **`popup.html`**: Microsoft Edge Collections-inspired popup layout with modals and templates.
- **`popup.js`**: Core UI controller, tree traversal, color picker sync, drag & drop, and thumbnail management.
- **`popup.css`**: Design system with Edge Collections aesthetics, 16:9 thumbnails, glowing dynamic badges, and fluid transitions.
