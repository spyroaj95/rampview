# RampView

An interactive 3D globe of the world's ~200 busiest airports, built as the
**go-to-market operating system for AeroVect** (autonomous driving software that
retrofits existing airport ground-support tractors, sold as robotics-as-a-service).

Spin the earth, click a glowing airport, and read the instrument panel: who runs
the ground support equipment, whether an autonomy competitor is on site, the
deal stage and buying committee, warm-bridge expansion paths, and a transparent
opportunity score. Then flip to Pipeline, Board, Network, Whitespace, or
Coverage: same data, different lenses.

> No public dataset says who operates the GSE at each airport. RampView is the
> system of record AeroVect builds up over time: seeded automatically for the
> boring facts, enriched by hand and by research agents for the golden ones,
> and never fabricated. Unknown is a first-class value.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Build and preview the production bundle:

```bash
npm run build      # type-checks, then builds to dist/
npm run preview    # serves dist/ locally
```

## Deploy (static, zero backend)

```bash
# Vercel (recommended):
npx vercel --prod
#   Framework preset: Vite · Build: npm run build · Output dir: dist

# Netlify:            npx netlify deploy --prod --dir=dist
# GitHub Pages:       npm run build && npx gh-pages -d dist
```

No server, database, or API key. Asset paths are relative (`base: './'`), so any
static host works with zero config.

**Before a public deploy, read the Privacy section below.**

---

## The views

| View | What it shows |
| --- | --- |
| **GLOBE** | Full-viewport globe. Point size = passengers; color = the active layer (status, opportunity score, competitor presence, or research confidence) via the bottom-right toggle. |
| **PIPELINE** | Sortable, filterable deal table + live metrics (units in pipe, units live, weighted value, pilots, stalled 30d+). Gated on deployed builds. |
| **BOARD** | Kanban by deal stage; drag cards to move deals. Gated on deployed builds. |
| **NETWORK** | Handler/carrier rollups (dnata, Swissport, Menzies, Unifi, GAT, Delta...) with ours/contested/open counts, plus warm-bridge expansion arcs drawn on the globe. Add bridges in-app. |
| **WHITESPACE** | Ours / contested / open / unknown coloring with an "only open" toggle and a ranked open-target list. |
| **COVERAGE** | How much of the golden Tier B is populated per field and region, plus an "enrich next" list (high score, low confidence) to aim the research agents. |

**▶ WALKTHROUGH** plays the hands-free founder demo (~80s): DXB and the dnata
pilot, the Emirates Group bridge, ATL and Delta-to-Unifi, Fraport as
authority+handler, the ZRH loss to Aurrigo, then the whitespace sweep.

### Keyboard

`/` search · `Esc` close · `i` toggle panel · `←/→` cycle airports by opportunity
score · `g p b n w c` switch views · `?` shortcut overlay

---

## The two-tier data model

Every airport is one record (`src/types/airport.ts`), split into:

- **Tier A, auto-seedable**: name, IATA/ICAO, coordinates, country/region, size
  class, passengers, owner, hub carriers. From OurAirports + curated ACI totals.
- **Tier B, golden**: GSE model (carrier- vs handler-led), ground handlers, fleet
  estimate, labor pressure, AeroVect status, competitor presence, tailwinds, ops
  notes. **Researched, never fabricated**; every enriched field carries
  confidence + sources, and the UI renders unknowns as "unknown, not yet
  researched."

### Opportunity score (transparent, no hidden weights)

`src/lib/scoring.ts` sums six visible components to 0-100: VOLUME 25, LABOR 15,
GSE MODEL 15, BRIDGE 15, WHITESPACE 20, MARKET 10. Hover the SCORE chip in the
panel for the per-component breakdown. Unknown Tier B contributes 0 with an
explicit "not yet researched" reason, so a low score can mean "low intel"; the
Coverage view surfaces exactly those gaps.

---

## CRM / pipeline layer

Deals live in `src/data/pipeline.json`, **keyed by airport id and separate from
reference data**. Schema in `src/types/pipeline.ts`: stage, owner, units
target/live, value, next step + due, contacts, activity log.

Contacts carry a **persona role** from the real aviation buying committee:

| Persona | Tag | Why they matter |
| --- | --- | --- |
| VP Ground Ops | BUYER | Economic buyer, usual champion |
| Head of GSE Fleet | OWNER | Functional owner the retrofit story targets |
| Head of Safety / SMS | GATE | Veto via the safety case |
| Head of Innovation | ENTRY | Usual entry point, early champion |
| Procurement | COMMERCIAL | Commercial gate |
| Finance / CFO | FINANCE | Capex vs opex; RaaS is the lever |
| Station / Ramp Manager | LOCAL | Local make-or-break |
| Airport Authority | AUTHORITY | Airside-approval gate or mandator |
| Labor / Works Council | STAKEHOLDER | Neutralize: autonomy fills unstaffable shifts |
| Exec Sponsor | SPONSOR | CEO/CCO on network deals |

Edit deals in the panel's PIPELINE tab or drag cards on the Board; then
**Download pipeline.json** and keep it local.

## Privacy (C1: read before deploying)

Real contacts and deal notes must never reach a public deploy. Three layers:

1. **`src/data/pipeline.json` is gitignored.** It only ever exists on your
   machine. The repo commits `pipeline.sample.json` with clearly-dummy contacts,
   so fresh clones and CI builds contain nothing sensitive.
2. **The app loads the real file only when present locally** (build-time glob
   fallback to the sample). A public deploy built from a fresh checkout ships
   the sample; the top bar shows a SAMPLE CRM badge whenever the sample is live.
3. **PIPELINE and BOARD views (and the panel's PIPELINE tab) are passphrase-gated
   on production builds.** Default passphrase `rampview`; change the SHA-256 in
   `src/lib/gate.ts`. This is a deterrent, not encryption; the structural
   protection is layers 1-2. Airport reference data stays public by design.

If you build a private deploy WITH your local pipeline.json present, treat the
whole deployment as confidential.

---

## How the data is built and kept fresh

```bash
npm run build:seed        # regenerate airports.json from OurAirports + curated table
npm run enrich:plan 12    # research briefs for the next 12 un-researched airports
npm run enrich:merge      # merge agent results (sources required, enums sanitized,
                          #   never overwrites human entries)
npm run news:plan 8       # research briefs: tailwind refresh for tracked airports
                          #   + standing topics (TractEasy, Aurrigo, Swissport,
                          #   dnata, ramp labor)
npm run news:merge        # merge: url required, dedupe by url, firstSeen stamped,
                          #   human items never deleted; writes newsDigest.json
                          #   which powers the What's New badge
```

Between plan and merge, run one research subagent per task in parallel (each
brief is self-contained in `scripts/*/tasks.json`). Results land in
`scripts/enrich/results/` and `scripts/news/results/`.
`.github/workflows/news-refresh.yml` is an optional CI template that opens a
reviewable PR; it requires wiring an agent runner and never invents items.

## Warm bridges

`src/data/bridges.json` records expansion arcs (from, to, via org, rationale):
dnata DXB to AUH/SIN/LHR, Delta ATL to Unifi JFK/LAX/MCO. Add more in the
Network view, then download and commit the file. Bridges feed the BRIDGE
component of the opportunity score and the arcs on the globe.

## Reporting

- **Export CSV** (Pipeline view, or "Export open CSV" in Whitespace): the
  on-screen rows with status, score, handlers, competitors, deal fields.
- **Account brief** (panel action): a printable one-pager per airport: overview,
  ownership, ground ops, buying committee, competitor status, bridges,
  tailwinds, score breakdown, sources. Built for meeting prep.

---

## Architecture

```
src/
  types/            airport.ts (Tier A/B), pipeline.ts (deals, personas, bridges)
  services/         dataService.ts, pipelineService.ts   <- ALL data access
  lib/              scoring.ts, layers.ts, orgs.ts, exports.ts, gate.ts,
                    demoScript.ts, statusMeta.ts, format.ts
  components/       GlobeView, TopBar, FilterBar, Legend, LayerToggle,
                    DetailPanel (INTEL | PIPELINE tabs), PipelinePanel, EditForm,
                    PipelineTable, BoardView, NetworkView, WhitespacePanel,
                    CoverageView, DemoMode, PassGate, Modals
  data/             airports.json, pipeline.sample.json, bridges.json,
                    newsDigest.json   (pipeline.json is local-only, gitignored)
scripts/
  buildSeed.ts      Tier A seed from OurAirports
  enrich/enrich.ts  Tier B research plan/merge with guardrails
  refreshNews.ts    tailwind refresh plan/merge + What's New digest
```

Every component reads through `dataService`/`pipelineService`; swapping the JSON
files for a hosted database later is a service-layer change only.

## Data sources & attribution

- [OurAirports](https://ourairports.com/data/): airport names, codes,
  coordinates (public domain).
- Passenger volumes: recent ACI / airport-authority annual totals (curated in
  `scripts/buildSeed.ts`).
- Owner/hub facts and Tier B enrichment: Wikipedia/Wikidata (CC BY-SA) and cited
  industry sources; every enriched record lists its sources in the panel.
- Globe textures: NASA Visible Earth imagery via three-globe example assets.
- In-app: the ⓘ button shows the same credits.

## Branding

Dark instrument theme, monochrome + one cyan accent. The AeroVect logo slot is
marked in `src/components/TopBar.tsx`; swap the `--brand-*` tokens in
`src/index.css` to adopt the real palette.
