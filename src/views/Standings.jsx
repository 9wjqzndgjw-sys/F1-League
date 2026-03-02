import { useState } from 'react'
import { useStandings } from '../hooks/useStandings.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

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

function SeasonTab({ standings, user }) {
  if (!standings.length) return <EmptyScores />

  return (
    <div className="standings-list">
      {standings.map(({ manager, rank, total, payouts }) => (
        <div
          key={manager.id}
          className={`standings-row${manager.id === user?.id ? ' me' : ''}`}
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
        </div>
      ))}
    </div>
  )
}

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

export default function Standings() {
  const { loading, error, standings, gpScores, managers, totalGps } = useStandings()
  const { user } = useAuth()
  const [tab, setTab] = useState('season')

  if (loading) return <div className="view-loading">Loading standings…</div>
  if (error) return <div className="view-loading">Error: {error}</div>

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

      {tab === 'season' && <SeasonTab standings={standings} user={user} />}
      {tab === 'rounds' && <RoundsTab gpScores={gpScores} managers={managers} user={user} />}
    </div>
  )
}
