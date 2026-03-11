const DEFAULT_RACE_SCORING = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
const DEFAULT_SPRINT_SCORING = [8, 7, 6, 5, 4, 3, 2, 1]
export const DEFAULT_CONSTRUCTOR_SCORING = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

export function calcDriverScore(
  result,
  sessionType,
  raceScoring = DEFAULT_RACE_SCORING,
  sprintScoring = DEFAULT_SPRINT_SCORING,
  dnfPenalty = 0,
) {
  if (!result) return 0
  if (result.is_dnf) return dnfPenalty
  if (result.is_dns || result.is_dsq) return 0
  const scoring = sessionType === 'sprint' ? sprintScoring : raceScoring
  const idx = result.position - 1
  return idx >= 0 && idx < scoring.length ? scoring[idx] : 0
}

// items: [{ id, total }, ...] sorted by total descending
// Returns [{ id, total, rank, payout, owed, net, isTie }, ...]
export function calcPayouts(items, payoutFirst, payoutSecond) {
  const N = items.length
  const topScore = N > 0 ? items[0].total : 0
  const firstIds = topScore > 0
    ? new Set(items.filter((s) => s.total === topScore).map((s) => s.id))
    : new Set()
  const isTie = firstIds.size > 1
  const multiplier = isTie ? 2 : 1
  const numFirst = firstIds.size || 1
  const secondId = items.find((s) => !firstIds.has(s.id))?.id
  const numNonFirst = N - numFirst
  const numNonPodium = Math.max(0, numNonFirst - (secondId ? 1 : 0))
  const firstEach = numNonFirst > 0 ? payoutFirst * multiplier * numNonFirst / numFirst : 0
  const secondReceived = payoutSecond * multiplier * numNonPodium
  return items.map((item, i) => {
    const isFirst = firstIds.has(item.id)
    const isSecond = item.id === secondId
    const payout = isFirst ? firstEach : isSecond ? secondReceived : 0
    const owed = isFirst ? 0 : isSecond ? payoutFirst * multiplier : (payoutFirst + payoutSecond) * multiplier
    return { ...item, rank: i + 1, payout, owed, net: payout - owed, isTie }
  })
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
