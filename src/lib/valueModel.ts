/**
 * The RaaS value model (P3): per-account economics, no black box.
 *
 * Every input is visible, editable, and either SOURCED or explicitly flagged
 * as an assumption. The model produces:
 *   - annual labor cost avoided (units x shifts covered x loaded FTE cost)
 *   - annual turnover cost avoided (FTEs avoided x turnover x replacement cost)
 *   - AeroVect RaaS cost (units x fee)  <- this is also the deal's derived ARR
 *   - net annual value to the account and months-to-payback on onboarding
 *
 * Deal `value` and the weighted-pipeline metric derive from THIS model when a
 * deal has unitsTarget; a stored value is only a fallback for unit-less deals.
 */

export interface ValueInput {
  key: keyof ValueAssumptions
  label: string
  unit: string
  /** where the default comes from; assumptions say so explicitly */
  basis: string
  isAssumption: boolean
  min: number
  max: number
  step: number
}

export interface ValueAssumptions {
  /** fully loaded annual cost of one ramp FTE (wage + benefits + admin) */
  loadedFteCost: number
  /** driver-shifts per day one autonomous unit covers */
  shiftsPerDay: number
  /** annual ramp turnover rate (1.0 = 100%) */
  turnoverRate: number
  /** cost to replace one departed FTE, as a share of loaded annual cost */
  replacementCostShare: number
  /** AeroVect RaaS fee per unit-year */
  raasFeePerUnitYear: number
  /** one-time onboarding/integration cost per unit */
  onboardingPerUnit: number
  /** units to model when an account has no deal unitsTarget yet */
  defaultUnits: number
}

export const DEFAULT_ASSUMPTIONS: ValueAssumptions = {
  loadedFteCost: 45_000,
  shiftsPerDay: 2,
  turnoverRate: 0.6,
  replacementCostShare: 0.25,
  raasFeePerUnitYear: 30_000,
  onboardingPerUnit: 10_000,
  defaultUnits: 10,
}

/** The visible definition of every input, rendered next to its editor. */
export const VALUE_INPUTS: ValueInput[] = [
  {
    key: 'loadedFteCost',
    label: 'LOADED FTE COST',
    unit: '$/yr',
    basis: 'US ramp wages run $13-19/hr (agent-sourced job postings) + ~30-35% employer burden. Assumption.',
    isAssumption: true,
    min: 25_000,
    max: 90_000,
    step: 1_000,
  },
  {
    key: 'shiftsPerDay',
    label: 'SHIFTS COVERED / UNIT',
    unit: 'shifts/day',
    basis: 'One retrofitted tractor covers the driver seat across day+night shifts. Assumption.',
    isAssumption: true,
    min: 1,
    max: 3,
    step: 1,
  },
  {
    key: 'turnoverRate',
    label: 'RAMP TURNOVER',
    unit: 'x/yr',
    basis: 'Sourced range: ~35% (Aviation Pros) to ~100% at some US hubs (Air Cargo Week, SFO). Default 60% is the assumption inside that range.',
    isAssumption: true,
    min: 0,
    max: 1.5,
    step: 0.05,
  },
  {
    key: 'replacementCostShare',
    label: 'REPLACEMENT COST',
    unit: 'x loaded cost',
    basis: 'Recruiting + training + ramp badging per departure, as a share of annual cost. HR rule-of-thumb. Assumption.',
    isAssumption: true,
    min: 0,
    max: 0.6,
    step: 0.05,
  },
  {
    key: 'raasFeePerUnitYear',
    label: 'RAAS FEE / UNIT',
    unit: '$/yr',
    basis: 'AeroVect pricing placeholder. Assumption until real pricing is loaded.',
    isAssumption: true,
    min: 10_000,
    max: 100_000,
    step: 5_000,
  },
  {
    key: 'onboardingPerUnit',
    label: 'ONBOARDING / UNIT',
    unit: '$ one-time',
    basis: 'Site survey, mapping, safety case, integration. Assumption.',
    isAssumption: true,
    min: 0,
    max: 60_000,
    step: 2_500,
  },
  {
    key: 'defaultUnits',
    label: 'DEFAULT UNITS',
    unit: 'tractors',
    basis: 'Modeling stand-in for accounts with no deal unitsTarget yet. Assumption.',
    isAssumption: true,
    min: 1,
    max: 100,
    step: 1,
  },
]

export interface ValueLine {
  label: string
  formula: string
  amount: number
}

export interface AccountValue {
  units: number
  unitsAreAssumed: boolean
  lines: ValueLine[]
  laborSavings: number
  turnoverSavings: number
  grossSavings: number
  raasCost: number
  netAnnual: number
  onboarding: number
  paybackMonths: number | null
  /** derived deal ARR to AeroVect = raasCost */
  arr: number
}

export function computeAccountValue(
  unitsTarget: number | undefined,
  a: ValueAssumptions,
): AccountValue {
  const units = unitsTarget ?? a.defaultUnits
  const unitsAreAssumed = unitsTarget == null

  // FTE coverage: each unit covers `shiftsPerDay` driver-shifts, one FTE each.
  const ftesAvoided = units * a.shiftsPerDay
  const laborSavings = ftesAvoided * a.loadedFteCost
  const turnoverSavings = ftesAvoided * a.turnoverRate * a.replacementCostShare * a.loadedFteCost
  const grossSavings = laborSavings + turnoverSavings
  const raasCost = units * a.raasFeePerUnitYear
  const netAnnual = grossSavings - raasCost
  const onboarding = units * a.onboardingPerUnit
  const paybackMonths = netAnnual > 0 ? (onboarding / netAnnual) * 12 : null

  const lines: ValueLine[] = [
    {
      label: 'LABOR AVOIDED',
      formula: `${units} units x ${a.shiftsPerDay} shifts x $${(a.loadedFteCost / 1000).toFixed(0)}K loaded FTE`,
      amount: laborSavings,
    },
    {
      label: 'TURNOVER AVOIDED',
      formula: `${ftesAvoided} FTEs x ${(a.turnoverRate * 100).toFixed(0)}% turnover x ${(a.replacementCostShare * 100).toFixed(0)}% replace cost`,
      amount: turnoverSavings,
    },
    {
      label: 'RAAS FEE',
      formula: `${units} units x $${(a.raasFeePerUnitYear / 1000).toFixed(0)}K/unit/yr`,
      amount: -raasCost,
    },
  ]

  return {
    units,
    unitsAreAssumed,
    lines,
    laborSavings,
    turnoverSavings,
    grossSavings,
    raasCost,
    netAnnual,
    onboarding,
    paybackMonths,
    arr: raasCost,
  }
}

/** Derived deal ARR: model-based when unitsTarget exists, else the stored value. */
export function derivedDealValue(
  unitsTarget: number | undefined,
  storedValue: number | undefined,
  a: ValueAssumptions,
): { value: number | undefined; derived: boolean } {
  if (unitsTarget != null && unitsTarget > 0) {
    return { value: unitsTarget * a.raasFeePerUnitYear, derived: true }
  }
  return { value: storedValue, derived: false }
}
