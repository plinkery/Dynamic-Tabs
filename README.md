# Dynamic Tabs

### 🔄 Want your saved tabs to keep up with you?
> Automatically track URL changes — privately, locally, and with no account or signup.


Save a tab once and let Dynamic Tabs keep its saved URL and title updated as you navigate.

**No account. No cloud sync. No analytics. No browsing data uploaded to a server.**

Your collection data stays in your browser.

---

## 🤔 Why Dynamic Tabs?

### Want to keep track of exactly where you left off — without signing in?

Ever watched a YouTube video and thought:

> *“I'll come back to this later.”*

Then struggled to find the exact YouTube account you watched that in?

Dynamic Tabs lets you save the video and keep it organized in your own collections — **even if you aren't signed in to YouTube.**

And because Dynamic Tabs can track YouTube videos and their playback position, you can come back later and continue from where you left off.

---

### 📺 Watching an anime, web series, or movie?

Want to remember **exactly which episode you're watching?**

Save it once and enable Dynamic Tracking.

As you move from:

```text
Episode 5
    ↓
Episode 6
    ↓
Episode 7
```

Dynamic Tabs can update the saved tab to follow the episode you're currently watching.

So instead of remembering:

> *“I think I was somewhere around episode 7...”*

your collection can keep track of it for you.

---

### 🎓 Taking an online course?

Learning through an online platform? You can organize your course material into collections and let Dynamic Tracking keep your saved pages up to date as you progress.


Instead of maintaining a pile of bookmarks that quickly become outdated, Dynamic Tabs can keep the saved page associated with your active tab synchronized as you move through the course.

---

### 🔒 And you don't need to hand your data to another service.

Your collections are stored locally in your browser.

**No signup. No account. No cloud required.**

Dynamic Tabs is built around a simple idea:

> **Save what matters. Organize it your way. Let it keep up with you.**


# 🔒 Privacy First

Dynamic tracking requires website access because the extension needs to detect navigation changes on webpages.

But **Dynamic Tabs does not need a server to do this.**

Your collections are stored locally using:

```text
chrome.storage.local
```

There is:

* ❌ No account
* ❌ No signup
* ❌ No cloud database
* ❌ No analytics service
* ❌ No collection-data upload
* ❌ No requirement to send your browsing history to a server

Your saved collections remain on your browser profile.

### Why does the extension request website access?

Dynamic Tabs uses website access to provide features such as:

* Detecting URL changes in modern single-page applications
* Updating dynamically tracked tabs
* Detecting YouTube video changes
* Tracking YouTube playback position

The extension's source code is publicly available, so you can inspect exactly how these features are implemented.

---

# ⚡ What can it do?

## 🔄 Real-time Dynamic Tracking

Enable **Dynamic** mode for a saved tab.

As you navigate:

```text
URL changes
    ↓
Dynamic Tabs detects it
    ↓
Saved tab information is updated
```

It can update:

* URL
* Page title
* Favicon

Dynamic tracking also works with many single-page applications where the URL changes without a traditional page reload.

You can enable Dynamic tracking for an individual saved tab or a folder.

Enabling Dynamic tracking for a folder also applies it to its child folders and saved tabs.

---

## ▶️ YouTube Tracking

Dynamic Tabs has dedicated YouTube support.

It can:

* Detect video changes
* Save playback position
* Update the saved timestamp periodically
* Restore the video using its saved timestamp
* Display YouTube thumbnails

So you can save a lecture and come back later without manually searching for where you stopped.

---

## 📁 Organize Everything

Create collections and **unlimited nested folders** to organize anything you are learning, watching, or working on.

For example, you could organize your study material like this:

```text
📚 Academics
├── Mathematics
│   ├── Algebra
│   ├── Calculus
│   └── Probability
│
├── Biology
│   ├── Cell Biology
│   ├── Genetics
│   └── Human Anatomy
│
├── Physics
│   ├── Mechanics
│   ├── Thermodynamics
│   └── Electromagnetism
│
└── Chemistry
    ├── Organic Chemistry
    ├── Inorganic Chemistry
    └── Physical Chemistry
```

You can:

* Create collections and nested folders
* Rename folders
* Reorder them with drag-and-drop
* Delete entire folders and their contents
* Choose custom colours for your collections


---

## 🔖 Save Tabs Quickly

Save the active tab or select multiple tabs from your current browser window.

Dynamic Tabs remembers information such as:

* Page title
* URL
* Favicon
* Last visited URL
* Timestamps
* Optional thumbnail

The same normalized URL is prevented from being saved twice **inside the same folder**.

The same URL can still exist in different folders.

---

## ♻️ Restore Tabs Without Creating Duplicates

Restore a single saved tab or an entire folder.

If Dynamic Tabs detects that the saved tab is already open, it can focus the existing tab instead of opening another copy.

---

## 🖼️ Custom Collection Covers

Give your collections their own visual identity.

Set a cover using:

* A saved tab
* A direct image URL
* A local image

Local images are stored locally and resized to **320 × 180**.

---

## 🎨 Custom Colours

Choose collection colours using:

* Preset colours
* A colour picker
* A custom HEX value

---

## 🔍 Search

Quickly search through:

* Collections
* Folders
* Saved tabs

---

## 💾 Backup & Restore

Export your collections as JSON.

You can use the backup to:

* Keep a manual backup
* Move your collections to another browser profile
* Restore your collection data after reinstalling

### ⚠️ Important

Importing a backup **replaces your existing collections**.

It does **not merge** the imported data with your current collections.

---

# 🚫 What Dynamic Tabs does NOT do

Dynamic Tabs does not automatically save every website you visit.

You explicitly choose which tabs to save and which ones should use Dynamic tracking.

It also does not currently:

* Sync collections between devices
* Sync between browser profiles
* Sync with the cloud
* Automatically back up your collections
* Restore browser history
* Restore scroll position
* Restore login/session state
* Restore pinned or muted tab state
* Restore original window/tab positions
* Track closed tabs
* Track playback position on services other than YouTube
* Manage Chrome's native Tab Groups
* Merge imported backups
* Save browser-internal pages such as `chrome://extensions`

Dynamic tracking also stops when its associated browser tab is closed.

---

# 🌐 Browser Support

Dynamic Tabs is being developed for modern browsers that support the required **Manifest V3 extension APIs**.

The planned supported browsers are:

* 🌐 Google Chrome
* 🔷 Microsoft Edge
* 🦁 Brave
* 🦊 Mozilla Firefox

Browser-specific behaviour may vary, and each browser version will be tested separately before being considered officially supported.

> **Note:** The project is currently being prepared for multi-browser release. Store availability may differ between browsers during the initial release.

---

# 📦 Installation

## Browser Stores

Dynamic Tabs will be available through the respective browser extension stores once the releases are published.

* **Chrome Web Store:** *Coming soon*
* **Microsoft Edge Add-ons:** *Coming soon*
* **Brave:** *Coming soon / availability may depend on the Brave extension distribution process*
* **Firefox Add-ons:** *Coming soon*

Links will be added here when each release is published.

## Install from source

You can also run Dynamic Tabs directly from the source code.

### Chromium-based browsers

For Chrome, Edge, and Brave:

1. Clone the repository:

```bash
git clone https://github.com/plinkery/Dynamic-Tabs.git
```

2. Open your browser's extension management page.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the Dynamic Tabs project directory.

### Firefox

Firefox has its own extension development and loading process. Instructions will be added here once the Firefox build has been tested and finalized.

---

# 🛠️ Development

Dynamic Tabs is built using:

* JavaScript
* HTML
* CSS
* Web Extension APIs
* Manifest V3

There is no backend server required for the extension's core functionality.

The project is open source, so you can inspect the source code, understand how it works, modify it, and contribute improvements.

---

# 🐛 Bug Reports & Contributions

Found a bug or have an idea?

Open an **Issue** on GitHub and include:

* What you were trying to do
* What you expected to happen
* What actually happened
* Browser and browser version
* Dynamic Tabs version
* Steps to reproduce the problem
* Screenshots or console errors, if relevant

Pull requests are welcome.

---

# 📄 License

Dynamic Tabs is released under the **MIT License**.

See [`LICENSE`](LICENSE) for the complete license text.

---

## ⭐ Like the project?

If Dynamic Tabs is useful to you:

⭐ Star the repository
🐛 Report bugs
💡 Suggest features
🔧 Contribute improvements
