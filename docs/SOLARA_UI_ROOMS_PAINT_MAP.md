# Solara UI “Rooms” – Paint, Trim, Pain

## Room: Public Landing (Home)
- **PAINT:** Warm gradient body background from globals, airy center-stack hero (`max-w-5xl`, `py-16`), mix of gold accents and neutral ink. Layout is single-column hero + stacked sections (Zodiac grid, Solara path).
- **TRIM:** Uses pills/micro-labels; hero leverages shared `TogglePills`, `PrimaryCTA`, `SolaraLogo`. Cards/grids are ad-hoc divs (not shadcn) but follow rounded corners and padding via utilities. Typography: serif headings, sans body; consistent micro-label usage.
- **PAIN:** Cards in public sections are custom and separate from shadcn `Card` used elsewhere, so polish may require duplicative tweaks. Spacing/density tuned via inline Tailwind constants; no shared “section” wrapper. Responsive behavior relies on basic grids; tablet polish may need attention.

## Room: Public About / Learn
- **PAINT:** Follows public layout shell (NavBar + footer, gradient body). Content is likely simple text blocks; warm palette persists.
- **TRIM:** Likely plain divs with Tailwind utilities; uses the same nav pills. Minimal hierarchy components beyond headings and paragraphs.
- **PAIN:** Without shared section components, per-page spacing and typography can diverge. Any imagery/illustration is ad-hoc, making global polish harder.

## Room: Sanctuary – Main Insights
- **PAINT:** Warm gradient body; two-column grid at lg (left 2/3 narrative cards, right 1/3 widgets). Airy but content-rich; gold micro-labels and serif headings give premium vibe. Tabs sit above content.
- **TRIM:** Relies on shadcn `Card`, `Button`, `Input`; repeated micro-labels; pills for tabs/timeframe. Cards consistent within the page, with headings and small descriptors. Lucky Compass/journal use pill and border-subtle patterns.
- **PAIN:** Inline spacing (`py-12`, `gap-6`) hard-coded; `pt-20` for navbar offset is brittle. Tablet responsiveness is minimal (jump from single column to `lg:grid`); sidebar stacks abruptly. Some content blocks are bespoke text areas inside cards—hard to restyle uniformly.

## Room: Sanctuary – Birth Chart
- **PAINT:** Same warm shell; two-column split `lg:grid-cols-[1.618fr,1fr]`. Left narrative text + sections; right technical snapshot lists. Feels text-heavy, minimal illustration.
- **TRIM:** Mostly custom div containers (not shadcn Card) with borders/padding via utilities; uses `SanctuaryTabs`. Lists for planets/houses are plain `<ul>` with simple font weights. No consistent card component with shadows here.
- **PAIN:** Card fragmentation vs main insights (shadcn vs plain divs). House/planet lists have minimal styling; polishing will need pass-specific tweaks. Hard-coded grid proportions could be finicky on tablet; limited componentization for section headers.

## Room: Sanctuary – Connections
- **PAINT:** Single-column stack of cards; warm palette persists. Content density moderate with lists and badges.
- **TRIM:** Uses shadcn `Card`, pills for relationship labels, standard serif headings. Consistent borders/radii within page.
- **PAIN:** Spacing and card padding inline; if more connection types are added, pattern drift may occur. Any future multi-column layout would need responsive tuning (currently single stack).

## Room: Settings / Profile
- **PAINT:** Centered `max-w-4xl` form card, generous white space. Neutral/ink text with gold section headers.
- **TRIM:** Uses shadcn `Card`, `Input`, `Label`, `Button`; grids for fields; serif section titles. Trim is consistent and clean.
- **PAIN:** Inline spacing and section divides are manual. Form + logic mixed in same component; visual-only refactors must navigate logic carefully. No shared form section component.

## Room: Billing / Join / Checkout
- **PAINT:** Centered `max-w-4xl`, two plan cards, white background with gold highlight for selected. Simple, friendly density.
- **TRIM:** shadcn `Card` for plans; buttons use `gold` variant and pills for social icons. Borders/radii consistent; headings serif.
- **PAIN:** Plan cards are bespoke (selected state via inline classes). Social buttons are raw colored circles (brand colors hard-coded). Spacing/padding not abstracted; navbar offset still manual.

## Room: Public Horoscopes (Public Horoscope API consumer)
- **PAINT:** Uses public shell; likely simple grid/list of signs (when present) with warm palette.
- **TRIM:** Tailwind utility grids; micro-labels reused.
- **PAIN:** Similar to public landing—ad-hoc cards and spacing make global polish a bit manual.

