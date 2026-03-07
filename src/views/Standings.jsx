import { useState, useEffect, useMemo } from 'react'
import { useStandings } from '../hooks/useStandings.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'

const RANK_EMOJI = ['🥇', '🥈', '🥉']

function EmptyScores() {
  return (
    <div className="no-scores">
      <span className="no-scores-icon">🏁</span>
      <p>No rounds scored yet</p>
      <span>Results will appear here after each race weekend</span>
    </div>
  )
}

// ── Manager Detail ────────────────────────────────────

function ManagerDetail({ manager, gpScores, drivers, constructors, user, onBack }) {
  const [draftedPicks, setDraftedPicks] = useState([])
  const [draftedGps, setDraftedGps] = useState([])
  const [gridData, setGridData] = useState({}) // gp_id → { qualifying: {driverId: pos}, sprint_qualifying: {...} }
  const [loading, setLoading] = useState(true)

  const driversById      = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d])), [drivers])
  const constructorsById = useMemo(() => Object.fromEntries(constructors.map(c => [c.id, c])), [constructors])

  // Load picks for non-scored GPs + qualifying grid data for all GPs
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('grand_prix').select('id,name,round_number,status,has_sprint')
        .in('status', ['drafting', 'drafted']).order('round_number'),
      supabase.from('draft_picks').select('*').eq('manager_id', manager.id),
      supabase.from('race_results').select('gp_id,driver_id,session_type,position')
        .in('session_type', ['qualifying', 'sprint_qualifying']),
    ]).then(([{ data: gpsData }, { data: picksData }, { data: qualData }]) => {
      if (cancelled) return
      setDraftedGps(gpsData ?? [])
      setDraftedPicks(picksData ?? [])
      // Index qualifying data: gp_id → session_type → driver_id → position
      const grid = {}
      for (const r of qualData ?? []) {
        if (!grid[r.gp_id]) grid[r.gp_id] = {}
        if (!grid[r.gp_id][r.session_type]) grid[r.gp_id][r.session_type] = {}
        grid[r.gp_id][r.session_type][r.driver_id] = r.position
      }
      setGridData(grid)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [manager.id])

  // Build GP list: scored GPs from gpScores + drafted GPs from fetch
  const gpCards = useMemo(() => {
    const cards = []

    // Scored GPs — picks + pts already computed in gpScores
    for (const { gp, scores } of gpScores) {
      const s = scores[manager.id]
      if (!s) continue
      cards.push({
        gp,
        scored: true,
        total: s.total,
        payout: s.payout,
        picks: s.picks, // [{ type, entity, pts }]
      })
    }

    // Drafted GPs — picks without pts
    const picksById = {}
    for (const p of draftedPicks) {
      if (!picksById[p.gp_id]) picksById[p.gp_id] = []
      picksById[p.gp_id].push(p)
    }
    for (const gp of draftedGps) {
      const raw = picksById[gp.id] ?? []
      const picks = raw.sort((a, b) => a.pick_number - b.pick_number).map(p => ({
        type: p.driver_id ? 'driver' : 'constructor',
        entity: p.driver_id ? driversById[p.driver_id] : constructorsById[p.constructor_id],
        pts: null,
      }))
      cards.push({ gp, scored: false, total: null, payout: 0, picks })
    }

    return cards.sort((a, b) => a.gp.round_number - b.gp.round_number)
  }, [gpScores, draftedGps, draftedPicks, manager.id, driversById, constructorsById])

  const isMe = manager.id === user?.id
  const name = manager.display_name ?? manager.name ?? '—'

  return (
    <div className="manager-detail">
      <div className="manager-detail-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="manager-detail-title">
          <span className="manager-detail-name">{name}</span>
          {isMe && <span className="me-tag">you</span>}
        </div>
      </div>

      {loading ? (
        <div className="view-loading">Loading picks…</div>
      ) : gpCards.length === 0 ? (
        <EmptyScores />
      ) : (
        <div className="manager-gp-list">
          {gpCards.map(({ gp, scored, total, payout, picks }) => (
            <div key={gp.id} className={`manager-gp-card${scored ? ' scored' : ''}`}>
              <div className="manager-gp-header">
                <span className="manager-gp-round">R{String(gp.round_number).padStart(2, '0')}</span>
                <span className="manager-gp-name">{gp.name}</span>
                <span className="manager-gp-total">
                  {scored ? `${total} pts` : 'TBD'}
                </span>
                {payout > 0 && <span className="manager-gp-payout">+${payout}</span>}
              </div>
              <div className="manager-gp-picks">
                {picks.map((p, i) => {
                  const color = p.type === 'driver'
                    ? (p.entity?.constructor?.color ?? p.entity?.color ?? '#444')
                    : (p.entity?.color ?? '#444')
                  const code = p.type === 'driver'
                    ? (p.entity?.code ?? '—')
                    : (p.entity?.short_name ?? '—')
                  const team = p.type === 'driver'
                    ? (p.entity?.constructor?.short_name ?? '')
                    : ''

                  const gridPos = p.type === 'driver' && p.entity?.id
                    ? gridData[gp.id]?.qualifying?.[p.entity.id]
                    : null

                  return (
                    <div key={i} className="manager-gp-pick" style={{ '--pick-color': color }}>
                      <div className="pick-color-bar" />
                      <span className={`pick-badge ${p.type ?? ''}`}>
                        {p.type === 'driver' ? 'DRV' : 'CON'}
                      </span>
                      <span className="pick-code">{code}</span>
                      {team && <span className="pick-team">{team}</span>}
                      {gridPos != null && (
                        <span className="pick-grid" title="Starting grid position">P{gridPos}</span>
                      )}
                      <span className="pick-pts">
                        {p.pts !== null ? (p.pts > 0 ? `+${p.pts}` : p.pts) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Season Tab ────────────────────────────────────────

function SeasonTab({ standings, user, onSelectManager }) {
  if (!standings.length) return <EmptyScores />

  return (
    <div className="standings-list">
      {standings.map(({ manager, rank, total, payouts }) => (
        <div
          key={manager.id}
          className={`standings-row${manager.id === user?.id ? ' me' : ''}`}
          onClick={() => onSelectManager(manager)}
          role="button"
          style={{ cursor: 'pointer' }}
        >
          <span className="rank-badge">
            {rank <= 3 ? RANK_EMOJI[rank - 1] : rank}
          </span>
          <div className="standings-name">
            {manager.display_name ?? manager.name}
            {manager.id === user?.id && <span className="me-tag">you</span>}
          </div>
          <span className="standings-pts">{total} <span className="pts-label">pts</span></span>
          {payouts > 0 && <span className="standings-money">+${payouts}</span>}
          <span className="standings-chevron">›</span>
        </div>
      ))}
    </div>
  )
}

// ── Rounds Tab ────────────────────────────────────────

function RoundsTab({ gpScores, managers, user }) {
  const [expanded, setExpanded] = useState(null)
  const managersById = Object.fromEntries(managers.map((m) => [m.id, m]))

  if (!gpScores.length) return <EmptyScores />

  return (
    <div className="rounds-list">
      {gpScores.map(({ gp, scores, ranked }) => {
        const isOpen = expanded === gp.id
        const winner = managersById[ranked[0]]
        const winnerScore = scores[ranked[0]]

        return (
          <div key={gp.id} className={`gp-result-card${isOpen ? ' expanded' : ''}`}>
            <button
              className="gp-result-header"
              onClick={() => setExpanded(isOpen ? null : gp.id)}
            >
              <div className="gp-result-meta">
                <span className="gp-result-round">Round {gp.round_number}</span>
                <span className="gp-result-name">{gp.name}</span>
              </div>
              <div className="gp-result-winner">
                <span className="winner-name">{winner?.display_name ?? winner?.name ?? '—'}</span>
                <span className="winner-pts">{winnerScore?.total ?? 0} pts</span>
              </div>
              <span className="expand-chevron">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="gp-scores-table">
                {ranked.map((mid, i) => {
                  const m = managersById[mid]
                  const s = scores[mid]
                  return (
                    <div
                      key={mid}
                      className={`gp-score-row${mid === user?.id ? ' me' : ''}`}
                    >
                      <span className="gp-score-rank">{i + 1}</span>
                      <span className="gp-score-name">
                        {m?.display_name ?? m?.name ?? '—'}
                      </span>
                      <span className="gp-score-breakdown">
                        <span className="pts-drv">{s.driverPts}d</span>
                        <span className="pts-sep">+</span>
                        <span className="pts-con">{s.constructorPts}c</span>
                      </span>
                      <span className="gp-score-pts">{s.total}</span>
                      {s.payout > 0 && (
                        <span className="gp-score-payout">+${s.payout}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main View ─────────────────────────────────────────

export default function Standings() {
  const { loading, error, standings, gpScores, managers, drivers, constructors, totalGps } = useStandings()
  const { user } = useAuth()
  const [tab, setTab] = useState('season')
  const [selectedManager, setSelectedManager] = useState(null)

  if (loading) return <div className="view-loading">Loading standings…</div>
  if (error) return <div className="view-loading">Error: {error}</div>

  if (selectedManager) {
    return (
      <ManagerDetail
        manager={selectedManager}
        gpScores={gpScores}
        drivers={drivers}
        constructors={constructors}
        user={user}
        onBack={() => setSelectedManager(null)}
      />
    )
  }

  return (
    <div className="standings-view">
      <div className="standings-header">
        <span className="standings-season">Season 2026</span>
        <span className="standings-scored">
          {gpScores.length} of {totalGps} rounds scored
        </span>
      </div>

      <div className="standings-tabs">
        <button
          className={`standings-tab${tab === 'season' ? ' active' : ''}`}
          onClick={() => setTab('season')}
        >
          Season
        </button>
        <button
          className={`standings-tab${tab === 'rounds' ? ' active' : ''}`}
          onClick={() => setTab('rounds')}
        >
          Rounds
        </button>
      </div>

      {tab === 'season' && (
        <SeasonTab standings={standings} user={user} onSelectManager={setSelectedManager} />
      )}
      {tab === 'rounds' && (
        <RoundsTab gpScores={gpScores} managers={managers} user={user} />
      )}
    </div>
  )
}
