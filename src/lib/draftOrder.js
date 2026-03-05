export function rotateOrder(baseOrder, gpIdx) {
  if (!baseOrder?.length) return []
  const shift = gpIdx % baseOrder.length
  return [...baseOrder.slice(shift), ...baseOrder.slice(0, shift)]
}

export function getDraftOrder(baseOrder, gpIdx, numRounds) {
  const rotated = rotateOrder(baseOrder, gpIdx)
  const reversed = [...rotated].reverse()
  const rounds = []
  for (let i = 0; i < numRounds; i++) {
    rounds.push(i % 2 === 0 ? rotated : reversed)
  }
  return rounds.flatMap((order, roundIdx) =>
    order.map((managerId, pickIdx) => ({
      round: roundIdx + 1,
      pick: roundIdx * order.length + pickIdx + 1,
      managerId,
      type: roundIdx < 3 ? 'driver' : 'constructor',
    }))
  )
}
