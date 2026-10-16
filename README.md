# Dynamic Tabs

> **The private, local tab manager that remembers where you left off — no account, no cloud, no catch.**

Save a tab once. Dynamic Tabs keeps its URL, title, favicon, scroll position, and YouTube timestamp updated as you browse — entirely inside your own browser.

**No signup · No cloud · No analytics · No data ever leaves your machine.**

---

## ⚡ 60-second pitch

| You want to… | Dynamic Tabs can… |
|---|---|
| Pick up a YouTube lecture where you stopped | Save the video + timestamp; reopen and it resumes automatically |
| Follow an anime episode-by-episode without losing track | Let Dynamic tracking update the saved URL as you move between episodes |
| Organise course material into neat folders | Create unlimited nested collections with custom colours and covers |
| Close a bunch of research tabs and reopen them later | Open All / Close Tracked — no duplicates, one click |
| Keep your data private | Everything stays in `chrome.storage.local`. Nothing is sent anywhere. |

**Completely private and secure** — open-source, auditable, no backend required.

---

## 🔒 Privacy in plain language

Dynamic Tabs needs access to web pages so it can detect URL changes and track scroll/playback position. Here is exactly what it does and does **not** do with that access:

| ✅ What it does | ❌ What it never does |
|---|---|
| Reads the current URL to detect navigation | Upload your browsing history |
| Saves scroll position locally | Sync data to any server |
| Tracks YouTube timestamp locally | Require an account or email |
| Stores all collections in `chrome.storage.local` | Run any analytics or telemetry |

The full source code is public on GitHub — read every line yourself.

---

## 🗺️ Full Feature Reference

### 1 · Collections & Folders

| Feature | Where to find it | How to use it |
|---|---|---|
| **Create a collection** | Top input bar → type a name → **Create** button | Choose a colour swatch first, then press Create |
| **Collapse / Expand** | Click the arrow (>) | Displays all the tracked tabs and subfolders within the main folder |
| **Create a sub-folder** | Open a collection → click on **Add Sub-folder** button | Supports unlimited nesting |
| **Rename** | Simply click on the folder name | Type new name |
| **Delete** | click on bin icon next to folder name to **Delete** | Removes folder and all its tabs |
| **Reorder** | click the left edge of a tab or a folder and drag  | Drop in any position; order is persisted |
| **Move tab to a folder** | Right click the tracked tab and move it to a desired folder | moves a tab to a different folder |
| **Custom colour** | Choose from default colors or select your own by clicking on the '+' symbol to the right | Pick from presets, use the colour picker, or type a HEX code |
| **Custom cover image** | click on 🖼️ to set your own thumbnail | Choose a saved tab's thumbnail, paste an image URL, or upload a local file (stored locally, resized to 320 × 180) |

---

### 2 · Saving Tabs

| Feature | Where to find it | How to use it |
|---|---|---|
| **Save the current active tab** | create a new folder or press the → **'+' Add Active Tab** button next to an exisiting folder | Opens a mini modal; pick the destination collection, confirm |
| **Save multiple open tabs** | 
| **Save the current active tab** | create a new folder or press the → **'+' Add Active Tab** button -> add all selected tabs | Tick the tabs you want; use **Select All / Deselect All** to bulk-select; choose destination; confirm. Duplicate URLs within the same folder are silently skipped. |


> URLs are deduplicated **per folder** — the same URL can appear in different folders.

---

### 3 · Dynamic Tracking

Enable **Dynamic** mode to let the extension follow your browsing and keep saved tab data up to date.

| Feature | Where to find it | How to use it |
|---|---|---|
| **Enable Dynamic (single tab)** | Saved tab → ⚡ Dynamic toggle | The saved URL, title, and favicon update as you navigate that tab |
| **Enable Dynamic (entire folder)** | Folder menu (⋮) → **Mark as Dynamic** | All tabs and sub-folders inside inherit the Dynamic flag. The yellow ⚡ badge appears on the folder. |
| **Disable Dynamic for a child** | Individual tab or sub-folder toggle | Turns off tracking for that item only; the parent folder badge reflects the mixed state |
| **SPA / single-page app support** | Automatic when Dynamic is on | Catches URL changes made by `pushState` / `replaceState` (e.g., course platforms, streaming sites) without a full page reload |

---

### 4 · Scroll Position Tracking *(v2.0.0 — new)*

When a dynamic tab is open, Dynamic Tabs periodically saves `scrollY` (how far down the page you have scrolled). When you reopen the tab, the page automatically scrolls back to where you left off.

| Feature | Where to find it | How to use it |
|---|---|---|
| **Enable scroll tracking** | Automatic for all tabs with Dynamic enabled | No extra step needed; scroll position is stored alongside the saved tab |
| **Scroll restoration** | Happens on page load when you reopen a saved tab | The page scrolls to the saved position a moment after load |

> Scroll tracking only runs on tabs you have explicitly marked as Dynamic. It is not active on every page you visit.

---

### 5 · YouTube Tracking

Dynamic Tabs has dedicated YouTube support, separate from generic scroll/URL tracking. Just turn on dynamic tracking on your youtube page or folder and it will automatically track the video changes in playlists or next video in a series and save the timestamp of where you left off.

---

### 6 · Opening & Restoring Tabs

| Feature | Where to find it | How to use it |
|---|---|---|
| **Open a single saved tab** | Click the tab title or the open-link icon | Opens in a new tab; if already open, focuses the existing tab |
| **Open all tabs in a folder** | Folder header → **Open All** (↗ icon) | Creates new tabs only for saved tabs that are not already open |
| **Close all tracked tabs** | Header → **Close Tracked (n)** button | Saves current state, shows a confirm dialog, then closes all n tracked tabs in one operation. The badge updates in real time. |

---

### 7 · Active Tab Badges & Live Status

| Feature | Where to find it | How to use it |
|---|---|---|
| **"Active" badge on tabs** | Each saved-tab card when it is open in the browser | A coloured dot appears automatically; disappears when the tab is closed |
| **Tracked tab count** | Header stats line: *N collections · M tabs (K active)* | K = number of tracked tabs currently open in the browser |
| **Close Tracked count** | Button label: *Close Tracked (K)* | Updates in real time as you open or close tabs |

---

### 8 · Full-Page Mode

| Feature | Where to find it | How to use it |
|---|---|---|
| **Expand to full browser tab** | Top right corner → **Expand** button (⛶) | Opens `popup.html?fullpage=1` as a normal tab for a wider, more comfortable layout |

---

### 9 · Search

| Feature | Where to find it | How to use it |
|---|---|---|
| **Live search** | Search bar at the top of the popup | Filters collections, folders, and saved tabs by name/URL as you type |

---

### 10 · Backup & Migration

| Feature | Where to find it | How to use it |
|---|---|---|
| **Export** | Header → **⋮ menu** → **Export** | Downloads a `collections-YYYY-MM-DD.json` file to your computer |
| **Import** | Header → **⋮ menu** → **Import** | Replaces your current collections with the file you select |

> ⚠️ Import **replaces** — it does not merge. Export a backup before importing.

---

## 🚫 What Dynamic Tabs does not do

Dynamic Tabs is intentionally focused. It does **not**:

- Save every page you visit automatically
- Sync across devices or browser profiles
- Back up your data automatically
- Restore login or session state
- Restore pinned/muted tab state or original tab positions
- Track closed tabs
- Track playback position outside of YouTube
- Manage Chrome's native Tab Groups
- Merge imported backups with existing data
- Save browser-internal pages (`chrome://`, `edge://`, etc.)

---

## 🌐 Browser Support

Built on **Manifest V3** — supported by Chrome, Edge, and Brave today.

| Browser | Status |
|---|---|
| 🌐 Google Chrome | ✅ Supported |
| 🔷 Microsoft Edge | ✅ [Supported-click here](https://microsoftedge.microsoft.com/addons/detail/dynamic-tabs/bipledcdgpjcdjfaekimeklofpaijilk?hl=en-US) |
| 🦁 Brave | ✅ Supported |
| 🦊 Mozilla Firefox | 🔜 Planned |

---

## 📦 Installation

### From the browser store
> Links will be added here once each store release is published.
- **Microsoft Edge Add-ons:** *Coming soon*
- **Chrome Web Store:** *Coming soon*

### From source (Chrome / Edge / Brave)

```bash
git clone https://github.com/plinkery/Dynamic-Tabs.git
```

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the cloned folder

---

## 🛠️ Tech stack

Plain **JavaScript · HTML · CSS · Manifest V3 Web Extension APIs** — no build step, no framework, no backend.

---

## 🐛 Bug reports & contributions

Open a GitHub Issue and include:

- What you were trying to do
- What you expected vs. what happened
- Browser name and version
- Dynamic Tabs version
- Steps to reproduce
- Screenshots or console errors if available

Pull requests are welcome.

---

## 📄 License

MIT — see [`LICENSE`](LICENSE).

---

## ⭐ If Dynamic Tabs is useful to you

⭐ Star the repo · 🐛 Report bugs · 💡 Suggest features · 🔧 Submit pull requests

---
---
---

