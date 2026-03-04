import { useState, useCallback } from 'react'
import { useDraft } from '../hooks/useDraft.jsx'
import DriverCard from '../components/DriverCard.jsx'
import DraftSlot from '../components/DraftSlot.jsx'

// ── Internal sub-components ──────────────────────────────

function NoDraft() {
  return (
    <div className="no-draft">
      <span className="no-draft-icon">🏁</span>
      <p>No active draft</p>
      <span>Waiting for commissioner to start a race weekend</span>
    </div>
  )
}

function ConstructorCard({ constructor: con, onPick, interactive, selected }) {
  return (
    <div
      className={`constructor-card${interactive ? ' interactive' : ''}${selected ? ' selected' : ''}`}
      style={{ '--team-color': con.color ?? '#555' }}
      onClick={interactive ? () => onPick?.(con.id) : undefined}
      role={interactive ? 'button' : undefined}
    >
      <div className="con-color-bar" />
      <div className="con-info">
        <span className="con-name">{con.name}</span>
        <span className="con-short">{con.short_name}</span>
      </div>
    </div>
  )
}

function OnTheClock({ slot, managers, picks, draftOrder, isDraftComplete, isMyTurn }) {
  const manager = slot ? managers[slot.managerId] : null
  const managerName = manager?.display_name ?? manager?.name ?? '—'
  const pickNum = picks.length + 1
  const totalPicks = draftOrder.length

  return (
    <div className={`on-the-clock${isMyTurn ? ' my-turn' : ''}`}>
      {isDraftComplete ? (
        <div className="draft-complete-banner">Draft complete ✓</div>
      ) : (
        <>
          <span className="otc-label">On the clock</span>
          <span className="otc-manager">{managerName}</span>
          <span className="otc-meta">
            Pick {pickNum} of {totalPicks} · Round {slot?.round ?? '—'} ·{' '}
            {slot?.type === 'any'
              ? 'Driver or Constructor'
              : slot?.type === 'constructor'
              ? 'Constructor'
              : 'Driver'}
          </span>
        </>
      )}
    </div>
  )
}

function PickList({
  isMyTurn,
  currentSlot,
  managers,
  availableDrivers,
  availableConstructors,
  selected,
  onSelect,
}) {
  const [anyMode, setAnyMode] = useState('driver')

  const switchMode = useCallback((mode) => {
    setAnyMode(mode)
    onSelect(null)
  }, [onSelect])

  const waitingManager = currentSlot
    ? (managers[currentSlot.managerId]?.display_name ??
       managers[currentSlot.managerId]?.name ??
       '—')
    : '—'
  const isAnyPick = currentSlot?.type === 'any'
  const isConstructorPick = currentSlot?.type === 'constructor'
  const showConstructors = isConstructorPick || (isAnyPick && anyMode === 'constructor')
  const items = showConstructors ? availableConstructors : availableDrivers

  return (
    <div className="pick-list">
      {!isMyTurn && (
        <div className="waiting-banner">Waiting for {waitingManager} to pick…</div>
      )}
      {isAnyPick && (
        <div className="any-pick-toggle">
          <button
            className={`any-toggle-btn${anyMode === 'driver' ? ' active' : ''}`}
            onClick={() => switchMode('driver')}
          >
            Drivers
          </button>
          <button
            className={`any-toggle-btn${anyMode === 'constructor' ? ' active' : ''}`}
            onClick={() => switchMode('constructor')}
          >
            Constructors
          </button>
        </div>
      )}
      {isMyTurn && !isAnyPick && (
        <p className="your-turn-hint">
          Tap a {isConstructorPick ? 'constructor' : 'driver'} to select
        </p>
      )}
      {showConstructors
        ? items.map((con) => (
            <ConstructorCard
              key={con.id}
              constructor={con}
              interactive={isMyTurn}
              selected={selected?.id === con.id}
              onPick={(id) => onSelect({ id, type: 'constructor', entity: con })}
            />
          ))
        : items.map((drv) => (
            <DriverCard
              key={drv.id}
              driver={drv}
              interactive={isMyTurn}
              selected={selected?.id === drv.id}
              onPick={(id) => onSelect({ id, type: 'driver', entity: drv })}
            />
          ))}
    </div>
  )
}

function BoardView({ draftOrder, picks, managers, drivers, constructors }) {
  const driversById = Object.fromEntries(drivers.map((d) => [d.id, d]))
  const constructorsById = Object.fromEntries(constructors.map((c) => [c.id, c]))
  const pickByNumber = Object.fromEntries(picks.map((p) => [p.pick_number, p]))
  const currentPickNumber = picks.length + 1
  const draftComplete = picks.length >= draftOrder.length && draftOrder.length > 0

  // Group slots by round
  const rounds = []
  let currentRound = null
  for (const slot of draftOrder) {
    if (slot.round !== currentRound) {
      currentRound = slot.round
      rounds.push({ round: slot.round, type: slot.type, slots: [] })
    }
    rounds[rounds.length - 1].slots.push(slot)
  }

  return (
    <div className="draft-board">
      {rounds.map(({ round, type, slots }) => (
        <div key={round} className="board-round">
          <div className="round-header">
            Round {round} —{' '}
            {type === 'any'
              ? 'Drivers & Constructors'
              : type === 'constructor'
              ? 'Constructors'
              : 'Drivers'}
          </div>
          {slots.map((slot) => {
            const pick = pickByNumber[slot.pick]
            const manager = managers[slot.managerId]
            const entity = pick
              ? pick.driver_id
                ? driversById[pick.driver_id]
                : constructorsById[pick.constructor_id]
              : null
            const isCurrent = !draftComplete && slot.pick === currentPickNumber
            return (
              <DraftSlot
                key={slot.pick}
                slot={slot}
                pick={pick}
                manager={manager}
                entity={entity}
                isCurrent={isCurrent}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Main exported view ───────────────────────────────────

export default function Draft() {
  const {
    loading,
    error,
    gp,
    managers,
    drivers,
    constructors,
    picks,
    draftOrder,
    currentSlot,
    isMyTurn,
    isDraftComplete,
    availableDrivers,
    availableConstructors,
    makePick,
  } = useDraft()

  const [activeTab, setActiveTab] = useState('pick')
  const [selected, setSelected] = useState(null) // { id, type, entity }
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <div className="view-loading">Loading draft…</div>
  if (error) return <div className="view-loading">Error: {error}</div>
  if (gp === null) return <NoDraft />

  const pickTabLabel =
    currentSlot?.type === 'any'
      ? 'Pick'
      : currentSlot?.type === 'constructor'
      ? 'Constructors'
      : 'Drivers'

  async function handleConfirm() {
    if (!selected || submitting) return
    setSubmitting(true)
    const { error: pickError } = await makePick(
      selected.type === 'driver'
        ? { driverId: selected.id }
        : { constructorId: selected.id }
    )
    setSubmitting(false)
    if (!pickError) setSelected(null)
  }

  return (
    <div className="draft-view">
      <div className="draft-gp-header">
        <span className="gp-round">Round {gp.round_number}</span>
        <span className="gp-name">{gp.name}</span>
      </div>

      <OnTheClock
        slot={currentSlot}
        managers={managers}
        picks={picks}
        draftOrder={draftOrder}
        isDraftComplete={isDraftComplete}
        isMyTurn={isMyTurn}
      />

      {!isDraftComplete && (
        <div className="draft-tabs">
          <button
            className={`draft-tab${activeTab === 'pick' ? ' active' : ''}`}
            onClick={() => setActiveTab('pick')}
          >
            {pickTabLabel}
          </button>
          <button
            className={`draft-tab${activeTab === 'board' ? ' active' : ''}`}
            onClick={() => setActiveTab('board')}
          >
            Board
          </button>
        </div>
      )}

      {activeTab === 'pick' && !isDraftComplete && (
        <PickList
          isMyTurn={isMyTurn}
          currentSlot={currentSlot}
          managers={managers}
          availableDrivers={availableDrivers}
          availableConstructors={availableConstructors}
          selected={selected}
          onSelect={setSelected}
        />
      )}

      {(activeTab === 'board' || isDraftComplete) && (
        <BoardView
          draftOrder={draftOrder}
          picks={picks}
          managers={managers}
          drivers={drivers}
          constructors={constructors}
        />
      )}

      {selected && isMyTurn && (
        <div className="pick-confirm-sheet">
          <p className="pick-confirm-name">
            {selected.entity?.name ?? selected.entity?.code ?? '—'}
          </p>
          <p className="pick-confirm-sub">
            {selected.type === 'driver'
              ? (selected.entity?.constructor?.short_name ?? '')
              : (selected.entity?.short_name ?? '')}
          </p>
          <div className="pick-confirm-actions">
            <button
              className="btn-cancel"
              onClick={() => setSelected(null)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="btn-confirm"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? 'Picking…' : 'Confirm Pick'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
