# Landing Page & Marketing Site

> **For LLMs**: The marketing site lives in `src/app/(marketing)/`. It uses context-aware CSS variables (`--ctx-*` in `globals.css`) for theming, reusable components (`SectionHeader`, `LandingCard`, `CtaButton`), and forces light theme regardless of user preference. All sections are static — no API calls, no auth required. See [Color System](./index.md#color-system) for the full theming architecture.

---

## Overview

The landing page is a single-page marketing site at `/` with 9 sections: Hero, Features, Stats, Mobile-first, How it works, Industries, Pricing, Trust, FAQ, and CTA. It redirects authenticated users to `/research`.

**Color system**: All colors use Tailwind utilities generated from CSS variables (`text-ctx-primary`, `bg-ctx-soft`, etc.). See [Color System](./index.md#color-system).

---

## Architecture

```
src/app/(marketing)/
├── page.tsx              # Landing page (all sections)
├── layout.tsx            # Forces light theme via useEffect

src/components/landing/
├── (deleted: colors.ts)  # Replaced by --ctx-* CSS variables in globals.css
├── index.ts              # Barrel exports
├── landing-data.ts       # Static data: features, pricing, FAQ, nav items, etc.
├── motion-utils.ts       # fadeUp() — currently no-op (animations disabled)
├── SectionHeader.tsx     # Reusable section title + subtitle
├── LandingCard.tsx       # Reusable card (light/soft/dark variants)
├── CtaButton.tsx         # Animated gradient CTA button
├── GradientCanvas.tsx    # Canvas-based animated gradient background
├── LandingNav.tsx        # Desktop nav orchestrator (mega menu + mobile)
├── NavBar.tsx            # Top nav bar (logo, links, hamburger)
├── MegaMenuPanel.tsx     # Dropdown mega menu
├── MobileMenu.tsx        # Full-screen mobile navigation
├── LandingFooter.tsx     # Footer with column links
├── SubscribeForm.tsx     # Email subscribe input
├── FeatureShowcase.tsx   # Interactive feature demo canvas
├── Backdrop.tsx          # Overlay behind mega menu
├── icons.tsx             # ArrowRightIcon, ChevronDownIcon, AppleIcon
└── hooks/
    └── use-mega-menu.ts  # Mega menu open/close/hover logic
```

---

## Color System

Colors are context-aware CSS variables defined in `src/app/globals.css` and registered with Tailwind v4 via `@theme inline`. See [Color System](./index.md#color-system) for the full reference.

**Usage in components**: Use Tailwind utilities like `text-ctx-primary`, `bg-ctx-soft`, `border-ctx-line`. Never hardcode hex colors. Never import `colors.ts` (deleted).

---

## Reusable Components

### SectionHeader

Renders a section title with optional label and subtitle.

```tsx
<SectionHeader
  label="Mobile-first" // Optional uppercase label
  title="Built for your pocket." // Bold heading
  subtitle="Every feature is designed..." // Muted body text below title
/>
```

### LandingCard

Renders a content card with title, description, and optional badge. Supports 3 variants.

| Variant | Background               | Border   | Text  | Use case                     |
| ------- | ------------------------ | -------- | ----- | ---------------------------- |
| `light` | White                    | Gray     | Dark  | Features, industries         |
| `soft`  | `#f6f9fc`                | Gray     | Dark  | Mobile features              |
| `dark`  | `rgba(255,255,255,0.05)` | White/10 | White | How-it-works (dark sections) |

```tsx
<LandingCard
  title="AI Chat"
  description="..."
  badge="Core"
  variant="light"
  index={0}
/>
```

### CtaButton

Animated gradient button with flowing red-pink colors. Uses `landing-gradient-btn` CSS class.

```tsx
<CtaButton onClick={login} className="w-full" showArrow={false}>Sign In</CtaButton>
<CtaButton href="/login/redirect">Get started free</CtaButton>
```

### GradientCanvas

Canvas-based animated gradient background with flowing color blobs. Used on the login page.

- 6 color blobs (purple, pink, red, amber, deep pink, indigo)
- Sinusoidal wobble + pulsing radius + oscillating opacity
- Fades in over 1.5s via React state + CSS transition
- Handles resize and DPR scaling

---

## CSS Animations

All gradient animations in `globals.css`:

| Class                          | Animation                                | Duration   |
| ------------------------------ | ---------------------------------------- | ---------- |
| `.landing-gradient-btn`        | Left-to-right gradient flow              | 30s linear |
| `.landing-hero-title-accent`   | Left-to-right gradient flow (text)       | 30s linear |
| `.landing-gradient-text-light` | Left-to-right gradient flow (light text) | 30s linear |

Keyframe: `landing-gradient-flow` — `background-position: 300% → 0%`

---

## Theme Management

Marketing pages force light theme via 3 mechanisms:

1. **CSS default**: `:root` maps to light theme variables (dark requires `.dark` class)
2. **Inline script** (`layout.tsx`): Sets `data-theme` before first paint
3. **Marketing layout** (`(marketing)/layout.tsx`): `useEffect` forces light, restores on unmount
4. **Theme store** (`theme.store.ts`): Skips `applyTheme()` on light-theme routes
5. **ThemeInit**: Skips re-apply on light-theme routes

Route checks are centralized in `src/lib/is-marketing-route.ts`:

- `isLightThemeRoute()` — used by theme store + ThemeInit
- `NAVBAR_HIDDEN_PATHS` — used by NavbarWrapper

---

## Mobile Navigation

The mobile menu:

- Renders below the NavBar (not a separate overlay with its own header)
- Uses `z-40` (below nav's `z-50`) with `paddingTop: 60px`
- Locks body scroll when open (`overflow: hidden`)
- Releases scroll lock on resize past 768px (for dev convenience)
- Hamburger/X toggle is in the NavBar component itself

---

## Invariants

- **No `eslint-disable`** — fix the underlying issue
- **Semantic class names** on all elements (e.g., `landing-hero-title`, `landing-card-badge`)
- **All data** in `landing-data.ts` — no inline arrays in JSX
- **Colors** via `text-ctx-*` / `bg-ctx-*` / `border-ctx-*` Tailwind utilities — no hardcoded hex in components
- **Animations** disabled by default (`fadeUp` is a no-op) — for instant page load
