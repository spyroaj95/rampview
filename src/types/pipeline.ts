/**
 * RampView pipeline (CRM) data model.
 *
 * Working deal data lives in src/data/pipeline.json (gitignored, local only);
 * the repo ships src/data/pipeline.sample.json with clearly-dummy contacts so
 * public builds never contain real deal intel. See pipelineService.ts.
 */

export type DealStage =
  | 'identified'
  | 'researching'
  | 'engaged'
  | 'pilot_scoping'
  | 'pilot_live'
  | 'expansion'
  | 'won'
  | 'lost'
  | 'competitor_won'

export type PersonaRole =
  | 'vp_ground_ops'
  | 'head_gse_fleet'
  | 'head_safety_sms'
  | 'head_innovation'
  | 'procurement'
  | 'finance_cfo'
  | 'station_ramp_manager'
  | 'airport_authority'
  | 'labor_union'
  | 'exec_sponsor'
  | 'other'

export interface Contact {
  id: string
  name: string
  role: PersonaRole
  title?: string
  org?: string
  email?: string
  notes?: string
  disposition?: 'champion' | 'neutral' | 'blocker' | 'unknown'
}

export interface Activity {
  id: string
  date: string //  ISO
  type: 'call' | 'email' | 'meeting' | 'note' | 'milestone'
  summary: string
}

export interface Deal {
  airportId: string //       joins Airport.id
  stage: DealStage
  owner?: string
  handlerOrCarrier?: string // the buying org on the ramp
  unitsTarget?: number
  unitsLive?: number
  nextStep?: string
  nextStepDue?: string //     ISO
  lastTouch?: string //       ISO
  value?: number //           annual contract value, USD
  contacts: Contact[]
  activity: Activity[]
}

export interface PipelineFile {
  /** true on the committed sample file so the UI can show a SAMPLE DATA badge */
  sample?: boolean
  deals: Deal[]
}

/** A warm-bridge expansion arc between two airports, via an org relationship. */
export interface Bridge {
  id: string
  from: string //  airport id
  to: string //    airport id
  via: string //   org that carries the relationship (e.g., "dnata", "Unifi Aviation")
  label: string
  rationale: string
}

// ---------------------------------------------------------------------------
// Display + math metadata (single source of truth for stage colors/weights)
// ---------------------------------------------------------------------------

export interface StageMeta {
  key: DealStage
  label: string
  color: string
  /** probability weight for the weighted-pipeline-value metric */
  weight: number
}

export const STAGE_ORDER: DealStage[] = [
  'identified',
  'researching',
  'engaged',
  'pilot_scoping',
  'pilot_live',
  'expansion',
  'won',
  'lost',
  'competitor_won',
]

export const STAGE_META: Record<DealStage, StageMeta> = {
  identified: { key: 'identified', label: 'Identified', color: '#5b6675', weight: 0.05 },
  researching: { key: 'researching', label: 'Researching', color: '#7d8a9c', weight: 0.1 },
  engaged: { key: 'engaged', label: 'Engaged', color: '#4f8cff', weight: 0.25 },
  pilot_scoping: { key: 'pilot_scoping', label: 'Pilot scoping', color: '#38b6d8', weight: 0.4 },
  pilot_live: { key: 'pilot_live', label: 'Pilot live', color: '#22d3ee', weight: 0.6 },
  expansion: { key: 'expansion', label: 'Expansion', color: '#5fe3b8', weight: 0.75 },
  won: { key: 'won', label: 'Won', color: '#2ee6a6', weight: 1 },
  lost: { key: 'lost', label: 'Lost', color: '#404a58', weight: 0 },
  competitor_won: { key: 'competitor_won', label: 'Competitor won', color: '#ff5468', weight: 0 },
}

export interface PersonaMeta {
  role: PersonaRole
  label: string
  /** committee function shown as a small tag next to the persona */
  tag: 'BUYER' | 'OWNER' | 'GATE' | 'ENTRY' | 'COMMERCIAL' | 'FINANCE' | 'LOCAL' | 'AUTHORITY' | 'STAKEHOLDER' | 'SPONSOR' | 'OTHER'
  hint: string
}

/** The real aviation buying committee, surfaced in the UI. */
export const PERSONA_META: Record<PersonaRole, PersonaMeta> = {
  vp_ground_ops: {
    role: 'vp_ground_ops',
    label: 'VP Ground Ops',
    tag: 'BUYER',
    hint: 'Economic buyer and usual champion',
  },
  head_gse_fleet: {
    role: 'head_gse_fleet',
    label: 'Head of GSE Fleet',
    tag: 'OWNER',
    hint: 'Functional owner the retrofit story targets',
  },
  head_safety_sms: {
    role: 'head_safety_sms',
    label: 'Head of Safety / SMS',
    tag: 'GATE',
    hint: 'Veto via the safety case; must be won early',
  },
  head_innovation: {
    role: 'head_innovation',
    label: 'Head of Innovation',
    tag: 'ENTRY',
    hint: 'Usual entry point and early champion',
  },
  procurement: {
    role: 'procurement',
    label: 'Procurement',
    tag: 'COMMERCIAL',
    hint: 'Commercial gate; frame RaaS terms early',
  },
  finance_cfo: {
    role: 'finance_cfo',
    label: 'Finance / CFO',
    tag: 'FINANCE',
    hint: 'Capex vs opex; RaaS is the lever',
  },
  station_ramp_manager: {
    role: 'station_ramp_manager',
    label: 'Station / Ramp Manager',
    tag: 'LOCAL',
    hint: 'Local make-or-break at go-live',
  },
  airport_authority: {
    role: 'airport_authority',
    label: 'Airport Authority',
    tag: 'AUTHORITY',
    hint: 'External airside-approval gate or mandator',
  },
  labor_union: {
    role: 'labor_union',
    label: 'Labor / Works Council',
    tag: 'STAKEHOLDER',
    hint: 'Neutralize: frame autonomy as filling unstaffable shifts',
  },
  exec_sponsor: {
    role: 'exec_sponsor',
    label: 'Exec Sponsor',
    tag: 'SPONSOR',
    hint: 'CEO/CCO on network-level deals',
  },
  other: { role: 'other', label: 'Other', tag: 'OTHER', hint: 'Uncategorized contact' },
}

export const DISPOSITION_COLOR: Record<NonNullable<Contact['disposition']>, string> = {
  champion: '#2ee6a6',
  neutral: '#c3ccd8',
  blocker: '#ff5468',
  unknown: '#5b6675',
}
