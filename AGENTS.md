# 📄 AGENTS.md

## 🎯 Purpose of this document

This file defines **the agents** involved in the **KeyS project** (a "Guess Who?"-style game playable as a PWA, full browser, P2P via PeerJS).  
Each agent (human, tool, automation) has a specific role. The goal is to ensure **clarity, maintainability, productivity**, and **robustness** in the development cycle.

---

## 👤 Human Agents

### 1. **Lead Developer**

- Designs and implements features.
- Ensures code follows standards (Biome).
- Decides technical orientations (stack choices, architecture).
- Maintains UI/UX consistency.

### 2. **Testers**

- Play real matches (mobile/desktop).
- Check P2P stability (PeerJS).
- Verify PWA installations (iOS/Android/Desktop).
- Report bugs and UX feedback.

### 3. **Design/UX (optional)**

- Proposes grid sizes (4x8, 5x7, etc.).
- Defines a coherent palette (via Tailwind tokens).
- Ensures accessibility (a11y, contrasts, ARIA).

---

## 🤖 Software & Tool Agents

### 1. **Next.js (App Router)**

- Manages **routing** (`/`, `/join/[id]`, `/create`).
- Provides **client rendering** (React) and **hydration**.
- Produces an **optimized build** for PWA.

### 2. **Bun**

- Handles **dependencies** (`bun add …`).
- Runs **dev** (`bun dev`), **build** (`bun build`).
- Optimizes local performance (fast startup).

### 3. **TailwindCSS + shadcn/ui**

- Tailwind → utility-first CSS system, dark/light mode, responsive.
- shadcn/ui → pre-built components (Button, Card, Dialog).
- Goal: speed + consistent UI.

### 4. **PeerJS**

- Provides **WebRTC DataChannel** layer.
- Uses a **PeerServer (signaling)**: either default PeerJS cloud or self-hosted.
- Responsibilities:
  - Unique ID creation.
  - Peer connection management.
  - Reconnections/timeouts.

### 5. **Biome**

- Unified linter + formatter (replaces ESLint + Prettier).
- Checks: syntax, style, formatting.
- Scripts:
  - `bun run lint` → check
  - `bun run format` → auto-format

### 6. **Service Worker / PWA**

- Provides:
  - **Offline fallback** (menu, rules, error page).
  - **Caching assets** (SWR / versioning).
  - **Install prompt** (Android/iOS).
- Verifies build integrity (`manifest.json` + icons).

### 7. **CI/CD (optional)**

- GitHub Actions or Bun + Vercel:
  - Auto lint + test on PR.
  - Auto build and deploy.

---

## 🔒 Security & GDPR

### 1. Personal data

- **No server storage**.
- Everything remains **local or P2P**.
- If user imports an image → stored locally/session only.

### 2. GDPR

- Anonymous mode recommended (no real names without consent).
- No invasive analytics (prefer Matomo self-host if needed).

### 3. WebRTC

- Encryption **built-in (DTLS-SRTP)** → secure exchanges.
- **Sensitive logs** (IDs, names) must not be persisted on client.

---

## 🛠️ Workflows

### 1. Development

```bash
bun dev            # Start Next dev server
bun run lint       # Check code with Biome
bun run format     # Format code
```

### 2. Build & deployment

```bash
bun build          # Build Next (production)
```

→ recommended deployment on **Vercel** (native Next.js support).

### 3. P2P test

- Open `localhost:3000/create` on 2 browsers (or mobile + PC).
- Verify PeerJS connection.
- Check reconnection if one client refreshes.

### 4. PWA test

- Run `Lighthouse` (Chrome DevTools) for PWA score.
- Test installation on Android (add to home screen).
- Check iOS Safari compatibility (icon, splash, offline).

---

## 📌 Best Practices

- **Version** configs (`tailwind.config.ts`, `biome.json`, `tsconfig.json`).
- **Clear route names** (`/create`, `/join/[id]`).
- **Fallback plan** if PeerJS Cloud goes down (self-host PeerServer).
- **Limit URL size** (~2–4 KB reliable). Don’t store too much in it.
- **Images**:
  - Accept only safe formats (png/jpg/webp).
  - Resize client-side to avoid OOM.
- **Accessibility**: focus, ARIA, keyboard support.
- **Test multi-devices**: Android, iOS, desktop.

## 🧭 Code Quality & Architecture

- **Maximize clarity**: prefer explicit, well-named modules, types, and functions so that intent is obvious without reading implementation details.
- **Split responsibilities**: isolate business and computational logic in dedicated hooks, services, or utility modules rather than UI components.
- **Thin components**: React components must stay as small as possible, receiving a minimal number of props and delegating complex work to extracted helpers.
- **Composable building blocks**: compose the UI from multiple focused components instead of a single large one; each component should address one concern and expose a concise interface.
- **Shared logic**: when logic is reused, centralize it in strongly typed, documented modules to avoid duplication and ease testing.
- **Testing mindset**: design logic modules to be easily testable (pure functions, deterministic helpers) while keeping presentational layers simple.

---

## 🚨 Risks & Pitfalls

- **Strict NATs** → TURN required (otherwise no connection).
- **URL length limit** (~2–4 KB safe). Don’t bloat.
- **CORS** blocks direct scraping of Facebook/Twitter. Only Wikipedia works reliably client-side.
- **Service Worker** may break hot reload in dev → disable locally.
- **iOS Safari**: limited PWA features (no push notifications, WebRTC memory restrictions).

---

## ✅ Summary

This project is designed to run **without any central server** except for mandatory signaling (PeerJS cloud or self-hosted).  
Game state is fully synchronized via **P2P channels**.  
PWA ensures installation on mobile/desktop, and Biome keeps code consistent.

---
