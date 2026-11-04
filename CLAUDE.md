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
- Recommendation engine is deterministic and ranked (rules over column type/role/cardinality plus an Arabic/English business-term dictionary). No AI in V1.
- Dashboard configuration is saved as downloadable `.datacanvas.json` (no data). Saving actual data to IndexedDB is explicit opt-in only.

## Exports

- Power BI package: `dataset.csv`, `transformations.pq`, `data-dictionary.json`, `README.md`. No `.pbids`. The `.pq` script uses a `DataFolder` parameter, never a hardcoded path, and sets `Csv.Document` options explicitly (UTF-8, delimiter, quoting) plus typed columns.
- Metabase package: CSV + data dictionary + README stating that an admin must enable uploads on a supported database. No SQL dump in V1.
- Dashboard specs are DataCanvas-native JSON; never describe them as importable into Power BI or Metabase.
- Export contract (unit-tested): duplicate headers get `_2` suffix, empty headers become `column_N`, ISO dates without timezone shifts, `true`/`false` booleans, empty field = null, full numeric precision, inference failures exported as text and flagged.
- Formula-injection guard handles CSV and XLSX separately: keep numbers typed (`-1500` stays a number) and neutralize only string cells that look like formulas.

## Performance targets

Stated as rows × columns: 10k×10, 50k×20, 100k×20, plus a wide 20k×100 case. Filter→chart update under ~300 ms at 100k×20. Use virtualized tables and enforce file/row/column limits.

## Tooling

Security Guidance and VibeSec skills are enabled; run the security review and claude-security scan before launch.
