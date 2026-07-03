# KNOWLEDGE.md: AeroVect ground-handling intelligence primer

This file grounds the Tier B enrichment. It is context for humans and for the
research subagents in `scripts/enrich/`. Treat it as background, not gospel:
anything written into `airports.json` must still carry its own source.

## What AeroVect sells (and why the data model looks the way it does)

AeroVect is autonomous-driving software that **retrofits existing** airport
baggage and cargo tractors so they operate driverless, sold as
**robotics-as-a-service** (opex, not capex). The wedge versus every competitor is
that AeroVect does **not** sell new vehicles: it makes the tractors an operator
already owns autonomous.

That is why the whole tool is organized around one question per airport: **who
operates the ground support equipment (GSE), and are they a target?** The buyer
is whoever owns the ramp labor and the tractors: sometimes the airline
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
| **Unifi Aviation** | ~210 US airports | **Delta holds ~49% (minority)**; grew out of Delta Global Services. A Delta reference is the bridge to Unifi's US network. |
| **SATS** | Asia-Pacific leader (Singapore Changi home) | Government-linked; autonomy-forward market. |
| **GAT** | US regional handler | **AeroVect partner** (up to ~50 US vehicles). |
| **Fraport Ground Services (FraGround)** | Frankfurt | Fraport is **both the airport operator and the handler**: the rare "authority + handler in one." |

## Ownership archetypes (who can say yes)

- **Sovereign / government-linked** (DXB, DWC, DOH, AUH, SIN, ICN, PEK): capital-rich,
  autonomy-forward, but access and procurement can be political.
- **Airport authority = handler** (FRA / Fraport): a single decision-maker owns the
  ramp labor. Cleanest single-throat-to-choke, but co-determination stakeholders
  (works councils) matter: frame autonomy as filling *unstaffable* jobs.
- **Carrier fortress hubs** (DFW/American, ATL/Delta): the airline self-handles, so
  the airline is the buyer and the reference travels to its whole network.
- **US public airports with multi-handler ramps** (JFK, LAX, ORD, MCO, LAS): high
  labor turnover is the tailwind; several handlers per field means several buyers.

## Recurring tailwinds to look for during enrichment

1. **Ramp labor shortage / turnover**: the core "unstaffable shift" argument. Acute
   in the US, Japan, and parts of Europe.
2. **Existing autonomy trials**: an operator that already trialed autonomy (Fraport's
   ~8km apron route; Changi and Singapore trials; Incheon smart-airport pilots) has
   already made the internal case.
3. **Greenfield / newly expanded aprons** (DWC, PKX): clean-sheet deployment
   environments.
4. **Capital-rich, autonomy-forward operators** (Gulf carriers/handlers, Changi,
   Incheon): willingness and budget to move.

## The buying committee (who signs, who blocks)

Selling autonomous GSE is a committee sale. RampView's contact personas encode it:

- **VP Ground Ops** (BUYER): the economic buyer and usual champion. Owns the P&L
  the labor gap is bleeding.
- **Head of GSE Fleet** (OWNER): the functional owner. The retrofit story is FOR
  this person: their existing tractors become autonomous, no fleet replacement.
- **Head of Safety / SMS** (GATE): can veto everything via the safety case. Win
  early with data from live deployments.
- **Head of Innovation** (ENTRY): the usual door in and first champion; convert
  their pilot into the ops org's program.
- **Procurement** (COMMERCIAL): the commercial gate; RaaS terms simplify this.
- **Finance / CFO** (FINANCE): capex vs opex. Robotics-as-a-service turns a fleet
  purchase into an operating line, which is the lever.
- **Station / Ramp Manager** (LOCAL): local make-or-break at go-live; if the ramp
  hates it, the rollout dies quietly.
- **Airport Authority** (AUTHORITY): external airside-approval gate, sometimes a
  mandator (and at Fraport, the same entity as the handler).
- **Labor / Works Council** (STAKEHOLDER): neutralize by framing autonomy as
  filling unstaffable shifts, never as headcount cuts. In Germany the
  Betriebsrat has real statutory power.
- **Exec Sponsor** (SPONSOR): CEO/CCO level, needed on network-wide deals.

## Warm bridges (how one win becomes many)

- **dnata DXB pilot** travels the dnata network (~130 airports) and, via the
  Emirates Group parent (Investment Corporation of Dubai), bridges to Emirates
  the airline.
- **Delta pilot** bridges to Unifi (Delta holds a ~49% minority stake) and Unifi's ~210 US
  stations; ATL is the hinge.
- **Prove dnata, sell Menzies**: a credible handler reference is the door into
  the other global handlers (~350 airports at Menzies).
- Encoded as arcs in src/data/bridges.json; each bridge carries a rationale and
  feeds the BRIDGE component of the opportunity score.

## The economics (what feeds the RaaS value model)

Inputs behind src/lib/valueModel.ts. Sourced facts vs assumptions are labeled;
the UI shows the same labels on every input.

- **Ramp wages**: US baggage/ramp roles post at roughly $13-19/hr
  (agent-sourced job postings at MCO/LAS, 2026). Loaded FTE cost adds ~30-35%
  employer burden. The $45K default loaded cost is an ASSUMPTION in that range.
- **Turnover**: ~35% annually in some US regions (Aviation Pros); ~100% at some
  large hubs (Air Cargo Week citing SFO). The 60% default is an ASSUMPTION
  inside the sourced range. Replacement cost per departure (recruiting,
  training, badging) modeled at 25% of loaded cost: ASSUMPTION.
- **Ground damage**: industry projections (IATA) put annual ground-damage cost
  on a path toward ~$10B by 2035. Not yet modeled as a line item; listed as a
  qualitative tailwind.
- **Per-turn savings**: AeroVect materials cite 14-18% per-turn cost savings.
  INTERNAL CLAIM, not independently verified; not used directly in the model.
- **RaaS fee and onboarding cost**: placeholders ($30K/unit/yr, $10K/unit)
  until real pricing is loaded. ASSUMPTIONS, marked as such in the UI.

Deal `value` and the weighted-pipeline metric derive from units x RaaS fee, so
the pipeline numbers always reconcile with the visible model.

## Tiers (how the schema is split)

- **Tier A: auto-seedable** from open sources (OurAirports, Wikidata/Wikipedia):
  name, IATA/ICAO, coordinates, country/region, size class, annual passengers,
  owner/operator, hub carriers. Seeded by `scripts/buildSeed.ts`.
- **Tier B: golden, not public in structured form**: GSE model (carrier vs handler
  led), which ground handler, GSE fleet estimate, labor pressure, AeroVect account
  status, competitor presence, tailwinds/news, ops notes. Enriched by hand or by the
  `scripts/enrich/` subagents. Every Tier B field carries a **confidence** and a
  **source**. **Unknown is a first-class, correct value: never fabricate it.**

## Insurance-of-GSE glossary (quick reference)

- **GSE**: Ground Support Equipment (tractors, dollies, belt loaders, pushbacks).
- **Ramp / apron**: the aircraft parking and servicing area where GSE operates.
- **Turn**: one aircraft turnaround (deplane, unload, load, board). dnata does 700k+/yr.
- **Handler-led vs carrier-led**: whether an outsourced ground handler or the airline
  itself owns the ramp operation and the tractors.
- **Fronting / self-handling**: an airline running its own ground ops rather than
  contracting a handler.
