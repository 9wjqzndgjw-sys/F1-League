import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getTvData, NETWORK_COLOR } from '../lib/tvSchedule'

const STATUS_LABEL = {
  upcoming: 'Upcoming',
  drafting: 'Draft Open',
  drafted:  'Drafted',
  scored:   'Scored',
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sessionDate(raceDateStr, dayOffset) {
  if (!raceDateStr) return ''
  const d = new Date(raceDateStr)
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
  const color = NETWORK_COLOR[network] ?? '#444'
  return (
    <span
      className={`tv-network-badge${network === 'Free' ? ' free' : ''}`}
      style={{ background: color }}
    >
      {network === 'Free' ? '★ Free' : network}
    </span>
  )
}

function TvCard({ gp }) {
  const tv = getTvData(gp.name)
  const raceDate = gp.race_date ?? gp.date

  return (
    <div className="tv-gp-card">
      <div className="tv-gp-header">
        <span className="tv-gp-round">R{String(gp.round_number).padStart(2, '0')}</span>
        <span className="tv-gp-name">{gp.name}</span>
        {raceDate && <span className="tv-gp-date">{formatDate(raceDate)}</span>}
      </div>

      {tv ? (
        <div className="tv-sessions">
          {tv.sessions.map((s) => (
            <div key={s.label} className="tv-session-row">
              <span className="tv-session-label">{s.label}</span>
              <span className="tv-session-date">{sessionDate(raceDate, s.dayOffset)}</span>
              <span className="tv-session-time">{s.time} CT</span>
              <NetworkBadge network={s.network} />
            </div>
          ))}
        </div>
      ) : (
        <p className="tv-no-data">Broadcast times TBA</p>
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

  const activeGp   = gps.find((g) => g.status === 'drafting')
  const nextGp     = gps.find((g) => g.status === 'upcoming')
  const featured   = activeGp ?? nextGp
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

      {/* Tab switcher */}
      <div className="cal-tabs">
        <button
          className={`cal-tab${tab === 'schedule' ? ' active' : ''}`}
          onClick={() => setTab('schedule')}
        >
          Schedule
        </button>
        <button
          className={`cal-tab${tab === 'tv' ? ' active' : ''}`}
          onClick={() => setTab('tv')}
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
                <span className="gp-card-name">{gp.name}</span>
                {(gp.race_date ?? gp.date) && (
                  <span className="gp-card-date">{formatDate(gp.race_date ?? gp.date)}</span>
                )}
              </div>
              <StatusPill status={gp.status} />
            </div>
          ))}
        </div>
      ) : (
        <div className="tv-guide-list">
          <p className="tv-guide-note">
            All times approximate Central Time · Apple TV+ required for Qualifying &amp; Race
            · Practice sessions stream free (no subscription)
          </p>
          {gps.map((gp) => (
            <TvCard key={gp.id} gp={gp} />
          ))}
        </div>
      )}
    </div>
  )
}
