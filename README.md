# 🎭 cki — A P2P Guess Who Game

cki is a **browser-based multiplayer "Guess Who?" game**, designed to run seamlessly on **desktop and mobile (PWA)**.  
It leverages **Next.js (App Router)**, **React**, **TailwindCSS + shadcn/ui** for the UI, and **PeerJS (WebRTC DataChannels)** for peer-to-peer connections.  
No central server is required — all game data is exchanged directly between players.

---

## ✨ Features

- 🕹️ **Two-player P2P matches** — invite a friend with a link, no signup required.
- 📱 **Installable PWA** — play offline and on mobile (Android/iOS).
- 🎨 **Dynamic grid system** — flexible board sizes (e.g. 4×8, 5×7).
- 🖼️ **Custom images** — import your own characters via URLs or local files.
- 🔒 **Privacy-first** — no server-side storage, all data stays local or P2P.
- 🌙 **Dark/Light mode** — theme switching powered by Tailwind.
- ⚡ **Optimized build** — Bun + Biome for fast development and clean code.

---

## 🏗️ Tech Stack

- [**Next.js**](https://nextjs.org/) (App Router, React 18, TypeScript)
- [**Bun**](https://bun.sh/) (dependency & script runner)
- [**TailwindCSS**](https://tailwindcss.com/) (utility-first CSS)
- [**shadcn/ui**](https://ui.shadcn.com/) (UI component library)
- [**PeerJS**](https://peerjs.com/) (WebRTC abstraction for P2P)
- [**Biome**](https://biomejs.dev/) (formatter + linter)
- **PWA** (Service Worker + manifest)

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/aifedespaix/cki.git
cd cki
```

### 2. Install dependencies

```bash
bun install
```

### 3. Run in development

```bash
bun dev
```

App runs at [http://localhost:3000](http://localhost:3000).

### 4. Build for production

```bash
bun build
```

---

## 🛠️ Linting & Formatting

This project uses **Biome** as a single tool for linting and formatting.

- Check code:

```bash
bun run lint
```

- Auto-format:

```bash
bun run format
```

---

## 📦 shadcn/ui Components

Installed components:

- `button`, `card`, `dialog`, `alert-dialog`, `popover`, `tooltip`
- `input`, `select`, `checkbox`, `switch`, `form`
- `toast`, `progress`, `badge`, `skeleton`
- `sheet`, `tabs`, `accordion`, `scroll-area`, `separator`, `avatar`

Add more with:

```bash
bun x shadcn-ui@latest add <component>
```

---

## 🌐 Peer-to-Peer Networking

- PeerJS handles **signaling and peer discovery**.
- Default PeerJS cloud server is used (optional: self-hosted PeerServer).
- All game state (grid, guesses, turns) is synced directly via **WebRTC DataChannel**.
- End-to-end encrypted (DTLS-SRTP).

---

## 📱 Progressive Web App (PWA)

- Installable on Android/iOS and desktop.
- Works offline (menu, rules, cached assets).
- Service Worker with Stale-While-Revalidate strategy.

Run a Lighthouse audit in Chrome DevTools to verify PWA compliance.

---

## 🔒 Privacy & Data

- No central database or server storage.
- All data is exchanged directly between peers.
- Images imported via URL or local upload remain local.
- GDPR-friendly: anonymous play supported.

---

## 🚨 Known Limitations

- **NAT traversal** — strict NATs may require a TURN server (PeerJS cloud provides limited support).
- **URL size** — invitation links should remain small (<2 KB); large game states are synced via DataChannel.
- **Third-party scraping** (Facebook, Twitter, LinkedIn, Instagram) is **not supported** due to CORS/auth restrictions.
- **iOS Safari** — limited PWA features (no push, memory restrictions for WebRTC).

---

## 🤝 Contributing

1. Fork this repository.
2. Create a new feature branch (`git checkout -b feature/my-feature`).
3. Commit changes (`git commit -m "Add my feature"`).
4. Push to your branch (`git push origin feature/my-feature`).
5. Create a Pull Request.

---

## 📜 License

MIT License © 2025

---

## 🙌 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the component system.
- [PeerJS](https://peerjs.com/) for simplifying WebRTC.
- [Next.js](https://nextjs.org/) for the React framework.
