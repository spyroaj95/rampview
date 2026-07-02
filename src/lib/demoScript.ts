/**
 * The hands-free founder walkthrough (A2 + C3): ~80 seconds through the
 * marquee accounts in narrative order, ending on the whitespace sweep.
 * Each step drives view, layer, selection, and org highlight, with a caption
 * explaining the GTM logic.
 */
import type { LayerKey } from './layers'

export interface DemoStep {
  id: string
  caption: string
  view: 'globe' | 'network' | 'whitespace' | 'coverage'
  layer?: LayerKey
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
    caption: 'Delta owns ~20% of Unifi. A Delta reference unlocks ~210 US stations. The arcs are the expansion path.',
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
    caption: 'The whitespace sweep: green is ours, red is contested, blue is open. Most of the map is still open.',
    dwellMs: 9000,
  },
  {
    id: 'close',
    view: 'coverage',
    panel: false,
    caption: 'Every field is sourced and confidence-rated. Unknown stays visible until researched, so the map never lies.',
    dwellMs: 8000,
  },
]
