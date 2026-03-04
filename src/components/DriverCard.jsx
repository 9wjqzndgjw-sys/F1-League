export default function DriverCard({ driver, onPick, interactive, selected }) {
  const teamColor = driver.constructor?.color ?? '#555'

  return (
    <div
      className={`driver-card${interactive ? ' interactive' : ''}${selected ? ' selected' : ''}`}
      style={{ '--team-color': teamColor }}
      onClick={interactive ? () => onPick?.(driver.id) : undefined}
      role={interactive ? 'button' : undefined}
    >
      <div className="driver-color-bar" />
      <span className="driver-number">#{driver.number}</span>
      <div className="driver-info">
        <span className="driver-code">{driver.code}</span>
        <span className="driver-name">{driver.full_name}</span>
        <span className="driver-team">{driver.constructor?.short_name ?? ''}</span>
      </div>
    </div>
  )
}
