import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getSessionSchedule } from '../lib/schedule'

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

function ScheduleTab({ gps, featured }) {
  return (
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
  )
}

function TvGuideTab({ gps }) {
  return (
    <div className="tv-guide">
      <p className="tv-disclaimer">
        All times approximate Central Time · Apple TV+ required for Qualifying &amp; Race · Practice sessions stream free (no subscription)
      </p>
      {gps.map((gp) => {
        const sessions = getSessionSchedule(gp.round_number)
        const raceDate = formatDate(gp.race_date ?? gp.date)
        return (
          <div key={gp.id} className="tv-gp-card">
            <div className="tv-gp-header">
              <span className="tv-round-badge">R{String(gp.round_number).padStart(2, '0')}</span>
              <span className="tv-gp-name">{gp.name}</span>
              {raceDate && <span className="tv-gp-date">{raceDate}</span>}
            </div>
            {sessions === null || sessions.length === 0 ? (
              <p className="tv-tba">Broadcast times TBA</p>
            ) : (
              <div className="tv-sessions">
                {sessions.map((s, i) => (
                  <div key={i} className="tv-session-row">
                    <span className="tv-session-name">{s.name}</span>
                    <span className="tv-session-day">{s.day}</span>
                    <span className="tv-session-time">{s.time}</span>
                    <span className={`tv-broadcast-badge ${s.broadcast}`}>
                      {s.broadcast === 'free' ? '★ Free' : 'Apple TV+'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Calendar() {
  const [gps, setGps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('schedule')

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

      <div className="standings-tabs">
        <button
          className={`standings-tab${tab === 'schedule' ? ' active' : ''}`}
          onClick={() => setTab('schedule')}
        >
          Schedule
        </button>
        <button
          className={`standings-tab${tab === 'tvguide' ? ' active' : ''}`}
          onClick={() => setTab('tvguide')}
        >
          TV Guide
        </button>
      </div>

      {tab === 'schedule'
        ? <ScheduleTab gps={gps} featured={featured} />
        : <TvGuideTab gps={gps} />
      }
    </div>
  )
}
