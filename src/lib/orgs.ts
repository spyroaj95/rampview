/**
 * Org registry for the NETWORK view: the handlers and self-handling carriers
 * that matter to AeroVect, with the global-footprint facts from KNOWLEDGE.md.
 * Airports are matched to orgs by pattern over groundHandlers/hubFor names, so
 * "dnata Singapore" and "Swissport Brasil" roll up to their parents.
 */
import type { Airport } from '../types/airport'

export interface OrgMeta {
  key: string
  name: string
  kind: 'handler' | 'carrier'
  /** global footprint, from KNOWLEDGE.md (not derived from our dataset) */
  global: string
  /** autonomy alignment, if known */
  aligned?: string
  /** org-level warm bridge that has no arc geometry */
  orgBridge?: string
  pattern: RegExp
  /** also match airports where this org is a hub carrier */
  matchHub?: boolean
}

export const ORG_REGISTRY: OrgMeta[] = [
  {
    key: 'dnata',
    name: 'dnata',
    kind: 'handler',
    global: '~130 airports, 35+ countries, 700k+ turns/yr',
    aligned: 'AeroVect pilot (DXB+DWC); also runs TractEasy (hedged)',
    orgBridge: 'Emirates Group parent (Investment Corporation of Dubai) is the warm bridge to Emirates the airline',
    pattern: /dnata/i,
  },
  {
    key: 'swissport',
    name: 'Swissport',
    kind: 'handler',
    global: '#1 handler worldwide',
    aligned: 'Aurrigo (first pilot at ZRH, 2025): contested',
    pattern: /swissport/i,
  },
  {
    key: 'menzies',
    name: 'Menzies Aviation',
    kind: 'handler',
    global: '~350 airports, 65 countries',
    orgBridge: 'Prove dnata, sell Menzies: a handler reference is the door',
    pattern: /menzies/i,
  },
  {
    key: 'unifi',
    name: 'Unifi Aviation',
    kind: 'handler',
    global: '~210 US airports; Delta owns ~20%',
    orgBridge: 'Delta pilot reference travels to every Unifi station',
    pattern: /unifi/i,
  },
  {
    key: 'sats',
    name: 'SATS',
    kind: 'handler',
    global: 'Asia-Pacific leader; Changi home base',
    pattern: /\bSATS\b|AISATS/,
  },
  {
    key: 'fraground',
    name: 'Fraport Ground Services',
    kind: 'handler',
    global: 'Operator + handler in one at FRA',
    pattern: /fraport|fraground/i,
  },
  {
    key: 'gat',
    name: 'GAT',
    kind: 'handler',
    global: 'US regional handler',
    aligned: 'AeroVect partner (up to ~50 US vehicles)',
    pattern: /\bGAT\b/,
  },
  {
    key: 'emirates',
    name: 'Emirates',
    kind: 'carrier',
    global: 'Self-handles at DXB T3; Emirates Group sibling of dnata',
    pattern: /emirates/i,
    matchHub: true,
  },
  {
    key: 'delta',
    name: 'Delta Air Lines',
    kind: 'carrier',
    global: 'Self-handles; pilot account; owns ~20% of Unifi',
    aligned: 'AeroVect pilot',
    pattern: /delta/i,
    matchHub: true,
  },
  {
    key: 'southwest',
    name: 'Southwest Airlines',
    kind: 'carrier',
    global: 'Self-handles; dominant at LAS, MDW, DAL',
    pattern: /southwest/i,
    matchHub: true,
  },
  {
    key: 'jal-ana',
    name: 'JAL / ANA (Japan)',
    kind: 'carrier',
    global: 'Self-handle ~62% at HND; deploying purpose-built Level 4 tractors',
    aligned: 'Competitor-aligned (Toyota Industries, ROBO-HI)',
    pattern: /\bJAL\b|\bANA\b|Japan Airlines|All Nippon/,
    matchHub: true,
  },
]

export function orgByKey(key: string): OrgMeta | undefined {
  return ORG_REGISTRY.find((o) => o.key === key)
}

export function airportMatchesOrg(a: Airport, org: OrgMeta): boolean {
  const inHandlers = (a.groundHandlers ?? []).some((h) => org.pattern.test(h.name))
  if (inHandlers) return true
  if (org.matchHub) return (a.hubFor ?? []).some((h) => org.pattern.test(h))
  return false
}

export function airportsForOrg(list: Airport[], org: OrgMeta): Airport[] {
  return list.filter((a) => airportMatchesOrg(a, org))
}
