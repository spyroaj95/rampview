# KNOWLEDGE.md — AeroVect ground-handling intelligence primer

This file grounds the Tier B enrichment. It is context for humans and for the
research subagents in `scripts/enrich/`. Treat it as background, not gospel:
anything written into `airports.json` must still carry its own source.

## What AeroVect sells (and why the data model looks the way it does)

AeroVect is autonomous-driving software that **retrofits existing** airport
baggage and cargo tractors so they operate driverless, sold as
**robotics-as-a-service** (opex, not capex). The wedge versus every competitor is
that AeroVect does **not** sell new vehicles — it makes the tractors an operator
already owns autonomous.

That is why the whole tool is organized around one question per airport: **who
operates the ground support equipment (GSE), and are they a target?** The buyer
is whoever owns the ramp labor and the tractors — sometimes the airline
(carrier-led), sometimes an outsourced ground handler (handler-led), often both
(mixed).

## The autonomous-GSE competitive picture

| Vendor | Model | Notable alignment |
| --- | --- | --- |
| **TractEasy** (EZTow) | Purpose-built autonomous tow tractors | Deployed with **dnata** (incl. DWC) |
| **Aurrigo** (Auto DollyTug) | Purpose-built autonomous baggage/cargo dollies | **Swissport's** first global autonomous ground-handling pilot (Zurich, 2025) |
| **AeroVect** | **Retrofit** kit + autonomy software, as a service | Partner: **GAT** (US regional handler, up to ~50 US vehicles) |

AeroVect's counter-position: TractEasy and Aurrigo ask an operator to buy a new
fleet; AeroVect makes the current fleet autonomous. Lower capital, faster to
scale across a mixed fleet.

## The ground handlers that matter

| Handler | Scale | Notes for AeroVect |
| --- | --- | --- |
| **Swissport** | #1 globally | Currently aligned with **Aurrigo**. Contested, not lost. |
| **dnata** | ~130 airports / 35+ countries / 700k+ turns per year | Part of the **Emirates Group** (Investment Corporation of Dubai). AeroVect **pilot** (up to 100 autonomous vehicles across DXB + DWC). Hedges across vendors (also runs TractEasy). |
| **Menzies Aviation** | ~350 airports / 65 countries | Broad third-party footprint. |
| **Unifi Aviation** | ~210 US airports | **Delta owns ~20%**; grew out of Delta Global Services. A Delta reference is the bridge to Unifi's US network. |
| **SATS** | Asia-Pacific leader (Singapore Changi home) | Government-linked; autonomy-forward market. |
| **GAT** | US regional handler | **AeroVect partner** (up to ~50 US vehicles). |
| **Fraport Ground Services (FraGround)** | Frankfurt | Fraport is **both the airport operator and the handler** — the rare "authority + handler in one." |

## Ownership archetypes (who can say yes)

- **Sovereign / government-linked** (DXB, DWC, DOH, AUH, SIN, ICN, PEK): capital-rich,
  autonomy-forward, but access and procurement can be political.
- **Airport authority = handler** (FRA / Fraport): a single decision-maker owns the
  ramp labor. Cleanest single-throat-to-choke, but co-determination stakeholders
  (works councils) matter — frame autonomy as filling *unstaffable* jobs.
- **Carrier fortress hubs** (DFW/American, ATL/Delta): the airline self-handles, so
  the airline is the buyer and the reference travels to its whole network.
- **US public airports with multi-handler ramps** (JFK, LAX, ORD, MCO, LAS): high
  labor turnover is the tailwind; several handlers per field means several buyers.

## Recurring tailwinds to look for during enrichment

1. **Ramp labor shortage / turnover** — the core "unstaffable shift" argument. Acute
   in the US, Japan, and parts of Europe.
2. **Existing autonomy trials** — an operator that already trialed autonomy (Fraport's
   ~8km apron route; Changi and Singapore trials; Incheon smart-airport pilots) has
   already made the internal case.
3. **Greenfield / newly expanded aprons** (DWC, PKX) — clean-sheet deployment
   environments.
4. **Capital-rich, autonomy-forward operators** (Gulf carriers/handlers, Changi,
   Incheon) — willingness and budget to move.

## Tiers (how the schema is split)

- **Tier A — auto-seedable** from open sources (OurAirports, Wikidata/Wikipedia):
  name, IATA/ICAO, coordinates, country/region, size class, annual passengers,
  owner/operator, hub carriers. Seeded by `scripts/buildSeed.ts`.
- **Tier B — golden, not public in structured form**: GSE model (carrier vs handler
  led), which ground handler, GSE fleet estimate, labor pressure, AeroVect account
  status, competitor presence, tailwinds/news, ops notes. Enriched by hand or by the
  `scripts/enrich/` subagents. Every Tier B field carries a **confidence** and a
  **source**. **Unknown is a first-class, correct value — never fabricate it.**

## Insurance-of-GSE glossary (quick reference)

- **GSE**: Ground Support Equipment (tractors, dollies, belt loaders, pushbacks).
- **Ramp / apron**: the aircraft parking and servicing area where GSE operates.
- **Turn**: one aircraft turnaround (deplane, unload, load, board). dnata does 700k+/yr.
- **Handler-led vs carrier-led**: whether an outsourced ground handler or the airline
  itself owns the ramp operation and the tractors.
- **Fronting / self-handling**: an airline running its own ground ops rather than
  contracting a handler.
