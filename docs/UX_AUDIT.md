# C ki ? UX Audit

_Last updated: 2025-09-22 by UX review agent._

## Callout Index
The following textual callouts reference the live UI and correspond to major observations discussed throughout this audit.

- **Callout A — Home hero CTA (Home, [`src/app/page.tsx`](../src/app/page.tsx))**: Primary "Démarrer une partie" action with security reassurance copy and dual CTA layout.
- **Callout B — "Routine express" workflow card (Home, [`src/app/page.tsx`](../src/app/page.tsx))**: Tabs switching between animateur/invité guidance with contextual bullet lists.
- **Callout C — Pseudo input block (Create, [`src/app/create/page.tsx`](../src/app/create/page.tsx))**: Required host nickname form field with validation helper text.
- **Callout D — Grid editor preview (Create, [`src/components/editor/GridEditor.tsx`](../src/components/editor/GridEditor.tsx))**: Editable grid layout with card tiles, draft restoration, and random generation tools.
- **Callout E — Start error banner (Create, [`src/app/create/page.tsx`](../src/app/create/page.tsx))**: Inline destructive alert shown when prerequisites fail before launching a room.
- **Callout F — Invitation decoding form (Join, [`src/app/join/page.tsx`](../src/app/join/page.tsx))**: Dual-button action row with validation feedback and privacy reassurance copy.
- **Callout G — Imported grid preview empty state (Join, [`src/app/join/page.tsx`](../src/app/join/page.tsx))**: Dashed placeholder card explaining how to populate the preview.
- **Callout H — Invite dialog (Room, [`src/app/room/[roomId]/page.tsx`](../src/app/room/%5BroomId%5D/page.tsx))**: Modal with shareable link, clipboard status, and join-as-player flow.
- **Callout I — Participants dialog (Room, [`src/app/room/[roomId]/page.tsx`](../src/app/room/%5BroomId%5D/page.tsx))**: Real-time roster, readiness badges, and spectator list accessible from the toolbar.
- **Callout J — Player board cards (Room, [`src/app/room/[roomId]/page.tsx`](../src/app/room/%5BroomId%5D/page.tsx))**: Interactive grid with visibility toggles, secret-card badges, and turn messaging.
- **Callout K — Missing opponent placeholder (Room, [`src/app/room/[roomId]/page.tsx`](../src/app/room/%5BroomId%5D/page.tsx))**: Dismissible panel displayed until the guest connects.
- **Callout L — Final result card (Room, [`src/app/room/[roomId]/page.tsx`](../src/app/room/%5BroomId%5D/page.tsx))**: Victory summary banner detailing the decisive guess and turn number.

---

## Information Architecture

### Strengths
- **Callout A** clarifies the product’s two primary tasks (créer vs. rejoindre) directly on the landing surface, with supporting text explaining privacy promises.
- **Callout B** groups workflow education in a single card, reducing navigation depth—players do not have to dig into nested pages to understand their responsibilities.
- Toolbar affordances on the room screen (**Callout H** and **Callout I**) keep critical multiplayer actions one click away without forcing a page transition.

### Risks & Opportunities
- The application lacks a persistent global navigation element once users leave the home page. Consider a lightweight header with breadcrumbs or links back to the landing shortcuts so a confused guest can recover.
- Add a visible route to documentation or rules; currently the hero copy references audio briefings but there is no static "Règles" or "Aide" destination.

---

## Onboarding Flow

### Strengths
- Host onboarding is linear: **Callout C** collects the only mandatory identity input before exposing the robust grid tooling (**Callout D**).
- Guest onboarding through **Callout F** supports both full URLs and bare tokens, auto-persisting the decoded grid (**Callout G** updates as soon as a valid payload is parsed).
- The room invite flow (**Callout H**) explains each step, from generating the link to confirming the joining role, minimizing guesswork for both hosts and guests.

### Risks & Opportunities
- The create flow surfaces validation errors via **Callout E**, but the CTA remains in the same place regardless of error type; consider inline guidance near the problematic section (e.g., highlight invalid cards) to shorten troubleshooting.
- Joining as a player from **Callout H** requires re-entering a nickname even if the user just created one on the join page; support pre-filling from prior context or URL parameters.

---

## Cognitive Load

### Strengths
- The landing card tabs (**Callout B**) present role-specific steps sequentially, preventing information overload compared to showing both personas simultaneously.
- Grid editing (**Callout D**) balances configurability (dimension controls, per-card dialogs) with preview fidelity, keeping actions discoverable without deep menus.
- Turn messaging layered onto player boards (**Callout J**) tells users exactly what interaction is currently expected.

### Risks & Opportunities
- The room screen exposes numerous dialogs (Invite, Participants, Infos); stacking multiple modals can overwhelm new hosts. Explore progressive disclosure such as side panels or inline accordions for the most-used data.
- Draft restoration in **Callout D** occurs silently. Provide a toast or inline note indicating that saved work has been recovered to prevent doubt about the current state.

---

## Visual Hierarchy

### Strengths
- **Callout A** uses typography and iconography to draw attention to the primary CTA, with the security reassurance placed directly underneath to build trust.
- Within **Callout J**, status badges (tour en cours, prêt, rôle) employ color-coded pills to differentiate state at a glance.
- The dashed placeholder styling in **Callout G** quickly communicates inactivity compared with the solid cards that appear once a grid is imported.

### Risks & Opportunities
- In the room layout, both player boards carry similar visual weight; highlight the active board (**Callout J**) more aggressively (e.g., glow, elevated shadow) so spectators instantly know whose turn it is.
- The final result banner (**Callout L**) is visually strong but may compete with persistent controls; ensure it anchors near the top of the column to avoid pushing critical actions below the fold on smaller screens.

---

## Feedback & Status Communication

### Strengths
- Error handling patterns are consistent: **Callout E** and **Callout F** use bordered, colored alerts with descriptive copy and icons.
- **Callout H** communicates clipboard status transitions (copié / erreur) and uses ARIA live regions for assistive clarity.
- Player readiness and turn status appear inline on badges in **Callout J**, reducing the need to open separate dialogs to check readiness.

### Risks & Opportunities
- There is no explicit progress indicator during room initialisation; when a host creates a room, the CTA label changes but the rest of the page remains static. Consider a blocking spinner or skeleton to signal the pending navigation.
- Add retry affordances when peer connectivity fails (e.g., expose a "Réessayer" button inside **Callout I** when the phase becomes `error`).

---

## Forms UX

### Strengths
- **Callout C** enforces required input with immediate validation on blur and explains the intent of the pseudo.
- **Callout F** and **Callout H** pair primary actions with outline reset/alternate actions, reducing the chance of accidental destructive behavior.
- Inputs leverage generous padding and responsive stacking, supporting mobile ergonomics noted in the hero copy.

### Risks & Opportunities
- Token fields in **Callout F** and the invite link in **Callout H** expose long strings without chunking. Consider monospace segmentation or copy-to-clipboard hints for manual workflows when clipboard access fails.
- Provide contextual formatting help for image URLs in **Callout D**’s image dialog (e.g., accepted formats, size guidance) to avoid upload frustration.

---

## Game Screen Roles & Collaboration

### Strengths
- **Callout I** clearly separates host/guest statuses and surfaces spectator counts, reinforcing social context.
- **Callout J** dynamically adapts controls depending on the viewer’s role (toggle vs. select interactions) and labels the local player.
- **Callout K** keeps hosts informed when no opponent is present, preventing silent waiting.

### Risks & Opportunities
- Spectators currently inherit the host-centric perspective; provide a dedicated spectator summary (e.g., condensed both boards) so they can follow play without guessing whose cards they see.
- Clarify which actions are broadcast vs. local (e.g., toggling cards while spectating); a small legend near **Callout J** could prevent accidental state changes.

---

## Grid Usability

### Strengths
- **Callout D** offers range-limited numeric inputs (2–8) and auto-manages card counts, ensuring grid integrity.
- Preview components share consistent tile styling between the editor and live board, reinforcing mental models.
- Autosave and restoration (draft load within **Callout D**) protect user investment across sessions.

### Risks & Opportunities
- Large grids may become unwieldy due to static tile sizing; consider zoom controls or density toggles within **Callout D** and **Callout J**.
- The card image editor should surface warnings when image blobs exceed reasonable thresholds to protect performance on constrained devices.

---

## Empty, Error & Offline States

### Strengths
- The join page uses **Callout G** to teach guests what to do before data is available.
- **Callout K** fills the otherwise blank opponent column with helpful instructions.
- **Callout L** gracefully handles the end-of-game narrative, preventing the screen from feeling unfinished when play concludes.

### Risks & Opportunities
- Offline support is mentioned in product copy, but no dedicated offline route (`/offline`) exists and there are no service-worker driven fallbacks yet; add an explicit offline page and cache strategy before launch.
- Peer/network error messaging is limited to console logs; surface user-facing alerts when `connection/error` events fire so participants know to refresh.

---

## Accessibility

### Strengths
- Interactive tiles (**Callout J**) set `aria-label`/`aria-pressed` semantics, while dialogs (**Callout H**, **Callout I**) rely on accessible shadcn primitives with focus management.
- Image fallbacks throughout the editor and boards provide textual indicators when media fails, ensuring blind spots are minimised.
- Buttons include icon-only labels or paired text to satisfy WCAG name requirements.

### Risks & Opportunities
- Color-coded badges require accompanying text (which exists) but contrast between badge background and text should be verified, particularly for the sky and rose accents used in **Callout J**.
- Provide skip links or heading anchors on longer pages (e.g., create page) to support keyboard users who need to jump past dense controls.
- Ensure modals expose `aria-describedby` for error strings beyond clipboard failures so screen readers capture the full context.

---

## Performance

### Strengths
- Grid sharing relies on in-browser token encoding (`encodeGridToToken`) rather than server trips, allowing instant join previews (**Callout F** and **Callout H**).
- Images load lazily via `ImageSafe`, mitigating initial payload weight and protecting from cross-origin failures.
- State updates in **Callout J** rely on memoization and diffed sets rather than full rerenders, keeping turn interactions responsive.

### Risks & Opportunities
- Loading all card images concurrently on large boards could saturate memory. Introduce virtualization or phased loading for **Callout J** when grids exceed a threshold.
- Peer reconnection attempts happen automatically but without backoff instrumentation; add telemetry to understand connection churn and to diagnose sluggish rooms.

---

## Recommended Next Steps
1. Ship an explicit offline page and bind it to the service worker promise referenced in marketing copy.
2. Introduce contextual guidance cues (toasts or banners) for silent state changes such as draft restoration or reconnection attempts.
3. Prototype visual emphasis for the active player board and evaluate spectator readability with moderated testing.

