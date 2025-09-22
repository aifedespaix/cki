# KeyS UX Changes Brief

_Last updated: 2025-09-22 by product UX agent._

This brief documents the immediate UX adjustments agreed with design and engineering. It combines guiding principles, codified tokens, structural wireframes, and copy direction so that implementation can start without further clarification.

## 1. Design Principles

1. **Trust the host.** Highlight actions that protect privacy (local storage, P2P) and keep host setup clear. Every decision point should state the resulting visibility to guests.
2. **Win the turn.** Reinforce whose turn it is through motion, color, and placement; spectators must instantly read the active state.
3. **Progress is precious.** Autosave, draft recovery, and connection feedback must be surfaced visually and verbally to avoid silent data loss.
4. **Mobile-first clarity.** Ensure layouts collapse gracefully to single-column without hiding critical actions. Components must remain tappable with 44 px minimum targets.
5. **Accessible energy.** Maintain playful energy (microcopy, icons) while preserving WCAG 2.2 AA contrast, focus management, and reduced motion affordances.

## 2. Component Tokens

These tokens are the implementation contract for the shared component library. Engineers should expose them through Tailwind CSS variables (already declared in [`src/app/globals.css`](../src/app/globals.css)). Designers should reference the same names in Figma.

### 2.1 Color Tokens

| Token | Light Theme | Dark Theme | Primary Usage |
| --- | --- | --- | --- |
| `--background` | `oklch(1 0 0)` | `oklch(0.141 0.005 285.823)` | App background, neutral canvas |
| `--foreground` | `oklch(0.141 0.005 285.823)` | `oklch(0.985 0 0)` | Default text color |
| `--primary` | `oklch(0.21 0.006 285.885)` | `oklch(0.92 0.004 286.32)` | Primary CTAs, active turn highlights |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.21 0.006 285.885)` | Text/icon on primary surfaces |
| `--secondary` | `oklch(0.967 0.001 286.375)` | `oklch(0.274 0.006 286.033)` | Secondary buttons, info banners |
| `--accent` | `oklch(0.967 0.001 286.375)` | `oklch(0.274 0.006 286.033)` | Focused board tiles, hover states |
| `--muted` | `oklch(0.967 0.001 286.375)` | `oklch(0.274 0.006 286.033)` | Placeholder tiles, skeletons |
| `--muted-foreground` | `oklch(0.552 0.016 285.938)` | `oklch(0.705 0.015 286.067)` | Secondary text, helper copy |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Error banners, destructive buttons |
| `--border` | `oklch(0.92 0.004 286.32)` | `oklch(1 0 0 / 10%)` | Dividers, cards |
| `--ring` | `oklch(0.705 0.015 286.067)` | `oklch(0.552 0.016 285.938)` | Focus outlines, active tiles |
| `--chart-1…5` | See globals | See globals | Game stats visualizations |
| `--sidebar-*` | See globals | See globals | Player drawer backgrounds |

Implementation notes:
- Keep minimum contrast ratio 4.5:1 for text. For low-contrast backgrounds (e.g., `--muted`), always pair with `--foreground` or `--muted-foreground` depending on emphasis.
- When elevating the active board, blend `--primary` at 12% opacity behind the board container, then reinforce with a `--ring` outline.

### 2.2 Spacing Tokens

Adopt Tailwind’s base scale (1 → 0.25 rem / 4 px). Key checkpoints for shared layouts:

| Token | Value | Usage |
| --- | --- | --- |
| `space-2` | 0.5 rem (8 px) | Compact gaps inside buttons, chips |
| `space-3` | 0.75 rem (12 px) | Form field vertical spacing |
| `space-4` | 1 rem (16 px) | Default stack spacing in cards |
| `space-6` | 1.5 rem (24 px) | Section separation on `/create` |
| `space-10` | 2.5 rem (40 px) | Page-level breathing room on desktop |

Rules: never exceed `space-12` (3 rem) inside dialogs to preserve focus; collapse to `space-4` max under 640 px.

### 2.3 Typography Tokens

| Token | Spec | Usage |
| --- | --- | --- |
| `font-sans` | Geist Sans, fallback `system-ui` | All UI text |
| `font-mono` | Geist Mono | Token strings, debug info |
| Heading scale | `text-4xl` (2.25 rem, 600), `text-3xl` (1.875 rem, 600), `text-2xl` (1.5 rem, 600) | Hero, section titles |
| Body scale | `text-base` (1 rem, 400), `text-sm` (0.875 rem, 500) | Copy paragraphs, form help |
| Caption | `text-xs` (0.75 rem, 500) | Badges, metadata |

Line height defaults follow Tailwind’s leading. Increase to `leading-7` on paragraphs longer than two sentences.

### 2.4 Focus & Interaction

- Always use `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` on interactive elements outside cards.
- Within cards/boards, use `focus-visible:outline-none` and rely on `ring` plus elevated shadow to avoid double outlines.
- Provide keyboard shortcuts with explicit hints (e.g., “Appuyez sur `R` pour brasser la grille”) and ensure they are toggleable for accessibility.
- Maintain 44 × 44 px hit targets; add `min-h-11` classes to icon-only buttons.

### 2.5 Motion Tokens

| Token | Duration | Easing | Usage |
| --- | --- | --- | --- |
| `motion-fast` | 150 ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Button hover, icon micro-movements |
| `motion-medium` | 220 ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Drawer/panel entrances |
| `motion-slow` | 320 ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Modal scale + fade |

Respect reduced-motion preference: disable non-essential translate/scale and fall back to opacity fades.

## 3. Textual Wireframes

Textual wireframes describe the content and interaction stack. Use them as acceptance criteria when translating to high-fidelity mockups or React components.

### 3.1 `/create` Page

1. **Sticky header (mobile) / inline breadcrumb (desktop)**
   - Left: app wordmark linking to `/`.
   - Right: text button “Besoin d’aide ?” opening a documentation modal.
   - Sticky under 640 px, static otherwise.
2. **Hero block** (`space-y-5`, max width 720 px)
   - Pill label with `SparklesIcon` → “Configuration de la grille”.
   - `h1`: “Créez votre plateau KeyS personnalisé”.
   - Paragraph emphasising privacy and instant sharing.
   - Feature bullets row (grid dimensions, image sourcing, autosave cue). Collapses to stacked list on mobile.
3. **Identity form card**
   - Label: “Votre pseudo…”. Input with inline validation message (see copy guidelines).
   - Helper text explaining visibility of the pseudo.
4. **Grid editor canvas**
   - Left column (desktop ≥1024 px): controls stack — dimension selectors, tile list, randomize, import/export.
   - Right column: live grid preview with ghost tile for add state. On mobile, controls collapse into accordions above the grid.
   - Persistent autosave toast anchored bottom-left when draft restored.
5. **System feedback row**
   - Error banner slot above CTA; success toast triggered after local persistence.
6. **Primary action row**
   - Button “Démarrer la partie”.
   - Secondary text link “Exporter le plateau” opens share dialog when grid valid.
   - Loading state replaces label with “Création de la salle…” and shows spinner.

### 3.2 Game Screen (`/room/[roomId]`)

1. **Header bar**
   - Left: room name (fallback “Salle KeyS”) with badge for connection status (`connecté`, `reconnexion`, `erreur`).
   - Center (desktop only): turn timer chip with `TimerIcon` when timer active.
   - Right: icon buttons (Invite, Participants, Règles) + dropdown for settings.
   - On mobile, collapse into overflow menu except for Invite.
2. **Players panel sheet** (slide-over from right on desktop, bottom sheet on mobile)
   - Summary cards for Host, Guest, Spectators.
   - Each card: avatar placeholder, nickname, readiness toggle, connection indicator, role badge.
   - Spectators list scrolls with `max-h-[60vh]` and alphabetical order.
   - Close affordance anchored top-right with accessible label.
3. **Boards layout**
   - Two-column grid on desktop (`md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`, gap `space-6`). Active player board emphasised with primary halo + subtle scale (1.02) when it becomes their turn.
   - Local player board pinned left on desktop, top on mobile.
   - Each board card header: player name + turn badge (“Votre tour” vs “Tour adverse”).
   - Tile grid respects original dimensions, uses `aspect-square` tiles, reveals secret indicator with `TargetIcon`.
   - Empty opponent state: illustration, “En attente d’un adversaire”.
4. **Target modal** (Dialog triggered via action button)
   - Title: “Sélectionner une cible”.
   - Step list: choose opponent tile → confirm → broadcast message.
   - Grid preview 3 columns, uses same tile component as board but in compact mode.
   - Footer: destructive button “Annuler”, primary button “Valider la cible”.
5. **Turn bar** (anchored bottom, full-width)
   - Left: textual status (“À vous de jouer”, “Patientez…”, “Victoire !”).
   - Center: action buttons contextual to role (e.g., “Brasser le paquet”, “Marquer comme trouvé”).
   - Right: network feedback dot + tooltip for latency.
   - On mobile, convert to sticky bottom sheet with safe-area padding.

## 4. Copy Guidelines

- **Tone:** Friendly, confident, transparent about peer-to-peer privacy. Use present tense and second person plural (“vous”).
- **CTA labels:** Begin with verbs (“Démarrer la partie”, “Partager l’invitation”, “Rejoindre la salle”). Avoid ambiguous nouns.
- **Error messages:** Explain the issue + action. Format: “<Cause>. <Action>.” Example: “Impossible d’enregistrer la préparation de partie. Réessayez dans quelques instants.”
- **Success feedback:** Celebrate progress lightly, no exclamation overload. Example: “Salle prête. Copiez le lien pour inviter vos amis.”
- **Tooltips:** Keep under 60 characters. Use them for clarifying network states and keyboard shortcuts.
- **Localization:** All customer-facing text stays in French, except technical tokens (IDs) displayed in monospace. Provide translation keys when adding new strings to maintain i18n parity.

## 5. Implementation Checklist

- [ ] Update shared `ThemeProvider` or Tailwind config if any token values change; keep light/dark parity.
- [ ] Adjust `/create` layout according to Section 3.1, ensuring responsive breakpoints at 640 px and 1024 px.
- [ ] Implement board emphasis and turn bar structure from Section 3.2, verifying focus order with keyboard-only navigation.
- [ ] Wire copy updates following Section 4, including validation and toast messages.
- [ ] Add motion tokens to utility classes or CSS variables, respecting reduced-motion preferences.
- [ ] QA on mobile Safari and Chromium desktop to validate spacing, focus, and motion contracts.
