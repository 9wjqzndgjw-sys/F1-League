export default function DraftSlot({ slot, pick, manager, entity, isCurrent }) {
  const filled = !!pick

  return (
    <div
      className={[
        'draft-slot',
        isCurrent ? 'current' : '',
        filled ? 'filled' : 'empty',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="slot-num">{slot.pick}</span>
      <div className="slot-body">
        <span className="slot-manager">
          {manager?.display_name ?? manager?.name ?? '—'}
        </span>
        {filled ? (
          <span className="slot-pick">{entity?.name ?? entity?.code ?? '—'}</span>
        ) : (
          <span className="slot-pending">{isCurrent ? 'On the clock…' : 'Pending'}</span>
        )}
      </div>
      <span className={`slot-badge ${slot.type === 'any' ? (pick?.driver_id ? 'driver' : pick?.constructor_id ? 'constructor' : 'any') : slot.type}`}>
        {slot.type === 'any'
          ? pick?.driver_id
            ? 'DRV'
            : pick?.constructor_id
            ? 'CON'
            : 'ANY'
          : slot.type === 'driver'
          ? 'DRV'
          : 'CON'}
      </span>
    </div>
  )
}
