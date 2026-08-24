# Design system

> Uygulama çapındaki güncel görsel sistemin tek kaynağı kökteki
> [`design.md`](../design.md) dosyasıdır. Bu belge veri, matris, erişilebilirlik
> ve yayın sözleşmelerinin ayrıntılı uygulama notlarını korur.

The build brief for `site/`. Tokens live in [`site/tokens.css`](../site/tokens.css) and are the
only place a colour, font, size or duration is allowed to be defined. Every rule below is
binding: a value that does not exist as a token gets lifted into `tokens.css` and referenced by
name, never inlined.

The navigation is a newspaper masthead, the footer a dense colophon, and nothing on a page
exists to decorate it.

## The brief

**Audience** — the general football follower. Someone who wonders whether a player was at two
World Cups, not someone who wants to query a dataset.

**Job** — scan one country's squad matrix: players down, tournaments across, shirt number in the
cell.

**Tone** — editorial. Almanac register: a reference book that is pleasant to read, not a
dashboard.

**The tension to design against.** A general visitor and a 902-row table are a bad match. The
source archive does not solve this — it drops the visitor straight into the matrix. This design
does three things about it, and they are not optional:

1. The country page opens with a **narrative band** built from real data — first and last
   tournament year, distinct players, the most-capped player, the longest gap between two
   appearances. Facts, computed, never invented.
2. The matrix is **progressive**. Above it sits a short "öne çıkanlar" strip (players with the
   most tournaments). The full matrix follows, and it is the destination, not the doorstep.
3. Every table control states what it does in words. `Yalnızca birden fazla turnuvaya
   katılanlar` beats an unlabelled toggle.

## Type

Three families, self-hosted, no exceptions.

| Role | Family | Where |
| --- | --- | --- |
| Display | Newsreader | `h1`–`h3`, the hero figure's worded line, masthead wordmark |
| Body | IBM Plex Sans | everything else, including the matrix |
| Outlier | JetBrains Mono | exactly two slots — the hero figure and the table's numeric cells |

**No font CDN.** A `fonts.googleapis.com` request hands every visitor's IP address to a third
party. Install locally instead: `@fontsource-variable/newsreader`, `@fontsource/ibm-plex-sans`,
`@fontsource/jetbrains-mono`. All three are OFL — ship their licence files under
`site/public/fonts/`. All three cover the Turkish alphabet (`ı İ ğ ş ç ö ü`); verify `İ` and `ı`
render correctly before shipping, because that is where Latin-Extended subsetting usually breaks.

Rules: `font-display: swap` everywhere · `font-variant-numeric: tabular-nums` on every numeric
cell, stat and year · display line-height 1.08, body 1.55 · measure 65ch on prose · body never
below 16px · typographic punctuation (`—`, `…`, `"…"`), never straight quotes.

Weights: body 400, headings 600 on Newsreader. No synthesised bold.

**Banned:** Inter (the archive's font — replaced deliberately), Roboto, Open Sans, Poppins,
Montserrat. Italic headings — carry emphasis with weight or the accent, never a slanted display
face. Gradient text.

## Colour

The navy/paper anchor is carried over from the archive; everything else is rebuilt. Full token
list in `site/tokens.css`.

- **Paper is never `#fff` and ink is never `#000`.** Both tint toward hue 258.
- **One accent** (`--color-accent`, warm red at hue 28), under 5% of any viewport. It marks the
  active nav item, the underline of a focused control, and the "most tournaments" leader. It is
  not a button fill colour and not a decorative wash.
- **Focus ring is a different hue** (`--color-focus`, cool blue) so it stays legible on top of
  accent-coloured surfaces. Ring ≥ 3:1 contrast, and it never animates in.
- **Per-country colour is quarantined.** `countries.json` carries each country's `theme` colours
  from the archive. They tint the masthead rule and the flag badge on that country's page only.
  They never become the page accent — otherwise the site reads as 19 unrelated sites.
- **Presence in the matrix is typographic, not chromatic.** A shirt number is ink at full weight;
  an absence is `--color-ink-muted` with an en dash. Do not colour-code presence: it fails on
  colour-blind readers and turns the table into a heat map nobody asked for.

Light scheme only for v1. A dark scheme is deferred, not forgotten — the tokens are structured so
one can be added as a `@media (prefers-color-scheme: dark)` override without touching components.

## Page shapes

### Home — Bento Grid

Hero: a concise archive title and one large figure with a qualifying line. **The number never stands alone.** Use real,
verified totals — 19 countries, 167 tournaments, 16,242 squad entries, 8,880 players, 1908–2026 —
and no others. Take them from `stats` in `src/lib/data.ts`, never by hand: an earlier draft of
this document carried 8,890 and 1924–2026, both wrong for this page, because they were typed in
rather than read from the dataset.
Below: four computed archive facts, two accessible CSS bar charts, then a searchable country-card
index (flag, name, tournament count, span and leading player). The cards use one containment layer,
hairline borders and the country theme colours already present in `countries.json`; the first two
may span wider to avoid an equal-card template rhythm.

### Country page — Stat-Led continued

Masthead (N6) with the country name, flag badge and a country switcher. Narrative band. Highlight
strip. Then the matrix. Then the source note and colophon.

### Player page

One player, their tournaments in chronological order, their position and its confidence, a link
to the Wikipedia source. When `positionConfidence` is `disputed` or `unverified`, say so in
words on the page — this project's credibility comes from admitting what it does not know.

### Tournament page

One tournament, the participating countries in this archive, their squads.

### Data quality page

The three confidence tiers with their real counts (5,325 confirmed · 460 disputed · 3,095
unverified), the 460 disputes listed with both readings and the Wikipedia field that caused them,
the 401 missing birth years, and the slug collisions. This page is a feature, not an apology.

## The matrix

The hardest component. Requirements:

- Horizontal scroll lives **inside** the table's own `overflow-x: auto` container. The page body
  never scrolls horizontally. `html, body { overflow-x: clip }` — `clip`, not `hidden`.
- The player column is **sticky** at the left edge across the horizontal scroll, with a hairline
  and a shadow that only appears once scrolled.
- Column headers are sticky at the top while the table is in view.
- Sorting: every column header is a real `<button>` inside the `<th>`, with `aria-sort` on the
  `<th>` reflecting state.
- Search and the repeat-only filter update a live region announcing the result count.
- At 320 px the table is still the table — it does not collapse into stacked cards. Cards lose
  the one thing the matrix is for: reading across.
- 902 rows must not be shipped as 902 DOM nodes on first paint if it costs interactivity.
  Measure first: if the largest page (Brazil) is interactive under 200 ms, ship it plain. Only
  virtualise if the measurement says so, and say so in the commit.

## Motion

Three primitives, no more:

1. **Hero figure tick** — counts to its target over ~500 ms, home page only, once per session.
2. **Sticky header shadow** — fades in on scroll, `--dur-fast`.
3. **Filter crossfade** — the result count and empty state cross-fade, `--dur-base`.

Animate `transform` and `opacity` only. Use the three named easings; never the browser default
`ease`, never bounce. Under `prefers-reduced-motion: reduce` all three collapse to instant — the
tokens already zero the durations, so do not hard-code a duration anywhere.

## Interaction states

Every interactive element ships all eight: default · hover · `:focus-visible` · active ·
disabled · loading · error · success. The keyboard ring is visible and instant.

## i18n

Turkish is the default locale, English the second. Routes are `/tr/...` and `/en/...` with `/`
redirecting to Turkish. Strings live in `site/src/i18n/{tr,en}.json`; country and tournament
names come from the dataset's `nameTr`/`nameEn` fields, never from a hard-coded map in a
component. `<html lang>` is set per route. Search normalisation must use `toLocaleLowerCase('tr')`
— `I/ı` and `İ/i` are not interchangeable, and getting this wrong makes Turkish search fail
silently.

## Things this project does not ship

- No analytics, no telemetry, no third-party script of any kind.
- No invented numbers. Every figure on every page traces to `data/dist/`. If a number is not in
  the dataset, it does not go on the page.
- No fake chrome — no drawn browser bars, no phone frames.
- No card-in-card, no three-column equal-icon feature grid, no centred hero, no glassmorphism.
- No shared visual identity with other projects. This project's look is its own, deliberately.

## Accessibility floor

Contrast ≥ 4.5:1 for body text and ≥ 3:1 for large text and UI boundaries. The matrix has a real
`<caption>`, `scope` on every header cell, and row headers on the player column. No clickable
text wraps to two lines. Every image-bearing grid track uses `minmax(0, 1fr)`.

Verified at 320 / 375 / 414 / 768 px before anything ships.
