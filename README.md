# ✂️ Gnoke Tailors

A focused business tool for tailors — deadlines, customer memory, and money clarity.

> **Portable. Private. Persistent.**

---

## Live Demo

**[edmundsparrow.github.io/gnoke-tailors](https://edmundsparrow.github.io/gnoke-tailors)**

---

## What It Does

- Track every order with a due date — see what's due today, tomorrow, whenever
- Overdue detection — late jobs show clearly, with the money at risk
- Customer memory — returning customers auto-fill their last measurements and style
- Money dashboard — outstanding balances, deposits collected
- Backup and restore — export your data; never lose anything to a lost phone
- Works completely offline
- No account. No server. No tracking.

---

## Run Locally

```bash
git clone https://github.com/edmundsparrow/gnoke-stitches.git
cd gnoke-stitches
python -m http.server 8080
```

Open: **http://localhost:8080**

> ⚠️ Always run through a local server. Do not open HTML files directly in the browser — sql.js WASM will not load via `file://`.

---

## Project Structure

```
gnoke-stitches/
├── index.html          ← Splash / intro screen
├── main/
│   └── index.html      ← Main app shell (clean URL: /main/)
├── js/
│   ├── state.js        ← App state (single source of truth)
│   ├── theme.js        ← Dark / light toggle
│   ├── ui.js           ← Toast, modal, status chip
│   ├── db-core.js      ← SQLite engine + IndexedDB
│   ├── db-orders.js    ← Order and customer domain queries
│   ├── render.js       ← All DOM building
│   ├── update.js       ← Version checker
│   └── app.js          ← Bootstrap + event wiring
├── style.css           ← Gnoke design system
├── sw.js               ← Service worker (offline / PWA)
├── manifest.json       ← PWA manifest
├── global.png          ← App icon
└── LICENSE
```

---

## Privacy & Tech

- **Stack:** SQLite (WASM), IndexedDB, Vanilla JS — zero dependencies.
- **Privacy:** No tracking, no telemetry, no ads. Your data is yours.
- **License:** GNU GPL v3.0

---

## Support

If this saves you time, consider buying me a coffee:
**[selar.com/showlove/edmundsparrow](https://selar.com/showlove/edmundsparrow)**

---

© 2026 Edmund Sparrow — Gnoke Suite
