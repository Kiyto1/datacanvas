# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Early scaffold: Vite + React + TypeScript + Tailwind v4 shell with an ar/en RTL switch and CSP headers; no data features yet. The approved design lives in `C:\Users\Admin\.claude\plans\datacanvas-arabic-first-data-twinkly-quasar.md`.

## Commands

```bash
npm run dev          # dev server
npm run build        # tsc -b && vite build
npm run typecheck
npm run lint
npm test             # vitest run
npx vitest run src/i18n/i18n.test.ts          # single test file
npx vitest run -t "maps Arabic"               # single test by name
npm run e2e          # Playwright; builds and serves the production bundle first
npx playwright test e2e/shell.spec.ts -g "language switch"   # single e2e test
npm run audit:prod   # dependency audit, runtime deps only
```

E2E runs against `vite preview` on port 4173, which serves the headers parsed from `public/_headers` (see `vite.config.ts`), so tests exercise the real CSP. First-time setup on a machine: `npx playwright install chromium`.

Styling: Tailwind v4 utilities backed by CSS-variable tokens in `src/index.css`; plain CSS only for ECharts containers, print layouts and special animations. Build reusable components instead of long class lists in page-level JSX. Hosting is Cloudflare Pages; CSP lives in `public/_headers` (note `style-src 'self'` forbids inline style attributes in markup, so verify ECharts against the production build).

## Git

Remote: `https://github.com/Kiyto1/datacanvas.git`, branch `main`. Do not add `Co-Authored-By: Claude` or "Generated with Claude Code" lines to commits or PRs (the user does not want Claude listed as a contributor; `.claude/settings.json` blanks the attribution). Commit and push only when asked. `.claude/settings.local.json` and `*.tsbuildinfo` are gitignored.

## Product

**DataCanvas**: an Arabic-first, local-first web app that turns CSV/Excel files into interactive dashboards, with downloadable Power BI and Metabase packages. Stack: React + Vite + TypeScript (strict), ECharts, i18next (`ar` default), TanStack Table, Zustand, Zod, SheetJS (official distribution, pinned version; do not blindly `npm i xlsx`).

## Non-negotiable constraints

- **File data never leaves the browser.** No backend, no outbound requests carrying data, no third-party scripts or analytics. CSP is set via HTTP headers (`connect-src 'self'`, explicit `worker-src 'self'` covering the Web Worker and PWA service worker) and must be tested against the production build, not only dev. V1 has no Metabase push (a static CSP can't allow a user-entered origin).
- **Never mutate original values.** Each value has `original`, `comparisonKey` (matching only) and `displayValue` (user-approved). Normalization produces suggestions labelled `exact` / `known alias` / `possible match` (no invented confidence percentages), applied only after user confirmation as a reversible layer. ة/ه folding is for possible-match keys only, never auto-applied.
- **Numeric does not mean summable.** `ColumnRole` (dimension / measure / identifier / unknown) controls allowed aggregations; identifiers only count/distinct-count, unit prices default to average.
- **Dates:** infer a format only from evidence; ask the user when ambiguous (e.g. `03/04/2026`); one interpretation per column. Hijri is display-only via `Intl` plus a few explicit input formats.

## Architecture (big picture)

```
React UI → dashboard/filter state → versioned analysis request
   → Web Worker: parse, profile, filter, aggregate (cached)
   → aggregated results only → ECharts
```

- Full datasets live in the worker (columnar typed arrays where possible), never in Zustand or React state. Zustand holds only lightweight UI state.
- Stale worker responses are ignored/cancelled; aggregation cache keyed by (dataset version, filters, spec).
- Implemented so far: `src/parse/` (byte decoding with UTF-8/UTF-16 BOM and Windows-1256 fallback, CSV/XLSX via SheetJS, limits in `src/core/types.ts`), `src/core/headers.ts` (empty → `column_N`, duplicates → `_2`), `src/worker/` (`protocol.ts` message types, `dataWorker.ts` holds the rows, `client.ts` ignores stale responses), `src/store/dataset.ts` (summary only). The parser keeps every CSV value as original text (no number/date guessing); typing happens later in profiling.
- Profiling (`src/profile/`, runs in the worker after parse): `numbers.ts` (Arabic-Indic digits, grouping; `007` and 16+ digit strings stay text), `dates.ts` (infers `ymd`/`dmy`/`mdy` only from evidence; `03/04/2026`-style columns come back `ambiguous` with `chosen: null`; Hijri-looking years need confirmation; no calendar conversion), `dictionary.ts` (Arabic/English header terms, matched via `comparisonKey` from `src/core/arabic.ts`), `inferColumns.ts` (type, role, allowed/default aggregations). Header hint beats data heuristics; identifiers and unit prices never allow `sum`. `ColumnProfile.roleSource` records why (`header` or `data`) so the review screen can explain it. The date-confirmation UI is not built yet; the preview only shows a warning.
- Normalization (`src/normalize/`): `suggest.ts` groups spellings of one value per text category column via union-find (labels `exact` / `known-alias` / `possible-match`; the label is the weakest link in the group, and an alias link is recorded only when comparison keys differ). `aliases.ts` is a deliberately small, unambiguous city/country table (no generic words like "المدينة"). Suggestions are computed in the worker at parse time. Confirmed merges travel as `NormalizationDecision[]` (validated with Zod in the worker), are applied only to display/preview rows by `layer.ts`, and "Undo all" sends an empty list; stored rows are never edited. Nothing is pre-selected in the UI. Aggregations and exports must read through `displayCell` once they exist.
- Dashboard: `src/worker/columnStore.ts` builds typed, cached columns lazily (numeric `Float64Array`, dictionary-encoded categoricals read *through* approved normalization, packed `yyyymmdd` dates); `src/worker/aggregate.ts` runs `ChartSpec`s against it with a mask for cross-filters (bars/distributions ignore filters on their own dimension so all categories stay visible) and caches results per `store.uid:version`. The main thread only receives small `ChartResult`s. Specs/filters/date choices are Zod-validated at the worker boundary (`src/dashboard/types.ts`). `src/dashboard/recommend.ts` is the pure ranked rule engine; date charts appear only after a date reading is proven or user-chosen (`DateConfirmation`). Titles come from `titles.ts` + i18n at render time.
- Dates from XLSX: format with `dateParts()` (local getters) from `src/core/dateParts.ts`. Never `toISOString()`/`getUTC*` on spreadsheet Dates: SheetJS builds them so local fields hold the wall-clock date, and UTC methods shift the day for users east of UTC (verified empirically).
- Charts: ECharts via a small wrapper (`src/components/charts/EChart.tsx`, tree-shaken, canvas). Canvas cannot read CSS variables, so `charts/theme.ts` mirrors the validated palette from `index.css` (keep both in sync). Series colours follow the validated 8-slot order; single-series charts use slot 1. Every chart has a "view as table" mode whose category buttons are the accessible equivalent of clicking a bar (and what e2e tests use). Light-mode contrast for some palette slots is below 3:1, so keep visible value labels and the table view.
- CSP gotcha: Vite inlines small assets as `data:` URIs, which `font-src 'self'` blocks. `build.assetsInlineLimit: 0` in `vite.config.ts` prevents this; the production-build e2e CSP test caught it.
- Known follow-ups: charts are not mirrored for RTL (value axis still runs left to right); the dropzone stays large after a file loads; main JS bundle is ~830 kB (ECharts) and the worker ~480 kB (SheetJS), so consider lazy-loading charts; date-range brush, drag/resize layout, saved `.datacanvas.json` configs and exports are not built yet.
- Exports (`src/export/`, run in the worker via the `export` message, validated by `exportRequestSchema`): `tidy.ts` builds the one typed table every format reads (approved merges applied, numbers typed, ISO dates only when the reading is known and Gregorian, otherwise text; a column that doesn't fully fit its detected type falls back to text with a `notes` entry). `csv.ts` (BOM, CRLF, RFC 4180, `neutralizeFormula` for text only), `xlsx.ts` (string-typed text cells, real dates, RTL workbook view for Arabic), `dictionary.ts`, `powerQuery.ts` (M script with a `DataFolder` placeholder + friendly error, explicit `Csv.Document` options, `en-US` typing), `readme.ts` (bilingual), `zip.ts` (own store-only writer, CRC-checked, no dependency), `run.ts` (file naming, package assembly). `dashboard/exportSpec.ts` builds the DataCanvas-native `dashboard-spec.json` on the main thread by column name. The Power Query script and Metabase CSV flow have NOT been run in real Power BI Desktop/Metabase; do that before claiming compatibility. PDF export and 100k-row export timing are not done.
- Design system (landing and workspace share it; Attio is the quality benchmark, DataCanvas keeps its own identity): fixed palette in `src/index.css` (`@theme`). Light is the default and deliberately soft: page #F6F6F5, cards #FBFBFA, sunken #EEEEEC (pure white was too bright), #171717 ink, #5E636E secondary, #E1E1DE borders, ink accent (#171717, same role as silver in dark). No purple anywhere. Dark is a black foundation (#090909 / #111 / #1A1A1A) with a restrained silver-white accent (#EDEDED, white primary buttons), no purple, never navy or blue-tinted; dark chart slot 1 is neutral silver on purpose (single-series charts), slots 2-8 are soft hues. Do not invent colours. Warning amber marks "needs your decision" only (token names still say `saffron`); success as text uses `ok-text` (darker step, #16A34A fails 4.5:1 on white). Fonts: Inter Variable (Latin) + IBM Plex Sans Arabic, self-hosted via `@fontsource`; no display serif, no geometric pattern. Never put letter-spacing on Arabic (breaks joins): `.display` handles that. Theme: Light / Dark / System switcher (`ThemeSwitch`, `core/theme.ts`, stored in localStorage `datacanvas.theme`, `data-theme` on `<html>`; System removes the attribute so the media query decides). Charts mirror the palette in `charts/theme.ts` and repaint on `data-theme` changes. Tests set the theme through localStorage, not the OS scheme. Cards and a standard top bar/tabs are fine where they help usability.
- Landing (`src/components/landing/`): `HeroDemo` calls the real `suggestForColumn` + `buildDisplayMap`/`displayCell`, and the "what it understands" rows call the real `inferColumns`/`parseNumber`/`parseDateWith`, so every claim there is real output. Do not add claims the app cannot back (Hijri dates are only a confirmation prompt, not displayed or converted). Built-in sample data is `src/demo/sales.ts` (deterministic). `App.tsx` lazy-loads `workspace/Workspace` (ECharts + dashboard) and preloads it on idle, so the landing page stays light.
- Landing (Attio-style: white canvas, centered two-tone headline, one large product window on a quiet `.stage` backdrop, sticky chapter list; sections in `src/components/landing/`): `Nav` (sticky, theme + language + demo), `Hero` (headline, one-row dropzone, `HeroDemo`: ONE window that plays sheet, suggestion, visitor approval, dashboard and export, driven by the real `suggestForColumn` and display layer), `Story` (NOT pinned: plays itself once when it scrolls into view, ~7 s, then rests on the dashboard; the four steps are always clickable and stop the autoplay; reduced motion shows the finished state. Pinned scroll-scrubbing was tried and felt like being trapped, do not bring it back), `LiveDemoSection` + `LiveDemo` (lazy; the REAL `KpiStrip`/`ChartPanel` on the sample via `ColumnStore`+`runSpecs`), `Bento` (hairline rows, not cards, built from real parsers), `PrivacyProof` (reads `performance.getEntriesByType('resource')`; external count must stay 0), `FinalCta`. `motion.tsx` holds `useScrollProgress`, `useInView`, `Reveal` (no animation library). No floating decorative panels and no feature-card grids.
- Landing rules learned the hard way: decoration must never cover real data (no floating panels over product windows); the Story stage must stay on the same 6xl grid as the rest of the page; phone KPI strips are rows, not columns (large numerals collide); clip-reveal (not stroke-dash) for lines drawn with `vectorEffect="non-scaling-stroke"`; every claim on the page must be backed by real engine output. No video on purpose: the live preview is more convincing, lighter, and cannot go stale. Verify visual work with 100%-zoom screenshots, not just tests.
- Workspace (`src/components/workspace/Workspace.tsx`): slim top bar, tabs (dashboard/data), cleanup tray at the inline-start edge (normalization + date confirmation, open by default when something needs review), export as a popover (`ExportMenu` in `ExportPanel.tsx`), per-chart customise popover (`ChartEditor`, logic in `dashboard/overrides.ts`: only valid choices; a changed measure resets to an allowed calculation; identifiers are never offered as measures). KPIs show a share of the unfiltered total while a filter is on (`baseline` in the dashboard store).
- View Transitions (`src/core/transition.ts`): the update MUST be committed synchronously (`flushSync`) inside the callback. Waiting for `requestAnimationFrame` there deadlocks the transition and freezes every entrance animation for seconds (functional tests did not notice; a screenshot did). `kpi-strip` opacity is asserted in `experience.spec.ts` as a regression.
- Zod is configured `jitless` (`z.config({ jitless: true })` in each schema module) because its default JIT probes `new Function`, which the strict CSP reports as a violation. Keep Zod out of main-thread modules that do not need it: `normalize/layer.ts` is pure and shared with the landing demo, the schema lives in `normalize/schema.ts` (worker only).
- Accessibility: `e2e/a11y.spec.ts` runs axe (wcag2a/aa) on landing, workspace (with both popovers open) and data tab in light and dark; keep it at zero serious/critical violations.
- Recommendation engine is deterministic and ranked (rules over column type/role/cardinality plus an Arabic/English business-term dictionary). No AI in V1.
- Dashboard configuration is saved as downloadable `.datacanvas.json` (no data). Saving actual data to IndexedDB is explicit opt-in only.

## Exports

- Power BI package: `dataset.csv`, `transformations.pq`, `data-dictionary.json`, `README.md`. No `.pbids`. The `.pq` script uses a `DataFolder` parameter, never a hardcoded path, and sets `Csv.Document` options explicitly (UTF-8, delimiter, quoting) plus typed columns.
- Metabase package: CSV + data dictionary + README stating that an admin must enable uploads on a supported database. No SQL dump in V1.
- Dashboard specs are DataCanvas-native JSON; never describe them as importable into Power BI or Metabase.
- Export contract (unit-tested): duplicate headers get `_2` suffix, empty headers become `column_N`, ISO dates without timezone shifts, `true`/`false` booleans, empty field = null, full numeric precision, inference failures exported as text and flagged.
- Formula-injection guard handles CSV and XLSX separately: keep numbers typed (`-1500` stays a number) and neutralize only string cells that look like formulas.

## Performance

Targets are stated as rows × columns: 10k×10, 50k×20, 100k×20, plus a wide 20k×100 case; filter→chart update under ~300 ms at 100k×20.

```bash
npm run bench          # Node stage timings (vitest, writes bench-results.json)
npm run bench:browser  # real worker + UI against the production build (writes test-results/browser-bench.json)
```

Measured on the dev machine (Windows, Node 22, Chromium), synthetic Arabic data from `src/perf/generate.ts`:

| Case | Node: parse / profile / filter | Browser: load / filter / CSV export |
|---|---|---|
| 100k × 20 | 244 ms / 609 ms / 7 ms | 3.5 s / ~140 ms / 1.4 s |
| 50k × 20 | 95 ms / 306 ms / 3.5 ms | 1.9 s / ~115 ms / 0.8 s |
| 20k × 100 | 134 ms / 1.1 s / 1.4 ms | 4.1 s / ~147 ms / 2.3 s |

XLSX export is the slow path (SheetJS serialization, ~4 s at 50k×20, ~9 s at 100k×20); it runs in the worker with a visible "creating file" message. Browser "load" includes Playwright pushing the file in, so real users should see less.

What made the difference: CSV parsing uses our own RFC 4180 parser (`src/parse/csv.ts`, with delimiter detection for `;`/tab/`|`) instead of SheetJS (which allocates a cell object per cell: 11× slower); type inference samples up to 5,000 values per column (`SAMPLE_SIZE` in `inferColumns.ts`), but date columns are re-checked on every value so the day/month decision uses all the evidence. Keep the date rule's 5% outlier tolerance in mind: a lone `25/04/2026` among thousands of ambiguous dates does not settle the order; the user is asked.

Use virtualized tables for any future full-data table view, and keep enforcing file/row/column limits.

## Tooling

Security Guidance (plugin) and the VibeSec skill (`.claude/skills/VibeSec-Skill`, tracked in this repo) are enabled. Before launch, run `/security-review` and consider the claude-security and OWASP Security Audit plugins. Arabic data rules have no off-the-shelf skill; once the normalization and date code exist, capture them as a project skill.
