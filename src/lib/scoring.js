import { RACE_SCORING, SPRINT_SCORING, DNF_PENALTY } from './constants'

export function calcDriverScore(result, sessionType) {
  if (!result) return 0
  if (result.is_dnf) return DNF_PENALTY
  if (result.is_dns || result.is_dsq) return 0
  const scoring = sessionType === 'sprint' ? SPRINT_SCORING : RACE_SCORING
  const idx = result.position - 1
  return idx >= 0 && idx < scoring.length ? scoring[idx] : 0
}

// constructors: array of constructor objects with .id
// driverResultsByConstructor: { [constructorId]: [fantasyPoints, ...] }
// constructorScoring: array of point values by rank (e.g. [11,10,9,...])
export function calcConstructorScores(constructors, driverResultsByConstructor, constructorScoring) {
  const totals = constructors.map(c => ({
    constructorId: c.id,
    total: (driverResultsByConstructor[c.id] || []).reduce((sum, pts) => sum + pts, 0),
  }))
  totals.sort((a, b) => b.total - a.total)
  return totals.map((item, idx) => ({
    ...item,
    constructorPoints: constructorScoring[idx] ?? 0,
    rank: idx + 1,
  }))
}
