# Solara UI Layout Map

## 1) Global Layout & Shell
- **Root shell**: `app/layout.tsx` loads global fonts (Inter sans, Crimson Pro serif) and wraps all pages with `SettingsProvider`. Global styles come from `app/globals.css`.
- **Protected shell**: `app/(protected)/layout.tsx` does server auth/membership/onboarding guard, then renders `<NavBar />`, `<main className="pt-20 min-h-screen">…</main>`, `<Footer />`. Public shell (`app/(public)/layout.tsx`) uses the same NavBar/Footer pattern.
- **Nav/Footers**: `components/layout/NavBar.tsx` is a fixed, translucent top bar with “pill” links and language switcher; `components/layout/Footer.tsx` is a simple gradient footer strip.
- **Spacing & width**: Pages typically use `max-w-7xl mx-auto px-6` and vertical padding ~`py-12` for protected views; public hero uses `max-w-5xl`.
- **Background treatment**: `body` in `globals.css` applies a warm gradient plus Tailwind utilities; fixed NavBar uses `bg-white/80` with border and blur.

## 2) Key Screens & Layout Patterns
- **Sanctuary insights** (`app/(protected)/sanctuary/page.tsx`):
  - Layout: two-column on lg (`grid lg:grid-cols-3 gap-6`) with left 2/3 narrative cards and right 1/3 widgets (Lucky Compass, journal). Uses many `Card` components (shadcn-style) with serif headings and micro-labels.
  - Building blocks: `SanctuaryTabs`, `TimeframeToggle`, `GreetingCard`, cards with headings, dividers, pill utilities, micro-labels. Consistent card usage but lots of bespoke text blocks.
- **Birth chart** (`app/(protected)/sanctuary/birth-chart/page.tsx`):
  - Layout: `grid gap-6 lg:grid-cols-[1.618fr,1fr]` (narrative left, technical sidebar right). Sidebar lists snapshot, planets, houses. Similar card stack to insights but direct `<div>` containers; still follows rounded/bordered panels.
  - Building blocks: reuses `SanctuaryTabs`; cards implemented inline (not extracted), houses/planets as list items with Tailwind utilities.
- **Connections** (`app/(protected)/sanctuary/connections/page.tsx`):
  - Layout: single-column stack with cards for primary connection insight and list; uses similar card styling and pills for tags/status.
- **Settings** (`app/(protected)/settings/page.tsx`):
  - Layout: single-column centered container `max-w-4xl`, large card with spaced sections. Uses `Input`, `Label`, `Button` primitives and grid for form fields. Clear section headers.
- **Public home** (`app/(public)/page.tsx` + `components/home/*`):
  - Layout: stacked sections (hero, zodiac grid, path). Hero is centered single-column, uses `TogglePills` and CTA. Zodiac grid uses card grid; styling consistent with pills/micro-labels.

Patterns: Cards, micro-label text, pill buttons, serif headings, and consistent `max-w-*` containers are common. Differences: some pages use shadcn `Card` component; others use plain div with Tailwind utilities, leading to slight fragmentation of card spacing/shadow.

## 3) Styling Strategy (Tailwind, globals, tokens)
- **Tailwind-first**: Most styling via Tailwind utilities in JSX.
- **Globals** (`app/globals.css`):
  - Defines shadcn CSS variables, sets background gradient, sets serif for headings, and utilities: `.micro-label`, `.gradient-*`, `.card-shadow`, `.pill`, `.text-balance`, scrollbar styling.
- **Theme tokens** (`tailwind.config.ts`):
  - Custom palette (body/shell/accent-ink/gold/muted/etc.), shadcn-compatible color slots, radii driven by CSS variable `--radius`, font families mapped to CSS vars, micro letter spacing, extended line-height.
- **Components**:
  - Uses shadcn UI primitives (`Card`, `Button`, `Input`, etc.) in some pages; others roll their own containers. No CSS modules; styling is all utilities + globals.
- **Legacy/inline**: Minimal inline styles; mostly utilities. No separate `styles/*.css` found.

## 4) Beautification Landmines & Opportunities
- Landmine: **Card fragmentation** — some pages use shadcn `Card`, others plain divs with similar borders/shadows; spacing and padding vary slightly.
- Landmine: **Hard-coded sizing** — repeated `max-w-7xl`/`max-w-5xl`, `px-6`, `py-12` sprinkled inline; unifying wrappers would ease global spacing changes.
- Landmine: **Fixed NavBar height assumptions** — main content uses `pt-20`; any navbar height change could require sweeping updates.
- Landmine: **Responsiveness** — layouts rely on `lg:grid` splits but minimal intermediate breakpoints; sidebar cards may stack abruptly on tablet without custom spacing adjustments.
- Landmine: **Pill variants** — multiple pill usages with slight differences (bg gradients vs bordered vs dark); no single “nav pill”/“action pill” taxonomy.
- Nice: **Tokens in Tailwind** (color, radius, fonts) and **globals** for micro-label/pill give a foundation for theming; background gradient already centralized.
- Nice: **Consistent serif heading + sans body** across pages; cohesive visual voice.

## 5) Suggested Beautification Roadmap (High-Level)
- Establish shared layout primitives:
  - `PageContainer` (max width + px + pt offset), `SectionGrid` (common two/three-column responsive patterns), `SectionHeader` (title + micro-label).
  - `Card` variants: `SectionCard` (default padding/shadow), `SidebarCard`, `HeroCard` to replace ad-hoc divs.
- Normalize navigation + spacing:
  - Wrap main content with a standard top-offset class tied to NavBar height; avoid repeated `pt-20`.
  - Define spacing scale tokens for vertical rhythm (section gap, card gap) and apply via a few wrapper classes.
- Standardize pills/buttons:
  - Create a small set of pill styles (primary gradient, secondary outline, neutral) and reuse across NavBar, tabs, toggles.
- Responsive polish:
  - Audit `lg:grid` layouts for tablet breakpoints (e.g., `md:grid-cols-...`, consistent gaps/margins when stacking).
- Prioritize unification where reuse is highest:
  1) Sanctuary + Birth Chart sidebars/cards (shared patterns).
  2) NavBar/pills/tabs system.
  3) Settings + Connections forms/cards.
  4) Public home cards/grids to match the same card/pill system.

