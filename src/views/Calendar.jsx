import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_LABEL = {
  upcoming: 'Upcoming',
  drafting: 'Draft Open',
  drafted: 'Drafted',
  scored: 'Scored',
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatusPill({ status }) {
  return (
    <span className={`gp-status-pill ${status}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function Calendar() {
  const [gps, setGps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('grand_prix')
      .select('*')
      .order('round_number')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setGps(data ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="view-loading">Loading calendar…</div>
  if (error) return <div className="view-loading">Error: {error}</div>

  const activeGp = gps.find((g) => g.status === 'drafting')
  const nextGp = gps.find((g) => g.status === 'upcoming')
  const featured = activeGp ?? nextGp
  const scoredCount = gps.filter((g) => g.status === 'scored').length

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <span className="calendar-season">2026 Season</span>
        {featured && (
          <span className="calendar-next">
            {activeGp ? 'Live — ' : 'Next — '}
            Rd {featured.round_number}
          </span>
        )}
      </div>

      <div className="cal-progress">
        <div
          className="cal-progress-bar"
          style={{ width: `${(scoredCount / gps.length) * 100}%` }}
        />
      </div>
      <span className="cal-progress-label">
        {scoredCount} of {gps.length} rounds complete
      </span>

      <div className="calendar-list">
        {gps.map((gp) => (
          <div
            key={gp.id}
            className={`gp-card ${gp.status}${gp.id === featured?.id ? ' featured' : ''}`}
          >
            <span className="gp-round-badge">R{String(gp.round_number).padStart(2, '0')}</span>
            <div className="gp-info">
              <div className="gp-card-name-row">
                <span className="gp-card-name">{gp.name}</span>
                {gp.has_sprint && <span className="gp-sprint-badge">Sprint</span>}
              </div>
              {(gp.race_date ?? gp.date) && (
                <span className="gp-card-date">{formatDate(gp.race_date ?? gp.date)}</span>
              )}
            </div>
            <StatusPill status={gp.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
