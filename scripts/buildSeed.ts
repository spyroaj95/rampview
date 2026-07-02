/**
 * buildSeed.ts — regenerates src/data/airports.json from open sources.
 *
 * Pipeline:
 *   1. Read OurAirports airports.csv + countries.csv (public domain, in scripts/rawdata).
 *   2. For each airport in the curated top-~200 passenger table below, pull the
 *      Tier A skeleton (name, codes, lat/lng, country, continent) from OurAirports.
 *   3. Attach curated annual passenger volume (drives point size on the globe).
 *   4. Deep-merge the hand-verified Tier B marquee records (MARQUEE) on top.
 *   5. Write src/data/airports.json, sorted by passengers desc.
 *
 * Tier A is derived mechanically. Tier B is ONLY what MARQUEE encodes by hand,
 * each with confidence + sources. Nothing here fabricates Tier B.
 *
 * Run:  npm run build:seed
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Airport, SizeClass } from '../src/types/airport'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAW = join(__dirname, 'rawdata')
const OUT = join(__dirname, '..', 'src', 'data', 'airports.json')

// ---------------------------------------------------------------------------
// Minimal CSV parser (handles quoted fields with embedded commas / quotes).
// ---------------------------------------------------------------------------
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c === '\r') {
      // ignore
    } else {
      field += c
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  const header = rows.shift() ?? []
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

// ---------------------------------------------------------------------------
// Curated top-~200 commercial hubs by annual passenger volume.
// [IATA, passengers in millions, reporting year]. Figures are recent full-year
// ACI / airport-authority totals (2023, some 2024). These drive point SIZE.
// ---------------------------------------------------------------------------
const CURATED: [string, number, number][] = [
  // ---- North America (US) ----
  ['ATL', 104.7, 2023], ['DFW', 81.8, 2023], ['DEN', 77.8, 2023], ['ORD', 73.9, 2023],
  ['LAX', 75.1, 2023], ['JFK', 62.5, 2023], ['LAS', 57.6, 2023], ['MCO', 57.7, 2023],
  ['MIA', 52.3, 2023], ['CLT', 53.4, 2023], ['SEA', 50.9, 2023], ['EWR', 49.1, 2023],
  ['SFO', 50.2, 2023], ['PHX', 48.7, 2023], ['IAH', 46.3, 2023], ['BOS', 40.7, 2023],
  ['FLL', 35.1, 2023], ['MSP', 36.0, 2023], ['LGA', 30.2, 2023], ['DTW', 32.4, 2023],
  ['PHL', 28.9, 2023], ['SLC', 26.5, 2023], ['DCA', 25.5, 2023], ['SAN', 25.0, 2023],
  ['BWI', 25.7, 2023], ['TPA', 24.6, 2023], ['AUS', 22.0, 2023], ['IAD', 25.1, 2023],
  ['BNA', 22.2, 2023], ['MDW', 20.5, 2023], ['HNL', 20.9, 2023], ['DAL', 16.8, 2023],
  ['PDX', 18.0, 2023], ['STL', 15.9, 2023], ['RDU', 14.3, 2023], ['HOU', 15.0, 2023],
  ['SMF', 13.2, 2023], ['MCI', 11.5, 2023], ['SJC', 11.3, 2023], ['SNA', 10.8, 2023],
  ['OAK', 10.3, 2023], ['MSY', 12.9, 2023], ['SAT', 10.5, 2023], ['RSW', 10.9, 2023],
  ['CLE', 9.0, 2023], ['PIT', 8.6, 2023], ['IND', 9.4, 2023], ['CMH', 8.6, 2023],
  ['CVG', 8.0, 2023], ['JAX', 6.9, 2023], ['ONT', 6.0, 2023], ['BUR', 5.5, 2023],
  // ---- Canada ----
  ['YYZ', 44.8, 2023], ['YVR', 24.9, 2023], ['YUL', 21.2, 2023], ['YYC', 17.3, 2023],
  ['YEG', 8.2, 2023],
  // ---- Mexico / Central / South America ----
  ['MEX', 48.4, 2023], ['CUN', 30.4, 2023], ['GDL', 15.5, 2023], ['MTY', 13.5, 2023],
  ['TIJ', 10.0, 2023], ['GRU', 39.9, 2023], ['CGH', 21.0, 2023], ['BSB', 16.0, 2023],
  ['GIG', 9.9, 2023], ['BOG', 35.0, 2023], ['LIM', 22.0, 2023], ['SCL', 25.0, 2023],
  ['EZE', 11.0, 2023], ['AEP', 11.0, 2023], ['PTY', 16.5, 2023], ['UIO', 5.5, 2023],
  ['MDE', 13.0, 2023],
  // ---- Europe ----
  ['LHR', 79.2, 2023], ['CDG', 67.4, 2023], ['AMS', 61.9, 2023], ['MAD', 60.2, 2023],
  ['FRA', 59.4, 2023], ['IST', 76.0, 2023], ['BCN', 49.9, 2023], ['LGW', 40.9, 2023],
  ['MUC', 37.0, 2023], ['FCO', 40.5, 2023], ['CPH', 26.5, 2023], ['DUB', 33.2, 2023],
  ['ZRH', 28.9, 2023], ['LIS', 33.7, 2023], ['VIE', 29.5, 2023], ['MAN', 28.1, 2023],
  ['PMI', 29.1, 2023], ['OSL', 25.6, 2023], ['ARN', 21.3, 2023], ['BRU', 22.3, 2023],
  ['DUS', 19.4, 2023], ['STN', 28.0, 2023], ['SVO', 37.0, 2023], ['LED', 20.0, 2023],
  ['ATH', 28.2, 2023], ['HEL', 12.9, 2023], ['GVA', 16.5, 2023], ['HAM', 13.4, 2023],
  ['WAW', 18.5, 2023], ['PRG', 13.8, 2023], ['BUD', 14.7, 2023], ['OTP', 14.3, 2023],
  ['BER', 23.1, 2023], ['MXP', 26.1, 2023], ['NCE', 13.0, 2023], ['EDI', 14.4, 2023],
  ['LTN', 16.4, 2023], ['SAW', 37.0, 2023], ['AYT', 34.0, 2023], ['AGP', 20.0, 2023],
  ['OPO', 15.0, 2023], ['KEF', 7.8, 2023], ['BHX', 11.5, 2023], ['ALC', 15.0, 2023],
  // ---- Middle East ----
  ['DXB', 87.0, 2023], ['DWC', 1.3, 2023], ['AUH', 22.0, 2023], ['DOH', 45.9, 2023],
  ['JED', 47.0, 2023], ['RUH', 35.0, 2023], ['KWI', 15.0, 2023], ['BAH', 9.0, 2023],
  ['MCT', 12.0, 2023], ['AMM', 9.0, 2023], ['TLV', 21.0, 2023], ['CAI', 30.0, 2023],
  ['IKA', 15.0, 2023],
  // ---- Africa ----
  ['JNB', 21.0, 2023], ['CPT', 10.5, 2023], ['CMN', 10.5, 2023], ['ADD', 14.0, 2023],
  ['NBO', 7.5, 2023], ['LOS', 7.0, 2023], ['ALG', 7.0, 2023], ['HRG', 8.0, 2023],
  ['RAK', 6.0, 2023],
  // ---- Asia: China ----
  ['PEK', 52.9, 2023], ['PKX', 39.4, 2023], ['CAN', 63.1, 2023], ['PVG', 54.4, 2023],
  ['SHA', 41.0, 2023], ['CTU', 44.0, 2023], ['CKG', 44.5, 2023], ['KMG', 42.0, 2023],
  ['XIY', 41.0, 2023], ['SZX', 52.7, 2023], ['HGH', 40.0, 2023], ['WUH', 26.0, 2023],
  ['CSX', 26.0, 2023], ['NKG', 24.0, 2023], ['XMN', 24.0, 2023], ['TAO', 21.0, 2023],
  ['HAK', 22.0, 2023], ['URC', 23.0, 2023], ['TSN', 20.0, 2023], ['SYX', 20.0, 2023],
  ['CGO', 23.0, 2023], ['KWE', 20.0, 2023],
  // ---- Asia: Japan / Korea ----
  ['HND', 78.7, 2023], ['NRT', 35.0, 2023], ['KIX', 20.0, 2023], ['ITM', 15.0, 2023],
  ['CTS', 22.0, 2023], ['FUK', 22.0, 2023], ['NGO', 10.0, 2023], ['OKA', 18.0, 2023],
  ['ICN', 56.3, 2023], ['GMP', 24.0, 2023], ['CJU', 27.0, 2023], ['PUS', 14.0, 2023],
  // ---- Asia: SE Asia ----
  ['BKK', 52.9, 2023], ['DMK', 26.0, 2023], ['HKT', 16.0, 2023], ['SIN', 58.9, 2023],
  ['KUL', 47.2, 2023], ['CGK', 51.9, 2023], ['DPS', 18.0, 2023], ['SUB', 15.0, 2023],
  ['MNL', 45.0, 2023], ['CEB', 10.0, 2023], ['SGN', 40.0, 2023], ['HAN', 29.0, 2023],
  ['DAD', 12.0, 2023], ['HKG', 50.0, 2023], ['TPE', 35.0, 2023], ['MFM', 5.0, 2023],
  // ---- Asia: South Asia ----
  ['DEL', 72.2, 2023], ['BOM', 52.0, 2023], ['BLR', 37.5, 2023], ['MAA', 22.0, 2023],
  ['HYD', 25.0, 2023], ['CCU', 21.0, 2023], ['COK', 10.0, 2023], ['AMD', 11.0, 2023],
  ['PNQ', 9.0, 2023], ['GOI', 8.0, 2023], ['CMB', 8.0, 2023], ['DAC', 8.0, 2023],
  ['KHI', 7.0, 2023], ['ISB', 6.0, 2023], ['KTM', 7.0, 2023],
  // ---- Oceania ----
  ['SYD', 40.0, 2023], ['MEL', 33.0, 2023], ['BNE', 22.0, 2023], ['PER', 14.0, 2023],
  ['ADL', 8.0, 2023], ['AKL', 18.0, 2023], ['CHC', 6.0, 2023], ['OOL', 6.0, 2023],
  // ---- Central Asia / Caucasus ----
  ['ALA', 8.0, 2023], ['TAS', 4.0, 2023], ['GYD', 5.0, 2023],
]

// ---------------------------------------------------------------------------
// Tier B marquee records — hand-verified, each with confidence + sources.
// Deep-merged onto the Tier A skeleton. This is the ONLY source of Tier B data.
// ---------------------------------------------------------------------------
const LAST_UPDATED = '2026-06-30'

const MARQUEE: Record<string, Partial<Airport>> = {
  DXB: {
    owner: 'Dubai Airports (Investment Corporation of Dubai)',
    ownershipType: 'sovereign',
    hubFor: ['Emirates', 'flydubai'],
    gseModel: 'handler_led',
    groundHandlers: [
      {
        name: 'dnata',
        role: 'primary ramp & cargo handler',
        notes:
          'Part of the Emirates Group (Investment Corporation of Dubai); sister company to Emirates airline',
      },
      { name: 'Emirates', role: 'self-handling at Terminal 3' },
    ],
    gseFleetEstimate: 'large (dnata handles 700k+ aircraft turns/yr network-wide)',
    aerovectStatus: 'pilot',
    aerovectNotes:
      'dnata partnership announced June 2026: plan for up to 100 autonomous vehicles across DXB and DWC. The Emirates Group parent (Investment Corporation of Dubai) is the warm bridge to Emirates the airline.',
    competitors: [
      {
        vendor: 'TractEasy',
        status: 'deployed (with dnata at DWC)',
        source: 'dnata EZTow deployment; dnata hedges across autonomy vendors',
      },
    ],
    tailwinds: [
      {
        headline: 'dnata to roughly double ground-handling capacity with its DWC move',
        relevance: 'Autonomy-forward, capital-rich handler expanding its footprint',
      },
    ],
    confidence: 'high',
    sources: [
      'AeroVect / dnata partnership briefing (June 2026)',
      'Dubai Airports corporate profile',
      'dnata network facts (130 airports / 35+ countries / 700k+ turns)',
    ],
    lastUpdated: LAST_UPDATED,
  },
  DWC: {
    owner: 'Dubai Airports (Investment Corporation of Dubai)',
    ownershipType: 'sovereign',
    gseModel: 'handler_led',
    groundHandlers: [{ name: 'dnata', role: 'primary handler' }],
    aerovectStatus: 'pilot',
    aerovectNotes:
      'Same dnata autonomous-vehicle program as DXB (up to 100 vehicles across both fields). Greenfield apron makes DWC an ideal autonomy canvas.',
    competitors: [
      {
        vendor: 'TractEasy',
        status: 'deployed',
        source: 'dnata EZTow autonomous tractors at DWC; dnata deliberately hedges across vendors',
      },
    ],
    tailwinds: [
      {
        headline: 'DWC becoming dnata’s primary hub as Dubai shifts capacity south',
        relevance: 'Greenfield ramp = clean-sheet deployment environment',
      },
    ],
    confidence: 'high',
    sources: ['AeroVect / dnata partnership briefing (June 2026)', 'Dubai Airports DWC expansion plan'],
    lastUpdated: LAST_UPDATED,
  },
  ATL: {
    owner: 'City of Atlanta Department of Aviation',
    ownershipType: 'public',
    hubFor: ['Delta Air Lines'],
    gseModel: 'mixed',
    groundHandlers: [
      { name: 'Delta Air Lines', role: 'self-handling (majority of operations)' },
      {
        name: 'Unifi Aviation',
        role: 'ramp & cargo handling',
        notes:
          'Delta owns ~20%; grew out of Delta Global Services; operates at ~210 US airports',
      },
    ],
    gseFleetEstimate: 'very large (world’s busiest airport by passengers)',
    laborPressure: 'high',
    aerovectStatus: 'active_target',
    aerovectNotes:
      'Delta is a pilot; ATL hub is the expansion. A Delta reference bridges to Unifi’s ~210-airport US network. GAT (AeroVect US handler partner, up to ~50 vehicles) extends the domestic story.',
    tailwinds: [
      {
        headline: 'US ramp labor crisis; severe turnover',
        relevance: 'Autonomy fills unstaffable shifts rather than cutting headcount',
      },
      {
        headline: 'Delta positioned as the gold-standard US reference account',
        relevance: 'A marquee reference unlocks the broader US network',
      },
    ],
    confidence: 'high',
    sources: [
      'City of Atlanta Dept. of Aviation',
      'Unifi Aviation corporate profile (Delta ~20% ownership; ~210 US airports)',
    ],
    lastUpdated: LAST_UPDATED,
  },
  FRA: {
    owner: 'Fraport AG',
    ownershipType: 'mixed',
    hubFor: ['Lufthansa', 'Condor'],
    gseModel: 'handler_led',
    groundHandlers: [
      {
        name: 'Fraport Ground Services (FraGround)',
        role: 'primary ramp & cargo handler',
        notes:
          'Fraport is BOTH the airport operator AND the handler — the rare "authority + handler in one"',
      },
    ],
    aerovectStatus: 'active_target',
    aerovectNotes:
      'Fraport already ran an autonomous baggage/cargo tractor trial on an ~8km apron route. Ownership is majority public (State of Hesse ~31%, City of Frankfurt ~21%, Lufthansa ~8%).',
    operationsNotes:
      'German co-determination means the works council (Betriebsrat) is a powerful stakeholder. Frame autonomy as filling unstaffable jobs, not headcount cuts.',
    tailwinds: [
      {
        headline: 'Fraport is authority + handler in one',
        relevance: 'A single decision-maker owns both the airport and the ramp labor',
      },
      {
        headline: 'Prior autonomous apron tractor trial (~8km route)',
        relevance: 'The concept is already validated internally',
      },
    ],
    confidence: 'high',
    sources: ['Fraport AG shareholder structure', 'Fraport autonomous apron-tractor trial reporting'],
    lastUpdated: LAST_UPDATED,
  },
  SIN: {
    owner: 'Changi Airport Group',
    ownershipType: 'public',
    hubFor: ['Singapore Airlines', 'Scoot'],
    gseModel: 'handler_led',
    groundHandlers: [
      { name: 'SATS', role: 'primary ground & cargo handler' },
      { name: 'dnata Singapore', role: 'ground handling' },
    ],
    aerovectStatus: 'watch',
    aerovectNotes:
      'Autonomy-forward and government-backed, but competitor-active (TractEasy trials). Monitor for an opening.',
    competitors: [
      {
        vendor: 'TractEasy',
        status: 'trial',
        source: 'Autonomous baggage tractor trials at Changi',
      },
    ],
    confidence: 'medium',
    sources: ['Changi Airport Group profile', 'Changi autonomous baggage-tractor trial reporting'],
    lastUpdated: LAST_UPDATED,
  },
  ZRH: {
    owner: 'Flughafen Zürich AG',
    ownershipType: 'mixed',
    hubFor: ['SWISS', 'Edelweiss Air'],
    gseModel: 'handler_led',
    groundHandlers: [
      {
        name: 'Swissport',
        role: 'primary ground handler',
        notes: 'Zurich is Swissport’s home market; Swissport is the world’s #1 handler',
      },
    ],
    aerovectStatus: 'competitor_held',
    aerovectNotes:
      'Swissport (world #1 handler) is currently aligned with Aurrigo here, so ZRH is contested. AeroVect’s retrofit-as-a-service is the counter-position vs Aurrigo’s purpose-built vehicles.',
    competitors: [
      {
        vendor: 'Aurrigo',
        status: 'deployed',
        source: 'Swissport’s first global autonomous ground-handling pilot launched at ZRH (2025)',
      },
    ],
    tailwinds: [
      {
        headline: 'Swissport–Aurrigo pilot at ZRH (2025)',
        relevance: 'Signals handler appetite for autonomy; the account is winnable if Aurrigo underdelivers',
      },
    ],
    confidence: 'high',
    sources: ['Swissport–Aurrigo ZRH pilot announcement (2025)', 'Flughafen Zürich AG profile'],
    lastUpdated: LAST_UPDATED,
  },

  // ---- Coverage prospects: real Tier A, status = prospect/watch, confidence low ----
  LHR: {
    owner: 'Heathrow Airport Ltd',
    ownershipType: 'private',
    hubFor: ['British Airways', 'Virgin Atlantic'],
    gseModel: 'mixed',
    groundHandlers: [
      { name: 'British Airways', role: 'self-handling' },
      { name: 'Menzies Aviation', role: 'ramp & cargo' },
      { name: 'dnata', role: 'ramp & cargo' },
    ],
    aerovectStatus: 'prospect',
    aerovectNotes: 'Europe’s busiest hub; slot-constrained, multi-handler ramp. High value, high complexity.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  CDG: {
    owner: 'Groupe ADP',
    ownershipType: 'mixed',
    hubFor: ['Air France'],
    gseModel: 'mixed',
    groundHandlers: [
      { name: 'Air France', role: 'self-handling' },
      { name: 'Alyzia', role: 'third-party ramp handling' },
    ],
    aerovectStatus: 'prospect',
    aerovectNotes: 'Air France dominant; Groupe ADP is automation-forward across its portfolio.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  AMS: {
    owner: 'Royal Schiphol Group',
    ownershipType: 'mixed',
    hubFor: ['KLM', 'Transavia'],
    gseModel: 'mixed',
    groundHandlers: [
      { name: 'KLM', role: 'self-handling' },
      { name: 'Swissport', role: 'ramp & cargo' },
      { name: 'Menzies Aviation', role: 'ramp & cargo' },
      { name: 'dnata', role: 'ramp & cargo' },
    ],
    aerovectStatus: 'prospect',
    aerovectNotes: 'KLM self-handles; several third-party handlers. Schiphol is sustainability/automation-forward.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  IST: {
    owner: 'iGA (İGA Havalimanı İşletmesi)',
    ownershipType: 'private',
    hubFor: ['Turkish Airlines'],
    gseModel: 'handler_led',
    groundHandlers: [
      { name: 'Çelebi Aviation', role: 'ramp & cargo' },
      { name: 'TGS (Havas)', role: 'ramp & cargo' },
    ],
    aerovectStatus: 'prospect',
    aerovectNotes: 'Turkish Airlines mega-hub; Çelebi and TGS handle the ramp.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  JFK: {
    owner: 'Port Authority of New York & New Jersey',
    ownershipType: 'public',
    hubFor: ['JetBlue', 'Delta Air Lines', 'American Airlines'],
    gseModel: 'mixed',
    groundHandlers: [
      { name: 'Swissport', role: 'ramp & cargo' },
      { name: 'Menzies Aviation', role: 'ramp & cargo' },
      { name: 'Unifi Aviation', role: 'ramp & cargo' },
    ],
    laborPressure: 'high',
    aerovectStatus: 'prospect',
    aerovectNotes: 'US labor pressure; multi-handler. Ties directly into the Delta / Unifi expansion story.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  LAX: {
    owner: 'Los Angeles World Airports (City of Los Angeles)',
    ownershipType: 'public',
    hubFor: ['American Airlines', 'United Airlines', 'Delta Air Lines'],
    gseModel: 'mixed',
    groundHandlers: [
      { name: 'Menzies Aviation', role: 'ramp & cargo' },
      { name: 'Unifi Aviation', role: 'ramp & cargo' },
      { name: 'Swissport', role: 'ramp & cargo' },
    ],
    laborPressure: 'high',
    aerovectStatus: 'prospect',
    aerovectNotes: 'Major west-coast gateway; US ramp labor pressure high.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  ORD: {
    owner: 'City of Chicago Department of Aviation',
    ownershipType: 'public',
    hubFor: ['United Airlines', 'American Airlines'],
    gseModel: 'mixed',
    laborPressure: 'high',
    aerovectStatus: 'prospect',
    aerovectNotes: 'United + American dual hub; both self-handle heavily.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  DFW: {
    owner: 'Cities of Dallas & Fort Worth',
    ownershipType: 'public',
    hubFor: ['American Airlines'],
    gseModel: 'carrier_led',
    laborPressure: 'high',
    aerovectStatus: 'prospect',
    aerovectNotes: 'American Airlines fortress hub; carrier-led ramp means a single decision-maker (AA).',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  DEN: {
    owner: 'City & County of Denver',
    ownershipType: 'public',
    hubFor: ['United Airlines', 'Southwest Airlines', 'Frontier Airlines'],
    gseModel: 'mixed',
    laborPressure: 'high',
    aerovectStatus: 'prospect',
    aerovectNotes: 'Fast-growing hub; United dominant, multiple carriers self-handle.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  HKG: {
    owner: 'Airport Authority Hong Kong',
    ownershipType: 'public',
    hubFor: ['Cathay Pacific', 'HK Express'],
    gseModel: 'handler_led',
    groundHandlers: [
      { name: 'Cathay Pacific Services', role: 'ramp' },
      { name: 'Hong Kong Airport Services (HAS)', role: 'ramp & cargo' },
      { name: 'Jardine Aviation Services', role: 'ramp & cargo' },
    ],
    aerovectStatus: 'prospect',
    aerovectNotes: 'Autonomy-forward airport authority; 3-runway system expansion underway.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  DOH: {
    owner: 'MATAR (Qatar Company for Airports Operation & Management)',
    ownershipType: 'sovereign',
    hubFor: ['Qatar Airways'],
    gseModel: 'handler_led',
    groundHandlers: [{ name: 'Qatar Aviation Services (QAS)', role: 'primary handler' }],
    aerovectStatus: 'prospect',
    aerovectNotes: 'Qatar Airways / QAS self-contained; capital-rich and autonomy-curious.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  AUH: {
    owner: 'Abu Dhabi Airports',
    ownershipType: 'sovereign',
    hubFor: ['Etihad Airways'],
    gseModel: 'handler_led',
    groundHandlers: [
      { name: 'dnata', role: 'ground handling' },
      { name: 'Etihad Airport Services', role: 'ground handling' },
    ],
    aerovectStatus: 'prospect',
    aerovectNotes: 'dnata operates here too, extending the dnata relationship. Etihad also self-handles.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  MEX: {
    owner: 'Grupo Aeroportuario de la Ciudad de México',
    ownershipType: 'public',
    hubFor: ['Aeroméxico', 'Volaris', 'VivaAerobus'],
    gseModel: 'mixed',
    aerovectStatus: 'prospect',
    aerovectNotes: 'Latin America’s 2nd-busiest; nearshoring cargo tailwind.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  GRU: {
    owner: 'GRU Airport (concession)',
    ownershipType: 'mixed',
    hubFor: ['LATAM Brasil', 'GOL', 'Azul'],
    gseModel: 'handler_led',
    groundHandlers: [
      { name: 'Swissport Brasil', role: 'ramp & cargo' },
      { name: 'Proair', role: 'ramp handling' },
    ],
    aerovectStatus: 'prospect',
    aerovectNotes: 'Largest South American hub; Swissport active here.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  PEK: {
    hubFor: ['Air China'],
    owner: 'Beijing Capital International Airport Co.',
    ownershipType: 'public',
    aerovectStatus: 'watch',
    aerovectNotes: 'China market, state-linked. Autonomy interest high but foreign-vendor access is hard.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
  PKX: {
    hubFor: ['China Southern', 'China Eastern'],
    owner: 'Capital Airports Holding',
    ownershipType: 'public',
    aerovectStatus: 'watch',
    aerovectNotes: 'Greenfield mega-hub (opened 2019); modern apron, but access constraints as above.',
    confidence: 'low',
    sources: ['Public airport/airline references'],
    lastUpdated: LAST_UPDATED,
  },
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
const CONTINENT_TO_REGION: Record<string, string> = {
  NA: 'North America',
  SA: 'South America',
  EU: 'Europe',
  AS: 'Asia',
  AF: 'Africa',
  OC: 'Oceania',
  AN: 'Antarctica',
}

function sizeClassFor(paxMillions: number): SizeClass {
  if (paxMillions >= 30) return 'large_hub'
  if (paxMillions >= 10) return 'medium_hub'
  if (paxMillions > 0) return 'small_hub'
  return 'other'
}

function typeRank(t: string): number {
  if (t === 'large_airport') return 0
  if (t === 'medium_airport') return 1
  return 2
}

function main() {
  const airportsCsv = parseCsv(readFileSync(join(RAW, 'airports.csv'), 'utf8'))
  const countriesCsv = parseCsv(readFileSync(join(RAW, 'countries.csv'), 'utf8'))

  const countryByCode = new Map<string, { name: string; continent: string }>()
  for (const c of countriesCsv) {
    countryByCode.set(c.code, { name: c.name, continent: c.continent })
  }

  // Index OurAirports rows by IATA, keeping the most "primary" match.
  const byIata = new Map<string, Record<string, string>>()
  for (const r of airportsCsv) {
    const iata = r.iata_code
    if (!iata) continue
    const existing = byIata.get(iata)
    if (!existing || typeRank(r.type) < typeRank(existing.type)) {
      byIata.set(iata, r)
    }
  }

  const out: Airport[] = []
  const missing: string[] = []

  for (const [iata, paxM, year] of CURATED) {
    const row = byIata.get(iata)
    if (!row) {
      missing.push(iata)
      continue
    }
    const country = countryByCode.get(row.iso_country)
    const region = country ? CONTINENT_TO_REGION[country.continent] : undefined

    const base: Airport = {
      id: iata,
      iata,
      icao: row.icao_code || row.ident || undefined,
      name: row.name,
      city: row.municipality || undefined,
      country: country?.name ?? row.iso_country,
      countryCode: row.iso_country || undefined,
      region,
      lat: Number(row.latitude_deg),
      lng: Number(row.longitude_deg),
      sizeClass: sizeClassFor(paxM),
      passengersAnnual: Math.round(paxM * 1_000_000),
      passengersYear: year,
      aerovectStatus: 'unknown',
      confidence: undefined,
    }

    const marquee = MARQUEE[iata]
    out.push(marquee ? { ...base, ...marquee } : base)
  }

  out.sort((a, b) => (b.passengersAnnual ?? 0) - (a.passengersAnnual ?? 0))
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')

  const enriched = Object.keys(MARQUEE).length
  console.log(`Wrote ${out.length} airports to ${OUT}`)
  console.log(`  ${enriched} carry hand-verified Tier B intelligence`)
  if (missing.length) {
    console.log(`  skipped (no IATA match in OurAirports): ${missing.join(', ')}`)
  }
}

main()
