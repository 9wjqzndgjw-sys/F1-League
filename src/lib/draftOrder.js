export function rotateOrder(baseOrder, gpIdx) {
  if (!baseOrder?.length) return []
  const shift = gpIdx % baseOrder.length
  return [...baseOrder.slice(shift), ...baseOrder.slice(0, shift)]
}

export function getDraftOrder(baseOrder, gpIdx, numRounds) {
  const rotated = rotateOrder(baseOrder, gpIdx)
  const reversed = [...rotated].reverse()
  const rounds = [rotated, reversed, reversed]
  if (numRounds >= 4) rounds.push(rotated)
  return rounds.flatMap((order, roundIdx) =>
    order.map((managerId, pickIdx) => ({
      round: roundIdx + 1,
      pick: roundIdx * 7 + pickIdx + 1,
      managerId,
      type: roundIdx >= 2 ? 'any' : 'driver',
    }))
  )
}
