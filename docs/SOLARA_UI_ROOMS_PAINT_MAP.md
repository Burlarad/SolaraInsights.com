# Solara UI "Rooms" – Paint, Trim, Pain

**Purpose**: This document walks through each major screen ("room") in Solara, documenting the visual vibe (PAINT), component details (TRIM), and visual rough spots (PAIN) that will affect future beautification efforts.

**Global Context**: All rooms share a warm gradient background (`#FFF9F3 → #FFF5EB → #FCF0E8`), Inter sans body text + Crimson Pro serif headings, and a gold accent palette (`#F7C56A → #F2994A`). The NavBar is fixed with `bg-white/80 backdrop-blur`, and all protected pages offset content with `pt-20` (though this is repeated inline, not abstracted).

---

## Room: Public Landing

**File**: [app/(public)/page.tsx](../app/(public)/page.tsx)

### PAINT (overall visual vibe)
- **Background**: Inherits global warm gradient (`#FFF9F3 → #FFF5EB → #FCF0E8`)
- **Layout**: Single-column, centered hero (`max-w-5xl mx-auto px-6 py-16`) followed by stacked sections (ZodiacGrid, SolaraPath)
- **Density**: Airy – generous vertical spacing (`space-y-6`, `mb-12`, `py-16`)
- **Color story**: Warm and inviting with gold accents; minimal dark ink except for headings
- **Overall vibe**: Clean, spacious, spiritual-tech aesthetic

### TRIM (details and components)
- **Cards**:
  - ZodiacGrid likely uses card components (not visible in main page file, deferred to child components)
  - HeroSection uses no cards – just text and pills
- **Pills**:
  - `TogglePills` for "Daily Alignment" (TIMEFRAMES) and "Choose Your Experience" (EXPERIENCES)
  - Appear to use `.pill` utility (rounded-full, px-6, py-2.5)
- **Buttons**:
  - `PrimaryCTA` for "ENTER SANCTUARY" – likely uses gradient-gold button variant
- **Typography**:
  - Micro-labels: `.micro-label` (text-xs uppercase tracking-micro font-semibold text-accent-gold)
  - Headings: `text-3xl font-semibold` (serif)
  - Body: `text-base text-accent-ink/70`
- **Dividers/Structure**: No visible dividers; sections separated by vertical margin

### PAIN (room-specific visual landmines)
- **Hard-coded spacing**: `max-w-5xl`, `px-6`, `py-16`, `mb-8`, `mb-12` all inline – if we want to adjust section spacing globally, we'd need to touch multiple components
- **Pill consistency**: `TogglePills` component styling not inspected yet – may differ from NavBar pills
- **Card usage unknown**: ZodiacGrid and SolaraPath components not inspected; card patterns may diverge from protected pages
- **No responsive breakpoints visible**: Layout appears single-column throughout; tablet behavior unclear
- **CTA button styling**: `PrimaryCTA` component not inspected – may be custom styled vs using Button primitive

---

## Room: Sanctuary – Main Insights

**File**: [app/(protected)/sanctuary/page.tsx](../app/(protected)/sanctuary/page.tsx)

### PAINT (overall visual vibe)
- **Background**: Inherits global warm gradient
- **Layout**: Two-column grid on lg+ (`grid lg:grid-cols-3 gap-6`): left 2/3 narrative cards, right 1/3 widgets (Lucky Compass, journal)
- **Density**: Medium-dense – cards have good padding but many stacked in sequence
- **Color story**: Warm gradient background + white/translucent cards + gold accents for micro-labels and highlights
- **Overall vibe**: Content-heavy, magazine-style layout with distinct hierarchy

### TRIM (details and components)
- **Cards**:
  - Uses shadcn `Card`, `CardContent`, `CardHeader`, `CardTitle` throughout
  - Consistent pattern: `Card > CardHeader > CardTitle + subtitle` then `CardContent`
  - Card border-radius: `rounded-3xl` (from shadcn)
  - Card shadow: `.card-shadow` utility (0 4px 24px rgba(0,0,0,0.06))
- **Pills**:
  - `SanctuaryTabs`: pill-shaped tabs with `bg-white/50 rounded-full` container, active tab gets `bg-accent-ink text-white`
  - `TimeframeToggle`: separate component for "Today / Week / Month / Year" selection
  - Lucky Compass numbers: `pill bg-accent-muted` for number badges
  - Power Words: `pill bg-white text-accent-ink border border-border-subtle`
- **Borders/Radius/Shadows**:
  - Cards: `rounded-3xl`, `.card-shadow`
  - Dividers: `border-t border-border-subtle` for section breaks
  - Pill elements: `rounded-full`
- **Typography**:
  - Micro-labels: `.micro-label` (gold, uppercase, tracking-micro)
  - Card titles: `CardTitle` (text-2xl font-semibold serif)
  - Card subtitles: `text-sm text-accent-ink/60`
  - Body: `text-sm text-accent-ink/70 leading-relaxed`
  - Section headings: `text-lg font-medium`
- **Special components**:
  - `GreetingCard`: custom card for user greeting
  - Tarot/Rune cards: image display + narrative sections
  - Journal textarea: `rounded-lg border border-border-subtle bg-white` with focus ring
  - Dividers: `<div className="h-12 w-px bg-border-subtle" />` for Emotional Cadence sections

### PAIN (room-specific visual landmines)
- **Hard-coded layout spacing**: `max-w-7xl mx-auto px-6 py-12` inline (not abstracted)
- **Card padding inconsistency**: Some cards use default `CardContent` padding (p-6), others override with `p-8` or `p-12`
- **Pill style fragmentation**: Three different pill patterns visible:
  - Tabs: `bg-accent-ink text-white` (active) vs `bg-transparent hover:bg-white/80`
  - Number badges: `pill bg-accent-muted`
  - Power words: `pill bg-white border border-border-subtle`
- **Responsive grid**: `lg:grid-cols-3` stacks to single column on mobile – no intermediate `md` breakpoint for tablet
- **Loading states**: Custom skeleton cards with `animate-pulse` and manual `bg-accent-muted/10` – not a reusable component
- **Image sizing**: Tarot card images use `h-48`, rune images use `h-32` – arbitrary hard-coded heights
- **Timeframe label mapping**: Logic duplicated (`timeframeLabel` computed inline) – not abstracted
- **Typography hierarchy**: Multiple font sizes/weights scattered (`text-xs`, `text-sm`, `text-lg`, `text-xl`) without clear system

---

## Room: Sanctuary – Birth Chart

**File**: [app/(protected)/sanctuary/birth-chart/page.tsx](../app/(protected)/sanctuary/birth-chart/page.tsx)

### PAINT (overall visual vibe)
- **Background**: Inherits global warm gradient
- **Layout**: Golden ratio grid on lg+ (`grid gap-6 lg:grid-cols-[1.618fr,1fr]`): narrative left, technical sidebar right
- **Density**: Medium – narrative cards are spacious, sidebar is more compact
- **Color story**: Same warm gradient + translucent cards, but uses `SolaraCard` instead of shadcn `Card`
- **Overall vibe**: Clean, technical-spiritual hybrid; sidebar sticky on scroll

### TRIM (details and components)
- **Cards**:
  - **Uses `SolaraCard` component** (not shadcn `Card`!) – this is a **major divergence**
  - `SolaraCard`: `rounded-2xl border border-white/30 bg-white/60 shadow-sm backdrop-blur-sm p-5 sm:p-6`
  - Sidebar cards: same `SolaraCard` with `space-y-3`
  - Error/incomplete cards: inline divs with `rounded-xl border border-accent-soft bg-accent-soft/30 p-8`
- **Pills**:
  - `SanctuaryTabs` (same as Insights page)
  - No other pill elements visible
- **Borders/Radius/Shadows**:
  - `SolaraCard`: `rounded-2xl` (smaller than shadcn Card's `rounded-3xl`)
  - `SolaraCard`: lighter shadow (`shadow-sm` vs `.card-shadow`)
  - `SolaraCard`: uses `backdrop-blur-sm` for frosted glass effect
- **Typography**:
  - Headline: `text-xl font-semibold`
  - Section headings: `text-base font-semibold` (inside SolaraCard)
  - Micro-labels: `text-sm font-semibold tracking-wide uppercase text-accent-ink/70`
  - Body: `text-sm text-accent-ink/80 leading-relaxed whitespace-pre-line`
  - List items: `text-sm text-accent-ink/80`
- **Special components**:
  - Sidebar: `lg:sticky lg:top-28` for fixed scroll
  - HOUSE_LABELS: mapping of house numbers to ordinals + titles (inline constant)
  - Placements lists: inline `<ul>` with `space-y-1`

### PAIN (room-specific visual landmines)
- **CARD FRAGMENTATION ALERT**: Uses `SolaraCard` instead of shadcn `Card` – different border-radius, padding, shadow, and backdrop-blur
- **Card style split**: Narrative uses `SolaraCard`, but error states use inline `rounded-xl border bg-accent-soft/30 p-8` divs
- **Hard-coded spacing**: `max-w-7xl mx-auto px-6 py-12 space-y-8` inline
- **Typography inconsistency**: Micro-labels here use `text-sm tracking-wide uppercase text-accent-ink/70` vs Insights page's `.micro-label` utility (text-xs)
- **Golden ratio grid**: `lg:grid-cols-[1.618fr,1fr]` is unique to this page – nice touch but fragile (if we standardize grids, this breaks)
- **Sticky sidebar offset**: `lg:top-28` assumes navbar + margin height – brittle
- **Responsive behavior**: Grid collapses to single column on mobile; sidebar loses sticky behavior
- **Placements rendering**: Repeated `.find()` operations in JSX – not DRY (Big 3 card duplicates logic from Chart Snapshot)
- **Console logging**: `console.log` statements left in production code (lines 83-85)

---

## Room: Sanctuary – Connections

**File**: [app/(protected)/sanctuary/connections/page.tsx](../app/(protected)/sanctuary/connections/page.tsx)

### PAINT (overall visual vibe)
- **Background**: Inherits global warm gradient
- **Layout**: Two-column grid on lg+ (`grid lg:grid-cols-3 gap-6`): left 2/3 connection list, right 1/3 add form
- **Density**: Medium – connection cards expand to show insights inline
- **Color story**: Warm gradient + white cards + gold accents, with red error states
- **Overall vibe**: CRUD-style interface with expandable cards; more utilitarian than other Sanctuary pages
- **Interaction model**: Cards expand inline to show insights when "View insight" clicked; selected card gets gold border

### TRIM (details and components)
- **Cards**:
  - Uses shadcn `Card`, `CardContent`, `CardHeader`, `CardTitle`
  - Connection cards: dynamic border (`border-gold-500 border-2` when selected)
  - Empty state cards: centered emoji + message pattern
  - Error state cards: `border-red-200` variant
- **Pills**:
  - `SanctuaryTabs` (consistent with other Sanctuary pages)
  - No other pills visible
- **Borders/Radius/Shadows**:
  - Cards: standard shadcn (rounded-3xl, card-shadow)
  - Form inputs: `rounded-lg` (from shadcn Input)
  - Error/success messages: `rounded-lg` with colored borders
- **Typography**:
  - Page title: `text-4xl font-bold` (serif)
  - Page subtitle: `text-accent-ink/60`
  - Micro-label: `.micro-label` utility
  - Card titles: `text-lg font-semibold`
  - Card subtitles: `text-sm text-accent-ink/60`
  - Insight section headings: `font-semibold text-gold-600`
  - Body: `text-sm leading-relaxed whitespace-pre-wrap`
- **Buttons**:
  - `Button variant="outline" size="sm"` for "View insight"
  - `Button variant="ghost" size="sm"` for delete (trash emoji)
  - `Button variant="gold"` for "Add connection"
  - `Button variant="link" size="sm"` for inline CTAs
- **Forms**:
  - Uses shadcn `Input`, `Label` components
  - Native `<select>` with Tailwind classes (not shadcn Select component)
  - Checkbox: native `<input type="checkbox">` with `.rounded`
- **Special components**:
  - Expandable insight: inline conditional rendering within card (`selectedConnectionId === connection.id`)
  - Loading spinner: emoji + text (`✨ Generating relational insight...`)
  - Empty state: emoji + text pattern (🤝)
  - Error state: emoji + text pattern (⚠️)

### PAIN (room-specific visual landmines)
- **Hard-coded spacing**: `max-w-7xl mx-auto px-6 py-12 space-y-8` inline (repeated pattern)
- **Inline expansion pattern**: Insight rendering inside connection card creates visual complexity – card height jumps significantly
- **Border color hardcoding**: `border-gold-500 border-2` for selected state doesn't use theme variables
- **Error states**: Three different error/success message patterns (red-50, red-200, green-50, green-200) with inline styles
- **Form dropdown**: Native `<select>` with manual Tailwind classes instead of shadcn Select – inconsistent with design system
- **Button size mixing**: `size="sm"` used heavily here vs default size on other pages
- **Emoji usage**: Emojis used for empty/loading/error states (🤝, ✨, ⚠️, 🗑️) – not iconography system
- **Responsive grid**: `lg:col-span-2` splits to single column on mobile; form moves below list
- **Confirmation dialog**: Native `confirm()` for delete – not styled/branded
- **Date formatting**: Uses `formatDateForDisplay` helper but not inspected (could be inconsistent)
- **Insight section headings**: `text-gold-600` is not a theme variable (should be `text-accent-gold` or similar)

---

## Room: Settings / Profile

**File**: [app/(protected)/settings/page.tsx](../app/(protected)/settings/page.tsx)

### PAINT (overall visual vibe)
- **Background**: Inherits global warm gradient
- **Layout**: Single-column centered (`max-w-4xl mx-auto px-6 py-12`), one large card with internal sections
- **Density**: Low-to-medium – generous section spacing (`space-y-12`, `pt-8 border-t`)
- **Color story**: Warm gradient + one large white card + gold section headings
- **Overall vibe**: Form-heavy, single-flow layout; feels like a classic settings page

### TRIM (details and components)
- **Cards**:
  - Single parent shadcn `Card` wrapping entire form (`p-8 space-y-12`)
  - Nested cards: Social connection cards (`border-border-subtle`)
  - Journal section card: separate `Card` below main card
- **Borders/Radius/Shadows**:
  - Main card: standard shadcn (rounded-3xl, card-shadow)
  - Section dividers: `pt-8 border-t border-border-subtle`
  - Social provider circles: `rounded-full` with brand colors
  - Form inputs: `rounded-lg` (shadcn Input)
- **Typography**:
  - Page title: `text-4xl font-bold` (serif)
  - Page subtitle: `text-accent-ink/60`
  - Section headings: `text-2xl font-semibold text-accent-gold` (serif)
  - Subsection headings: `text-lg font-medium`
  - Labels: shadcn `Label` (text-sm font-medium)
  - Help text: `text-xs text-accent-ink/60`
  - Field notes: `text-sm text-accent-ink/60`
- **Forms**:
  - Uses shadcn `Input`, `Label`, `Button`
  - Native `<select>` for zodiac sign and timezone (consistent with Connections page)
  - Native `<input type="checkbox">` for preferences
  - Disabled inputs: `disabled` attribute (email, timezone)
- **Buttons**:
  - `Button variant="gold"` for primary actions (Save, Change password)
  - `Button variant="outline"` for secondary actions (Reset, Hibernate, Export, social reconnect)
  - `Button variant="destructive"` for Delete account
  - `Button variant="outline"` with danger styling for Delete journal
- **Special components**:
  - Social provider cards: custom design with circular icon, name, connection status
  - Social toggle switches: custom toggle UI (not shadcn Switch component)
  - Timezone dropdown: disabled + helper text explaining auto-detection
  - Required field markers: `<span className="text-danger-soft">*</span>`
  - Success/error messages: inline text with color classes

### PAIN (room-specific visual landmines)
- **Hard-coded spacing**: `max-w-4xl mx-auto px-6 py-12 space-y-8` inline
- **Section spacing inconsistency**: Some sections use `space-y-4`, others `space-y-6`, others `space-y-12` – no clear pattern
- **Form grid mixing**: Identity section uses `grid md:grid-cols-2 gap-4`, Birth Details uses both grid and single-column – inconsistent
- **Native form controls**: `<select>` and `<input type="checkbox">` not using shadcn components (Select, Checkbox)
- **Custom toggle switch**: Social insights toggle is custom-built, not shadcn Switch component
- **Social cards opacity**: "Coming soon" cards use `opacity-50` – feels like a hack vs proper disabled state
- **Button variant inconsistency**: "Delete journal" uses `variant="outline"` with manual danger classes instead of `variant="destructive"`
- **Required field markers**: Inline `<span>` tags for asterisks instead of built-in Label component handling
- **Password section**: Not functional (TODO comment) but fully styled – creates confusion
- **Timezone field**: Disabled with explanation text – should this be a read-only display instead of a disabled input?
- **Success/error messaging**: Inline conditional text rendering instead of reusable Alert/Toast component
- **Save button placement**: Action buttons at bottom of long form – no sticky footer or floating save
- **Social provider circles**: Hard-coded brand colors (`bg-[#1877F2]`, `bg-[#FF4500]`) instead of theme variables
- **Grid responsiveness**: `md:grid-cols-2` used inconsistently across sections

---

## Room: Billing / Plans (Join Page)

**File**: [app/(auth)/join/page.tsx](../app/(auth)/join/page.tsx)

### PAINT (overall visual vibe)
- **Background**: Inherits global warm gradient (no NavBar on auth pages, so no top offset issue)
- **Layout**: Single-column centered (`max-w-4xl mx-auto`), plan selection grid then signup card
- **Density**: Medium – plan cards are spacious, signup card is dense with form fields
- **Color story**: Warm gradient + white/gold cards, selected plan gets gold border/background
- **Overall vibe**: Marketing-style CTA flow; optimized for conversion

### TRIM (details and components)
- **Cards**:
  - Plan cards: shadcn `Card` with dynamic border (`border-2` + gold accent when selected)
  - Signup card: shadcn `Card` with form inside
  - Hover states: `hover:border-accent-gold/50` on plan cards
- **Pills**:
  - No traditional pills, but social buttons are circular badges
- **Borders/Radius/Shadows**:
  - Cards: standard shadcn (rounded-3xl, card-shadow)
  - Social buttons: `rounded-full` circles (`w-12 h-12`)
  - Selected plan: `border-accent-gold bg-accent-gold/5`
- **Typography**:
  - Page title: `text-3xl font-serif text-accent-ink`
  - Page subtitle: `text-accent-ink/70`
  - Card titles: `CardTitle text-xl`
  - Card subtitles: `text-sm text-accent-ink/70`
  - Feature list: `text-sm text-accent-ink/80`
  - Trial badge: `text-xs text-accent-gold font-semibold`
  - Divider text: `text-xs text-accent-ink/40 uppercase`
- **Buttons**:
  - `Button variant="gold"` for primary CTA ("Continue to payment")
  - Social buttons: custom circular buttons with brand colors (`bg-[#1877F2]`, `bg-black`, `bg-[#FF4500]`)
  - Disabled social buttons: no state shown (just onClick warning)
- **Forms**:
  - Uses shadcn `Input`, `Label`, `Button`
  - Native form elements only (no select/checkbox on this page)
- **Special components**:
  - Plan selection: clickable cards with dynamic border/background
  - Social signup row: flex row of circular brand buttons
  - Divider: horizontal rule with centered text ("Or sign up with email")
  - Error banner: `rounded-lg bg-danger-soft/20 border border-danger-soft`
  - Foundation note: small centered text at bottom

### PAIN (room-specific visual landmines)
- **Hard-coded spacing**: `max-w-4xl mx-auto space-y-8` inline (though no `px-6 py-12` since auth layout differs)
- **Social button colors**: Hard-coded brand colors (`bg-[#1877F2]`, `bg-black`, `bg-[#FF4500]`) not in theme
- **Selected card state**: `border-accent-gold bg-accent-gold/5` uses theme variable, but `border-2` is hard-coded (not token)
- **Social signup disabled**: TikTok/X/Reddit buttons show error message instead of being truly disabled
- **Plan selection interaction**: Entire card is clickable (`onClick` on Card) but no visual focus state for keyboard users
- **Error handling**: Error message uses `bg-danger-soft/20 border border-danger-soft` – `danger-soft` not defined in globals.css (likely in tailwind.config)
- **Grid responsiveness**: `md:grid-cols-2` for plan cards; stacks on mobile
- **Form conditional rendering**: `signupMethod` state toggles social vs email view – creates layout shift
- **SessionStorage usage**: `selectedPlan` stored in sessionStorage for OAuth redirect – fragile cross-page state management
- **Loading state**: `isLoading` disables buttons but no spinner or visual feedback
- **Foundation message**: `text-xs` centered text feels like an afterthought – could be more prominent
- **Sign-in link**: Inline `<Link>` with manual `text-accent-gold hover:underline` instead of Button variant="link"
- **Checkbox/terms**: No terms acceptance checkbox (common in signup flows) – may be required for GDPR

---

## Summary Observations

### Overall Paint Philosophy
Solara has a **cohesive warm, spiritual-tech aesthetic** with:
- Consistent warm gradient background across all rooms
- Clear font hierarchy (Inter sans + Crimson Pro serif)
- Gold accent system for highlights and CTAs
- Generous use of white space and translucent overlays

The visual voice is **airy, gentle, and premium** – but implementation is **fragmented** beneath the surface.

### Top 3 Rooms Closest to "Ready for Beautification"
1. **Sanctuary – Main Insights**: Strong card structure, consistent use of shadcn Card, clear typography hierarchy, well-organized two-column layout. Main issues are spacing tokens and pill style fragmentation.

2. **Billing / Plans (Join Page)**: Clean conversion-focused layout, consistent card usage, minimal complexity. Needs social button standardization and better error states.

3. **Public Landing**: Simplest structure, minimal components, clear hierarchy. Main risk is unknown card patterns in child components (ZodiacGrid, SolaraPath).

### Top 3 Rooms with Most "Pain" in Trim
1. **Sanctuary – Birth Chart**: **Card fragmentation alert** – uses `SolaraCard` instead of shadcn `Card`, creating two parallel card systems. Also has sticky sidebar offset brittleness and repeated placements rendering logic.

2. **Settings / Profile**: **Form control inconsistency** – mixes shadcn components with native `<select>` and `<input type="checkbox">`, custom toggle switches that don't match design system, hard-coded social brand colors, inconsistent section spacing.

3. **Sanctuary – Connections**: **Inline expansion complexity** – insights render inside connection cards causing height jumps, multiple error message patterns, emoji-based iconography instead of proper icon system, hard-coded gold border colors.

### Where to Start Polishing First?

**Start with Sanctuary – Main Insights**. It's the most-used room, has the strongest existing structure, and fixing its spacing/pill fragmentation will establish patterns that can cascade to other rooms. Once you unify card patterns here, the Birth Chart's `SolaraCard` divergence will become obvious and ready to merge.
