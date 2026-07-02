# RampView

An interactive 3D globe of the world's ~200 busiest airports, built as a
**go-to-market intelligence tool for AeroVect** (autonomous driving software that
retrofits existing airport ground-support tractors, sold as robotics-as-a-service).

Spin the earth, click a glowing airport, and get an intelligence panel: who runs
the ground support equipment, how big the operation is, whether an autonomy
competitor is already on site, and where the airport sits in AeroVect's pipeline
(customer → pilot → active target → prospect → watch → competitor-held).

> No public dataset says who operates the GSE at each airport. RampView is the
> system of record AeroVect builds up over time — seeded automatically for the
> boring facts, enriched by hand and by research agents for the golden ones.

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

The build is a static SPA in `dist/` with **relative asset paths** (`base: './'`),
so it deploys anywhere with no configuration:

```bash
# Vercel (recommended) — from the project root:
npx vercel --prod
#   Framework preset: Vite · Build: npm run build · Output dir: dist

# Netlify:
npx netlify deploy --prod --dir=dist

# GitHub Pages:
npm run build && npx gh-pages -d dist
```

There is no server, database, or API key. `src/data/airports.json` ships in the
repo, so a fresh clone runs with zero setup.

---

## The two-tier data model

Every airport is one record (`src/types/airport.ts`). Fields are split into two
tiers, and the UI shows which is which on every panel section.

- **Tier A — auto-seedable** from open sources: name, IATA/ICAO, coordinates,
  country/region, size class, annual passengers, owner/operator, hub carriers.
- **Tier B — golden, not public in structured form**: GSE model (carrier- vs
  handler-led), ground handler(s), GSE fleet estimate, labor pressure, AeroVect
  account status, competitor presence, tailwinds/news, ops notes.

**Tier B is never fabricated.** `unknown` is a first-class value, shown in the UI as
a muted "unknown, not yet researched" so the gaps are visible and inviting. Every
enriched Tier B field carries a **confidence** (high/medium/low) and **sources**.

## Point encoding on the globe

- **Color = AeroVect pipeline status** — customer (green), pilot (teal), active
  target (amber), prospect (blue), watch (gray), competitor-held (red), unknown (dim).
- **Size = annual passengers** (sqrt-scaled).
- **Dimmed** = filtered out by the active status/region/handler/size filters.

---

## How the data is built

### 1. Seed the Tier A skeleton — `npm run build:seed`

`scripts/buildSeed.ts` regenerates `src/data/airports.json` from open sources
committed under `scripts/rawdata/`:

- **OurAirports** (`airports.csv`, `countries.csv`, public domain) → names, codes,
  coordinates, country, continent.
- A curated top-~200 passenger table (in the script) → annual passengers, which
  drives point size.

It then deep-merges the hand-verified **Tier B marquee records** (DXB, DWC, ATL,
FRA, SIN, ZRH in depth; LHR/CDG/AMS/IST/JFK/LAX/ORD/DFW/DEN/HKG/DOH/AUH/MEX/GRU/
PEK/PKX as coverage prospects). The generated file is committed, so you never have
to run this to use the app — only to regenerate.

### 2. Enrich Tier B with research agents — `scripts/enrich/`

The multi-agent workflow, run 10–20 airports at a time:

```bash
npm run enrich:plan 12     # pick the next 12 airports missing Tier B,
                           # write scripts/enrich/tasks.json + a research brief
# → hand each task to a research subagent (one per airport, in parallel).
#   Each finds ground handler(s), carrier/handler-led, competitor presence,
#   labor signals, and news — WITH sources — and writes results/<IATA>.json.
npm run enrich:merge       # merge results back into airports.json, safely
```

`enrich:merge` guardrails:

- Skips any result with no sources.
- Never overwrites an existing non-empty Tier B field (human entries win).
- Only promotes `aerovectStatus` from `unknown`; never downgrades a confidence.
- Logs, per airport, which fields were filled vs left unknown.

See `scripts/enrich/results/example.json` for the exact result shape, and
`KNOWLEDGE.md` for the handler/competitor facts the agents are grounded in.

---

## Editing an airport in the app (no backend)

1. Click any airport, then **Edit intelligence**.
2. Fill in Tier B fields (ground handlers, competitors, tailwinds, status, notes).
   Unknown is fine — leave blank.
3. **Save to map** updates the live globe in memory.
4. **Download airports.json** (or **Copy JSON**) produces the full, updated file.
   Commit it to the repo — `src/data/airports.json` stays the single source of truth.

Every save stamps `lastUpdated` automatically.

---

## Architecture

```
src/
  types/airport.ts        # the schema — Tier A / Tier B, used everywhere
  services/dataService.ts # the ONLY module that knows where data lives.
                          #   Swap loadAirports() for a fetch() to go to a DB
                          #   later without touching any component.
  lib/                    # status→color metadata, formatting helpers
  components/
    GlobeView.tsx         # react-globe.gl points + rings + fly-to + auto-rotate
    TopBar.tsx            # brand (logo slot), live stats, search-to-fly
    FilterBar.tsx         # status / region / handler / size filters
    Legend.tsx            # color key + live per-status counts
    DetailPanel.tsx       # the intelligence panel
    EditForm.tsx          # Tier B editor + JSON export
scripts/
  buildSeed.ts            # regenerate airports.json from open sources
  enrich/enrich.ts        # plan + merge for the multi-agent enrichment
  rawdata/                # committed OurAirports CSVs
```

**Data access is entirely behind `dataService`.** Migrating from the JSON file to a
hosted database is a one-file change (make `loadAirports()` do `await fetch(...)`);
no component imports the JSON directly.

## Tech

React + Vite + TypeScript · `react-globe.gl` (three.js) · static, no backend.

## Branding

The dark theme uses a cyan + amber accent as a placeholder. The **AeroVect logo
slot** is marked in `src/components/TopBar.tsx`; swap the `--brand-*` tokens in
`src/index.css` for AeroVect's real palette.

## Data sources

- [OurAirports](https://ourairports.com/data/) — airport names, codes, coordinates
  (public domain).
- Passenger volumes — recent ACI / airport-authority annual totals (curated table
  in `scripts/buildSeed.ts`).
- Tier B — per-record sources cited in each airport's `sources` field.
