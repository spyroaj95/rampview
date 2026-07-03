/**
 * The hands-free founder walkthrough (A2 + C3): ~80 seconds through the
 * marquee accounts in narrative order, ending on the whitespace sweep.
 * Each step drives view, layer, selection, and org highlight, with a caption
 * explaining the GTM logic.
 */
import type { LayerKey } from './layers'

/** Live aggregates computed by App and injected into dynamic captions (P5). */
export interface DemoCtx {
  openHandlerLedHubs: number
  unitsInPipe: number
  modeledArr: string //   pre-formatted, e.g. "$5.4M"
  topAccount: { iata: string; why: string }
}

export interface DemoStep {
  id: string
  caption: string | ((ctx: DemoCtx) => string)
  view: 'globe' | 'network' | 'whitespace' | 'coverage'
  layer?: LayerKey
  /** '$TOP' resolves to the highest-scoring open account at runtime */
  airportId?: string
  orgKey?: string
  /** close the detail panel for wide shots */
  panel?: boolean
  dwellMs: number
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: 'open',
    view: 'globe',
    layer: 'status',
    panel: false,
    caption: '216 airports. Color is pipeline status, size is passenger volume. This is the AeroVect system of record.',
    dwellMs: 7000,
  },
  {
    id: 'dxb',
    view: 'globe',
    layer: 'status',
    airportId: 'DXB',
    panel: true,
    caption: 'DXB: live dnata pilot. Up to 100 autonomous vehicles planned across DXB and DWC, retrofitted, not replaced.',
    dwellMs: 9000,
  },
  {
    id: 'dnata-network',
    view: 'network',
    orgKey: 'dnata',
    airportId: 'DXB',
    panel: false,
    caption: 'dnata runs ~130 airports. One pilot travels the whole network, and the Emirates Group parent is the bridge to Emirates itself.',
    dwellMs: 10000,
  },
  {
    id: 'atl',
    view: 'globe',
    layer: 'status',
    airportId: 'ATL',
    panel: true,
    caption: 'ATL: the Delta pilot meets the world’s busiest airport and the worst ramp labor market in the industry.',
    dwellMs: 9000,
  },
  {
    id: 'unifi-network',
    view: 'network',
    orgKey: 'unifi',
    airportId: 'ATL',
    panel: false,
    caption: 'Delta holds a ~49% minority stake in Unifi (Argenbright 51% since Dec 2018, per Forbes). A Delta reference unlocks ~210 US stations. The arcs are the expansion path.',
    dwellMs: 10000,
  },
  {
    id: 'fra',
    view: 'globe',
    layer: 'status',
    airportId: 'FRA',
    panel: true,
    caption: 'FRA: Fraport is airport authority AND ground handler in one buyer, and it already trialed autonomous apron tractors.',
    dwellMs: 9000,
  },
  {
    id: 'zrh',
    view: 'globe',
    layer: 'competitor',
    airportId: 'ZRH',
    panel: true,
    caption: 'We show the losses too. ZRH is contested: Swissport aligned with Aurrigo. Retrofit-as-a-service is the counter.',
    dwellMs: 9000,
  },
  {
    id: 'whitespace',
    view: 'whitespace',
    airportId: undefined,
    panel: false,
    caption:
      'The whitespace sweep: green is ours, red is contested, blue is open. Every claim is sourced; unknown stays visible until researched.',
    dwellMs: 9000,
  },
  {
    id: 'finale',
    view: 'globe',
    layer: 'score',
    airportId: '$TOP',
    panel: true,
    caption: (ctx) =>
      `The so-what: ${ctx.openHandlerLedHubs} open handler-led hubs, ${ctx.unitsInPipe} retrofittable units in pipe, ${ctx.modeledArr} in modeled ARR. First account I would open: ${ctx.topAccount.iata}. ${ctx.topAccount.why}`,
    dwellMs: 12000,
  },
]
