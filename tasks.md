# 🚀 CKI — Development Tasks for Codex

This document provides structured prompts for GPT-5 Codex to develop the **CKI** project (a P2P “Guess Who?” game).  
Each step must be implemented sequentially.  
At every step: follow **best practices, strong TypeScript typing, accessibility, responsiveness, and clean architecture**.

---

## 1) Project baseline & tooling

**Goal**: Clean Next.js base with Bun, Tailwind, shadcn/ui, Biome.

**Tasks**:

- Initialize Next.js (App Router, TS, `src/` structure).
- Configure Tailwind (`tailwind.config.ts`, `globals.css`).
- Initialize shadcn/ui and add a basic `Button`.
- Setup Biome (`biome.json`, lint/format scripts).
- Setup alias `@/*`.

**Deliverables**:

- `package.json` scripts (`dev/build/lint/format`)
- `tailwind.config.ts`, `postcss.config.js`
- `biome.json`
- `src/app/layout.tsx`, `src/app/globals.css`

**DoD**:

- `bun dev` runs successfully.
- Linter/formatter commands work.
- Homepage renders a minimal shadcn “Button”.

---

## 2) App shell, theme & navigation

**Goal**: Generic app layout + dark/light theme.

**Tasks**:

- Create global layout (header/footer).
- Implement `ThemeProvider` with dark/light toggle.
- Add responsive container.
- Use shadcn components: `button`, `card`, `dialog`, `toast`, `sheet`, `tabs`, `separator`.

**Deliverables**:

- `src/components/ui/*` (shadcn components)
- `src/components/app/Header.tsx`
- `src/components/app/ThemeProvider.tsx`

**DoD**:

- Navigation works with routes `/`, `/create`, `/join`.
- Keyboard and mobile accessible.

---

## 3) Domain model & state machine

**Goal**: Deterministic, typed, validated game logic.

**Tasks**:

- Define types: `Card`, `Grid`, `GameState`, `Player`, `Action`, `Message`.
- Add Zod schemas for runtime validation.
- Implement pure reducers (FSM: `idle → lobby → playing → finished`).
- Define rules (turn-based, flip, guess).

**Deliverables**:

- `src/lib/game/types.ts`
- `src/lib/game/schema.ts`
- `src/lib/game/state.ts` (reducers, selectors)

**DoD**:

- Reducer unit tests pass.
- Idempotent actions, valid/invalid transitions tested.

---

## 4) Grid editor & invitation flow

**Goal**: Create a game locally and generate an invite link.

**Tasks**:

- Page `/create` with form (rows/cols, cards).
- Image import (URL/public/local) with CORS validation.
- Preview with `skeleton`.
- Encode board state into LZ + Base64 token in URL fragment.
- Page `/join` parses the token and reconstructs state.

**Deliverables**:

- `src/app/create/page.tsx`
- `src/components/editor/*`
- `src/lib/share/url.ts` (encode/decode LZ+Base64)
- `src/app/join/page.tsx`

**DoD**:

- A grid can be created.
- Invite link is generated.
- `/join` rebuilds the game state locally.

---

## 5) P2P layer (PeerJS) & connection lifecycle

**Goal**: Establish host ↔ guest connection with DataChannel.

**Tasks**:

- Wrapper for PeerJS (`createPeer`, `connect`, `events`).
- Handle retries, timeouts, ICE restart, heartbeats.
- Version/protocol negotiation.
- Build typed event system.

**Deliverables**:

- `src/lib/p2p/peer.ts`
- Hooks: `usePeerHost()`, `usePeerGuest()`
- Typed events: `Message<T>`
- Connection UI states: connecting/connected/reconnecting/error

**DoD**:

- Two local tabs can connect.
- Typed ping/pong exchange works.

---

## 6) Sync model: snapshot + action log

**Goal**: Robust synchronization of game state.

**Tasks**:

- On connect: host sends full `GameState` snapshot → guest ACK.
- After sync: exchange actions (`flip/ask/guess/reset`) with IDs + timestamps.
- Deduplicate actions, replay log on desync.

**Deliverables**:

- `src/lib/p2p/protocol.ts` (types, versions)
- `src/lib/game/sync.ts` (applySnapshot, applyAction, journal)

**DoD**:

- Two-player game works.
- States remain coherent.
- Resync works after guest refresh.

---

## 7) Persistence & assets handling

**Goal**: Persist boards & images locally and secure canvas rendering.

**Tasks**:

- Use IndexedDB (idb) for board/party storage.
- Import images → resize/encode via WebWorker.
- Handle `crossOrigin` / tainted canvas.
- Placeholders with `skeleton`.

**Deliverables**:

- `src/lib/storage/db.ts`
- `src/workers/image.ts`
- `src/components/common/ImageSafe.tsx`

**DoD**:

- Reload restores last config.
- Heavy images optimized.
- No UI blocking.

---

## 8) PWA & production hardening

**Goal**: Installable, offline-friendly, production ready.

**Tasks**:

- Add manifest + icons.
- Add Service Worker (cache SWR + versioning).
- Offline fallback page.
- Error guards (P2P errors, toasts).
- Lighthouse score ≥ 90 (PWA/Perf/A11y/Best Practices).

**Deliverables**:

- `public/manifest.json`
- `public/icons/*`
- `src/app/offline/page.tsx`
- Service Worker (`workbox` or `next-pwa`)
- Deployment guide (Vercel)

**DoD**:

- Installable on Android/iOS/Desktop.
- Offline page works.
- Production build OK.
- Lighthouse scores validated.

---

## (Optional) 9) Resilience+: PeerServer/TURN & telemetry

**Goal**: Handle strict NATs and basic diagnostics.

**Tasks**:

- Setup TURN (coturn) & optional self-hosted PeerServer.
- Add anonymous metrics (latency, ICE failures) locally or via privacy proxy.

**DoD**:

- Connections succeed on difficult networks.
- Minimal error logs available.

---
