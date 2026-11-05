# Understanding DataCanvas: a guide for the person who has to explain it

This guide is for you, a fresh graduate who knows JavaScript, TypeScript, React and web basics, and who needs to explain, maintain and defend this project. It is built for about three weeks of part-time study. If you rush it, skip the exercises last, not first.

The goal is not to memorize files. The goal is that someone can ask "why did you do it this way?" about any part of the app and you can answer from understanding.

How to use it:

1. Read each chapter, then open the files it names and read them next to the explanation.
2. Do the exercises. Reading alone is the fastest way to forget.
3. Answer the "Can you answer this?" questions out loud, without looking. If you stall, reread.
4. Keep a notes file of your own words. Explaining in your own words is the real test.

`CLAUDE.md` in the project root is the short version of the architecture notes. This guide is the long version with the reasons.

---

## Chapter 0. The pitch and the five rules

### The 60-second pitch

DataCanvas turns a CSV or Excel file into an interactive dashboard, entirely in the browser. It understands Arabic data properly: Arabic-Indic digits, spelling variants of the same city, ambiguous dates. It never uploads your file anywhere. It can export a cleaned dataset plus a ready-made package for Power BI or Metabase.

### The five rules everything else follows from

Learn these first. Almost every design decision in the code traces back to one of them.

1. **The file never leaves the browser.** There is no backend. A strict Content Security Policy (CSP) blocks any request to another site. This is the product's main promise.
2. **Never change the user's original values.** Cleanup (such as merging الرياض and Riyadh) is a reversible layer on top of the stored data. The original is always recoverable.
3. **Suggest, never decide.** The app proposes merges and date readings. The user confirms. Nothing risky is pre-selected.
4. **A number is not always summable.** An ID column, or a unit price, should not be summed. Every column has a role that controls which calculations are allowed.
5. **Only claim what the app can prove.** Landing page demos run the real engine. No claim about Hijri conversion, Power BI import or anything else that the code does not truly do.

Can you answer this?

- Why is "no backend" a feature and not a missing piece?
- What does "reversible layer" mean in one sentence?
- Why does the app ask about the date `03/04/2026` instead of guessing?

---

## Chapter 1. Concepts you need before the code makes sense

You know React and TypeScript. These are the ideas around them that are probably new. Spend real time here, at least two days. Everything later depends on them.

### 1.1 Web Workers

A browser runs your JavaScript on one main thread, the same thread that draws the page. If you parse a 100,000 row file there, the page freezes. A Web Worker is a second thread. It cannot touch the page. It talks to the main thread only by sending messages.

In this project the worker holds all the rows. The main thread holds only small summaries. Read `src/worker/protocol.ts` first: it lists every message type that crosses the boundary. Then `src/worker/client.ts`, which wraps those messages in async functions the UI can call.

Practice: build a toy worker that sums an array of a million numbers and posts the result back. Notice that data is copied between threads unless you transfer it.

### 1.2 Typed arrays and columnar storage

A typical JavaScript table is an array of row objects. That is memory hungry and slow to scan. DataCanvas stores data by column. A numeric column is a `Float64Array`, a flat block of 64-bit numbers. A date column is packed into one integer such as `20260425`. Scanning one column to compute a total touches contiguous memory, which is fast.

### 1.3 Dictionary encoding

A column like "city" has maybe 5 distinct values across 100,000 rows. Instead of storing 100,000 strings, store each distinct string once in a list, and store each row as a small integer pointing into that list. Grouping by city then becomes counting integers. Read `src/worker/columnStore.ts` to see it.

The clever part: the list can be read through the user's approved merges, so "Riyadh" and "الرياض" point to the same entry without touching the stored original.

### 1.4 Content Security Policy

A CSP is an HTTP response header that tells the browser what the page may load or connect to. This project sets `connect-src 'self'`, so even if a bug or a malicious dependency tried to send your data to another server, the browser would refuse. Read `public/_headers`, then `vite.config.ts` to see how the same file is applied to the local preview server so tests exercise the real policy.

Things the strict CSP forced:

- No inline styles in markup (`style-src 'self'`). ECharts and any generated styling had to be checked against the production build.
- Vite normally inlines small assets as `data:` URIs. The font policy blocked that, so the build sets `assetsInlineLimit: 0`.
- Zod normally probes `new Function` to speed itself up, which the CSP flags. It runs in `jitless` mode instead.

### 1.5 Unicode and Arabic text

The same word can be written several ways:

- Letter forms: أ إ آ ا are different characters for the same letter family. ى and ي differ. ة and ه are often swapped.
- Diacritics (tashkeel) and the stretching mark (tatweel) are decoration.
- Digits: ٣٥٠٠ uses Arabic-Indic digits. Excel exports sometimes use them, sometimes Western `3500`.

Computers compare strings by exact characters, so الرياض and الرّياض are different until you normalize them. Read `src/core/arabic.ts` slowly: `toWesternDigits` and `comparisonKey`.

Important idea: the **comparison key** is only for deciding whether two values might match. It is never shown and never replaces the original.

### 1.6 State management and validation

- **Zustand** is a small state library. Here it holds only light UI state (language, theme, filters). Large data never goes in it. Open `src/store/ui.ts`, `dataset.ts`, `dashboard.ts`.
- **Zod** validates data at a boundary. Messages arriving in the worker are checked, because a bug in the UI should not be able to crash the worker with a malformed request.

### 1.7 Tailwind v4 tokens, i18n and RTL

- Colors, fonts and shadows are defined once as tokens in `src/index.css` (`@theme`). Components use names like `bg-surface` and `text-muted`, so changing a theme means changing the tokens, not the components.
- `i18next` holds all visible text in `src/i18n/ar.ts` and `en.ts`. Arabic is the default language.
- RTL is handled by the `dir` attribute plus logical CSS properties (`ps-`, `me-`, `border-s`) instead of left and right.

### 1.8 Reading list for this chapter

Use the official docs for each. Search for: MDN "Using Web Workers", MDN "Content Security Policy", MDN "TypedArray", the Unicode "Arabic" block, the Zustand README, the Zod docs.

Exercises:

1. Write the toy worker from 1.1.
2. In the browser console, test `'الرياض' === 'الرّياض'` and then strip diacritics and compare again.
3. Open the built app (`npm run build`, then `npm run preview`), open the Network tab, upload a file, and confirm no request carries it.

Can you answer this?

- Why not keep the rows in React state?
- What is the difference between a comparison key and a display value?
- What exactly would the CSP stop if a dependency tried to leak data?

---

## Chapter 2. Map of the repository

```
src/
  core/        small shared helpers: Arabic text, formatting, types, theme
  parse/       bytes to a raw table of text (CSV, XLSX)
  profile/     work out column types and roles from the data
  normalize/   find spelling variants and apply approved merges
  worker/      the Web Worker: holds all data, answers requests
  dashboard/   which charts to show, chart specs, overrides
  export/      CSV, XLSX, Power BI and Metabase packages
  store/       Zustand UI state (summary only, never rows)
  components/  React UI
    landing/   the marketing page, built on the real engine
    workspace/ the app after a file is loaded
    charts/    thin ECharts wrapper
  i18n/        Arabic and English text
  demo/        built-in sample data
  perf/        benchmark data generator
e2e/           Playwright tests (real browser)
public/_headers   the CSP
```

The most important idea in the map: **the left half of the data flow lives in `parse`, `profile`, `normalize`, `worker`, `dashboard`, `export`, and none of that imports React.** The UI only asks for results.

---

## Chapter 3. The data journey, step by step

This is the heart of the guide. Follow one uploaded file from drop to dashboard. Keep the files open.

### Step 1. The file arrives

`components/UploadDropzone.tsx` receives a `File`. The UI store calls `parseInWorker(file)` in `src/worker/client.ts`. That reads the file into an `ArrayBuffer` and posts a `parse` message to the worker, with a `requestId`.

Question to understand: why a `requestId`? Because responses can arrive out of order. The client ignores stale ones. Open `client.ts` and find where it compares ids.

### Step 2. Bytes to text

`src/parse/decode.ts` decides the text encoding: UTF-8 or UTF-16 with a byte-order mark, or Windows-1256 as a fallback. Windows-1256 is the old Arabic Excel encoding. Getting this wrong turns Arabic into garbage characters.

`src/parse/csv.ts` is our own CSV parser (`parseCsv`), plus `detectDelimiter` for comma, semicolon, tab or pipe. We wrote it because the library path creates an object per cell and was about eleven times slower. It follows RFC 4180: quoted fields, doubled quotes, newlines inside quotes.

`src/parse/parseFile.ts` ties it together and for Excel uses SheetJS. It returns a `RawTable`: headers and rows of raw text. Note the rule: **the parser guesses nothing.** Every value stays text. Typing happens later.

`src/core/headers.ts` cleans headers: empty ones become `column_N`, duplicates get `_2`.

### Step 3. Profiling: what is each column?

`src/profile/inferColumns.ts` (`inferColumns`) decides, for each column, a **type** (text, number, date, boolean) and a **role** (dimension, measure, identifier, unknown).

How it decides:

- `profile/dictionary.ts` has Arabic and English header words (المبيعات, سعر الوحدة, رقم الطلب). A header hint beats a data heuristic. A column called "رقم الطلب" is an identifier even though it is numeric.
- `profile/numbers.ts` (`parseNumber`) reads `3,500`, `٣٬٥٠٠` and `3 500` as the same number. `007` stays text, because leading zeros mean it is a code. A 16 digit string stays text because JavaScript numbers lose precision there.
- `profile/dates.ts` is the subtle one. For `25/04/2026` the day cannot be a month, so the order is day first. For `03/04/2026` nothing proves it, so the column is marked `ambiguous` and the user must choose. One reading is applied to the whole column. A Hijri-looking year (13xx, 14xx) requires confirmation, and the app never converts calendars.
- It samples up to 5,000 values for speed, but date columns are re-checked on every value, because one disambiguating row changes everything. There is a 5% outlier tolerance. Read the comments around it.

`ColumnProfile.roleSource` records whether the role came from the header or the data, so the UI can explain itself.

Exercise: add a header term to `profile/dictionary.ts`, then add a test in `src/profile/profile.test.ts` proving a column with that header gets the role you expect.

### Step 4. Normalization: finding variants

`src/normalize/suggest.ts` (`suggestForColumn`) looks at the distinct values of each text column and groups ones that might be the same thing. It uses union-find: link two values if their comparison keys match, or if they appear in the alias table (`normalize/aliases.ts`, a deliberately small city and country list such as Riyadh to الرياض).

Each group gets a label. The label is the weakest link in the group:

- `exact`: same value after trivial cleanup.
- `known-alias`: from the alias table.
- `possible-match`: fuzzy match, for example ة versus ه folding. These are never pre-selected.

There are no confidence percentages on purpose, because a made-up number would give false certainty.

### Step 5. Applying a decision

When the user approves a merge, the UI sends `NormalizationDecision[]` to the worker. They are validated with Zod (`normalize/schema.ts`). `normalize/layer.ts` builds a `DisplayMap`, and `displayCell` reads a cell through it. "Undo all" just sends an empty list. Stored rows are never edited.

Rule to remember: anything that shows or exports data must read **through** `displayCell`. If you ever add a new feature that reads raw rows directly, it will ignore the user's merges. That is a bug.

### Step 6. The column store

`src/worker/columnStore.ts` (`ColumnStore`) builds typed columns lazily and caches them: numeric `Float64Array`, dictionary-encoded categoricals read through approved merges, packed dates. The cache key includes the data version so a new merge invalidates it.

### Step 7. Dashboard recommendations

`src/dashboard/recommend.ts` (`recommend`) is a deterministic, ranked rule engine. Date plus measure becomes a line chart. A low-cardinality dimension plus a measure becomes a bar chart. And so on. There is no AI. Rules over type, role, cardinality and header terms, so the output is explainable and testable.

Date charts only appear once the date reading is proven or user-chosen.

`src/dashboard/types.ts` defines `ChartSpec` and `Filter`, also validated with Zod at the worker boundary.

### Step 8. Aggregation

`src/worker/aggregate.ts` (`runSpecs`) runs chart specs against the store with a **mask** for cross-filters: a bit per row saying whether it passes the current filters. Bar charts ignore filters on their own dimension so all categories stay visible while you click one. Results are small `ChartResult` objects, cached per dataset version. Only these cross back to the main thread.

Measured: filter to chart update about 100 to 140 ms on 100,000 rows by 20 columns.

### Step 9. Drawing

`components/charts/EChart.tsx` wraps ECharts (tree-shaken, canvas). `charts/options.ts` turns a `ChartResult` into an ECharts option. `charts/theme.ts` mirrors the palette from CSS, because a canvas cannot read CSS variables. If you change a color token you must change it in both places.

Every chart has a "view as table" mode. That is the accessible equivalent of clicking a bar and what the end-to-end tests use.

### Step 10. Export

`src/export/tidy.ts` (`buildTidyTable`) produces one typed table that every format reads: merges applied, numbers typed, dates as ISO only when the reading is known and Gregorian, otherwise text. A column that does not fully fit its type falls back to text with a note.

From that one table:

- `csv.ts`: UTF-8 with BOM (so Excel shows Arabic correctly), CRLF line endings, quoting per RFC 4180. `neutralizeFormula` defends against spreadsheet formula injection for text cells that start with `=`, `+`, `@`.
- `xlsx.ts`: real dates, text stored as text, right-to-left workbook view.
- `powerQuery.ts`: a Power Query M script with a `DataFolder` placeholder instead of a hard-coded path, explicit CSV options, typed columns.
- `dictionary.ts`, `readme.ts`: data dictionary and bilingual instructions.
- `zip.ts`: our own store-only ZIP writer with CRC-32, so no dependency is needed.
- `run.ts` assembles packages. It runs in the worker.

Be honest about this: the Power BI and Metabase packages have **not** been tested in the real tools.

Can you answer this?

- Trace what happens, in order, when a user drops a CSV with the cities الرياض, Riyadh and الرّياض.
- Why does the parser keep everything as text?
- Where would a bug be if the exported file ignored the user's merges?
- Why does the bar chart ignore filters on its own dimension?

---

## Chapter 4. The interface layer

Now that you know what the engine does, the UI is mostly presentation.

- `App.tsx` switches between the landing page and the workspace, with a View Transition between them. The workspace is lazy-loaded so the landing page stays light.
- `components/workspace/Workspace.tsx`: top bar, tabs (dashboard and data), the cleanup tray, the export popover.
- `Dashboard.tsx`, `KpiStrip.tsx`, `ChartPanel.tsx`, `ChartEditor.tsx`: KPI row, chart cards, per-chart customization. `dashboard/overrides.ts` ensures only valid choices are offered (for example an identifier is never offered as a measure).
- `NormalizationReview.tsx` and `DateConfirmation.tsx`: the two places the user makes decisions. Nothing is pre-selected.
- `core/transition.ts`: View Transitions. Know this gotcha: the DOM update must happen synchronously (`flushSync`) inside the callback. Waiting for `requestAnimationFrame` there deadlocked the transition and froze animations. A test guards it.

### The landing page

`components/landing/` is a marketing page, but it is not fake. `HeroDemo` calls the real `suggestForColumn` and display layer. `LiveDemo` renders the real `KpiStrip` and `ChartPanel`. `PrivacyProof` reads the browser's own list of loaded resources and counts requests to other sites (it must say 0). `Story` plays the sheet to dashboard sequence once when it scrolls into view.

Exercise: change the sample rows in `HeroDemo.tsx` and watch the suggestion change. You are proving to yourself that the demo is the engine.

### Theme and language

`core/theme.ts` and `components/ThemeSwitch.tsx`: Light, Dark or System, stored in `localStorage`, applied as `data-theme` on `<html>`. System removes the attribute so the media query decides. `store/ui.ts` also holds language, which sets `lang` and `dir` on the document.

---

## Chapter 5. Tests: how you know it works

- **Unit tests** (Vitest) sit next to the code as `*.test.ts`. Run `npm test`. They cover parsing, profiling, normalization, dashboard rules, overrides and export contracts. Read these as specifications. For example `export.test.ts` proves `-1500` stays a number while `=cmd` is neutralized.
- **End-to-end tests** (Playwright, `e2e/`) drive a real Chromium against the production build served by `vite preview` with the real CSP headers. They check uploading, merging, cross-filtering, exporting, the landing page, and accessibility.
- **Accessibility** (`e2e/a11y.spec.ts`) runs axe in light and dark. Zero serious violations is the standing rule.
- **Performance** (`npm run bench`, `npm run bench:browser`): synthetic Arabic data at 10k, 50k and 100k rows.

Habit to build: before you change anything, run the tests. After you change it, run them again. When a test fails, decide whether the code or the expectation is wrong. Earlier in this project several failures were wrong expectations, not bugs.

Exercises:

1. Break something on purpose (for example make `comparisonKey` return its input unchanged) and see which tests fail. This shows you what each test protects.
2. Write a new unit test for `toWesternDigits`.

---

## Chapter 6. Security and privacy: what you can truthfully say

Know exactly what is and is not protected.

What is true:

- No backend, no accounts, no analytics. The CSP blocks outgoing connections to other sites. You can verify this in the Network tab.
- No `dangerouslySetInnerHTML` (the linter forbids it), so user data is not injected as HTML.
- Exports neutralize spreadsheet formulas in text cells.
- Message data into the worker is validated.
- `npm audit` for production dependencies reports zero vulnerabilities at the time of the last run.

What is not covered, and you should say so:

- A formal security review has not been run.
- Power BI and Metabase exports have not been verified in the real tools.
- The CSP protects the browser session. It does not protect a user who opens the file in other software.
- Hosting headers matter: on a host that ignores `public/_headers`, the CSP would not apply. Cloudflare Pages reads that file, which is why it was chosen.

---

## Chapter 7. Decisions you will be asked to defend

Practice answering each in two sentences.

**Why TypeScript strict and not plain JavaScript?** The code is full of data shapes (columns, specs, messages, exports). Strict types catch shape mistakes at build time, and `noUncheckedIndexedAccess` forces handling of missing array items.

**Why a Web Worker?** To keep the page responsive while parsing and aggregating 100,000 rows, and to keep large data out of React.

**Why no backend?** It is the privacy promise and also removes a whole class of cost, uptime and compliance problems.

**Why not merge similar values automatically?** A wrong silent merge corrupts the user's data. The product suggests, the user decides, and everything is undoable.

**Why does the app refuse to guess some dates?** `03/04/2026` is genuinely ambiguous. Guessing wrong silently shifts every date in the file.

**Why our own CSV parser?** Speed. The library path was about eleven times slower on large files.

**Why our own ZIP writer?** A store-only ZIP is small and simple, and it avoids adding a dependency to the supply chain.

**Why is SheetJS installed from its own tarball?** The npm release lags behind the official distribution. The version is pinned, and that is documented in `CLAUDE.md`.

**Why ECharts and not a charting component library?** Canvas rendering handles large data and many marks well, and tree-shaking keeps the bundle in check.

**Why no AI for chart recommendations?** Rules are explainable, deterministic and testable. For a privacy product, no model call means no data leaves the device.

**Why is there no Metabase push or SQL dump?** A static CSP cannot allow a user-entered server address, and SQL dumps carry dialect and escaping risks. A downloadable CSV and a README is the safe version one.

**Why is the app Arabic-first, and what does that really mean?** Arabic is the default language and RTL is the base layout. More importantly it understands Arabic data: digits, letter variants, header words.

**What would you do next?** Run the security review, test the exports in real Power BI and Metabase, mirror charts for RTL, add PDF export, add an offline mode, and add saved dashboard configs.

---

## Chapter 8. Known limits and honest answers

Say these before someone finds them.

- XLSX export is the slow path: about 4 seconds at 50k rows by 20 columns, about 9 seconds at 100k by 20. It runs in the worker with a progress message.
- Charts are not mirrored for right-to-left yet.
- No PDF export, no offline support, no saved configs, no date-range brush, no drag and resize layout.
- Hijri dates are only a confirmation prompt. There is no calendar conversion.
- Browser load time at 100k by 20 was about 2 to 4 seconds in tests.
- The alias table is small on purpose. It covers common cities and countries only.

---

## Chapter 9. A three-week plan

Adjust freely. The point is the order.

**Week 1: foundations and the engine**

| Day | Do | Outcome |
|---|---|---|
| 1 | Chapter 0, read `CLAUDE.md` | You can state the pitch and five rules |
| 2 | Chapter 1.1 to 1.4, the toy worker, the Network tab check | Workers, typed arrays, CSP make sense |
| 3 | Chapter 1.5 to 1.8, Arabic text experiments | You can explain comparison keys |
| 4 | Chapter 3 steps 1 and 2 (parse), exercise on a weird CSV | You can explain encodings and the parser |
| 5 | Step 3 (profiling), the dictionary exercise | You can explain type and role |
| 6 | Step 4 and 5 (normalization), read `normalize.test.ts` | You can explain suggest and the reversible layer |
| 7 | Rest, rewrite your notes in your own words | Retention |

**Week 2: the pipeline and the UI**

| Day | Do | Outcome |
|---|---|---|
| 8 | Steps 6 and 7 (store, recommendations) | You can explain dictionary encoding and the rules |
| 9 | Step 8 and 9 (aggregation, charts) | You can explain masks and cross-filtering |
| 10 | Step 10 (export), read `export.test.ts` | You can explain the export contract |
| 11 | Chapter 4: app shell, workspace, landing | You know where every screen lives |
| 12 | Chapter 5: tests, break-it exercise | You trust the safety net |
| 13 | Chapter 6 and 7: security and decisions | You can defend choices |
| 14 | Rest, write a one-page architecture summary from memory | Retention |

**Week 3: ownership**

| Day | Do | Outcome |
|---|---|---|
| 15 | Small change 1: add a city alias and a test | You can change data rules |
| 16 | Small change 2: add a chart rule to `recommend.ts` and a test | You can change behavior |
| 17 | Small change 3: add a UI string in both languages | You can touch the UI |
| 18 | Run the security review and read its findings | You know the risk |
| 19 | Test the Power BI package yourself and note what breaks | You know the truth about exports |
| 20 | Mock interview with a friend using the questions below | Fluency |
| 21 | Deploy to a free host and verify the CSP in the browser | You can ship it |

---

## Chapter 10. Interview and demo questions

Practice these aloud.

1. Walk me through what happens when I drop a file on your app.
2. How do you guarantee my file is not uploaded?
3. What happens if two cities are spelled differently? Can I undo the merge?
4. Why are some numeric columns not summed?
5. How do you handle the date `03/04/2026`?
6. How does the dashboard stay fast with 100,000 rows?
7. What is in the Power BI package and how do I use it?
8. What did you build with AI help, and how did you verify it?
9. What is the weakest part of this project?
10. If a user reports wrong totals after a merge, where do you look first?

Model answer for question 8, in your own voice: you directed the product and architecture decisions, used AI assistance for implementation, and verified it with unit tests, end-to-end tests, accessibility scans, a benchmark, and by reading and changing the code yourself. That is honest and it is a strong answer.

Model answer for question 10: reproduce with the smallest file, check the decision in the display layer (`normalize/layer.ts`), check that the aggregation reads through it (`worker/columnStore.ts`), and check that the export reads through it (`export/tidy.ts`).

---

## Chapter 11. Quick reference

Commands:

```bash
npm run dev           # dev server
npm run build         # typecheck and production build
npm run preview       # serve the production build with the real CSP
npm run typecheck
npm run lint
npm test              # unit tests
npm run e2e           # Playwright against the production build
npm run bench         # Node stage timings
npm run bench:browser # real worker and UI timings
npm run audit:prod    # production dependency audit
```

Glossary:

- **Worker:** a second thread that cannot touch the page.
- **Columnar storage:** one array per column instead of an object per row.
- **Dictionary encoding:** store each distinct string once, store rows as small integers.
- **Comparison key:** a cleaned form of a value used only to find matches.
- **Display layer:** the approved merges applied on top of untouched data.
- **Role:** dimension, measure, identifier or unknown. Controls allowed calculations.
- **CSP:** a header that limits what the page may load or connect to.
- **Cross-filter:** clicking one chart filters all the others.
- **Mask:** a per-row yes or no for the current filters.
- **Tidy table:** the one typed table every export format is generated from.
- **BOM:** a marker at the start of a file that tells Excel it is UTF-8.
- **RTL:** right-to-left layout.
- **Power Query (M):** the language Power BI uses to load and shape data.

---

## Final check: do you understand it?

You are done when you can do all of these without help:

- Draw the data flow on a whiteboard from file drop to chart, naming the files.
- Explain the five rules and one code location where each is enforced.
- Make a small change, run the tests, and explain why they pass.
- Answer the ten questions in Chapter 10 without notes.
- Name three things that are not finished, without being asked.

When you can, you are not claiming someone else's work. You own a project you can explain, change and defend.
