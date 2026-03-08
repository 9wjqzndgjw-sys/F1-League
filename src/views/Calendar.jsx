import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getTvData } from '../lib/tvSchedule'

const STATUS_LABEL = {
  upcoming: 'Upcoming',
  drafting: 'Draft Open',
  drafted:  'Drafted',
  scored:   'Scored',
}

function parseLocalDate(dateStr) {
  // Parse "YYYY-MM-DD" as local time, not UTC, to avoid off-by-one in US timezones
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sessionDate(raceDateStr, dayOffset) {
  if (!raceDateStr) return ''
  const d = parseLocalDate(raceDateStr)
  d.setDate(d.getDate() + dayOffset)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function StatusPill({ status }) {
  return (
    <span className={`gp-status-pill ${status}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function NetworkBadge({ network }) {
  const cls = network === 'Free' ? 'free' : 'appletv'
  return (
    <span className={`tv-broadcast-badge ${cls}`}>
      {network === 'Free' ? 'Apple TV+ Free' : 'Apple TV+'}
    </span>
  )
}

function TvCard({ gp }) {
  const tv = getTvData(gp.name)
  const raceDate = gp.race_date ?? gp.date

  return (
    <div className="tv-gp-card">
      <div className="tv-gp-header">
        <span className="tv-round-badge">R{String(gp.round_number).padStart(2, '0')}</span>
        <span className="tv-gp-name">{gp.name}</span>
        {raceDate && <span className="tv-gp-date">{formatDate(raceDate)}</span>}
      </div>

      {tv ? (
        <div className="tv-sessions">
          {tv.sessions.map((s) => (
            <div key={s.label} className="tv-session-row">
              <span className="tv-session-name">{s.label}</span>
              <span className="tv-session-day">{sessionDate(raceDate, s.dayOffset)}</span>
              <span className="tv-session-time">{s.time} CT</span>
              <NetworkBadge network={s.network} />
            </div>
          ))}
        </div>
      ) : (
        <p className="tv-tba">Broadcast times TBA</p>
      )}
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
  if (error)   return <div className="view-loading">Error: {error}</div>

  const activeGp    = gps.find((g) => g.status === 'drafting')
  const nextGp      = gps.find((g) => g.status === 'upcoming')
  const featured    = activeGp ?? nextGp
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

      {tab === 'schedule' ? (
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
      ) : (
        <div className="tv-guide">
          <p className="tv-disclaimer">
            All times approximate Central Time · Practice streams free on Apple TV+ (no subscription) · Qualifying &amp; Race require Apple TV+
          </p>
          {gps.map((gp) => (
            <TvCard key={gp.id} gp={gp} />
          ))}
        </div>
      )}
    </div>
  )
}
