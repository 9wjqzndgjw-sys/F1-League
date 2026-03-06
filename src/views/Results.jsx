import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { calcDriverScore } from '../lib/scoring'

function posLabel(r) {
  if (r.is_dsq) return 'DSQ'
  if (r.is_dns) return 'DNS'
  if (r.is_dnf) return 'DNF'
  return `P${r.position}`
}

function sortResults(rows) {
  return [...rows].sort((a, b) => {
    const rank = (r) => (r.is_dns || r.is_dsq ? 999 : r.is_dnf ? 998 : r.position)
    return rank(a) - rank(b)
  })
}

export default function Results() {
  const [gps, setGps] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [results, setResults] = useState([])
  const [drivers, setDrivers] = useState([])
  const [session, setSession] = useState('race')
  const [loading, setLoading] = useState(true)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Initial load: GPs + drivers
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase
        .from('grand_prix')
        .select('*')
        .in('status', ['drafted', 'scored'])
        .order('round_number', { ascending: false }),
      supabase
        .from('drivers')
        .select('*, constructor:constructors(id,name,short_name,color)'),
    ])
      .then(([{ data: gpsData, error: gpsErr }, { data: drvsData, error: drvsErr }]) => {
        if (cancelled) return
        if (gpsErr || drvsErr) {
          setError((gpsErr ?? drvsErr).message)
        } else {
          setGps(gpsData ?? [])
          setDrivers(drvsData ?? [])
          if (gpsData?.length) setSelectedId(gpsData[0].id)
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message ?? 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Load results whenever selected GP changes
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setResultsLoading(true)
    supabase
      .from('race_results')
      .select('*')
      .eq('gp_id', selectedId)
      .then(({ data }) => {
        if (cancelled) return
        setResults(data ?? [])
        setSession('race')
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setResultsLoading(false) })
    return () => { cancelled = true }
  }, [selectedId])

  const driversById = useMemo(
    () => Object.fromEntries(drivers.map((d) => [d.id, d])),
    [drivers]
  )

  const hasSprint = results.some((r) => r.session_type === 'sprint')

  const sessionRows = useMemo(
    () => sortResults(results.filter((r) => r.session_type === session)),
    [results, session]
  )

  const selectedGp = gps.find((g) => g.id === selectedId)

  if (loading) return <div className="view-loading">Loading results…</div>
  if (error) return <div className="view-loading">Error: {error}</div>

  if (!gps.length) {
    return (
      <div className="no-scores">
        <span className="no-scores-icon">🏁</span>
        <p>No results yet</p>
        <span>Results appear here after each race weekend</span>
      </div>
    )
  }

  return (
    <div className="results-view">

      {/* GP selector — horizontal scroll */}
      <div className="gp-selector">
        {gps.map((gp) => (
          <button
            key={gp.id}
            className={`gp-chip${gp.id === selectedId ? ' active' : ''}`}
            onClick={() => setSelectedId(gp.id)}
          >
            R{String(gp.round_number).padStart(2, '0')}
          </button>
        ))}
      </div>

      <div className="results-gp-title">
        <span className="results-gp-round">Round {selectedGp?.round_number}</span>
        <span className="results-gp-name">{selectedGp?.name}</span>
      </div>

      {/* Session tabs — only shown if sprint results exist */}
      {hasSprint && (
        <div className="results-tabs">
          <button
            className={`results-tab${session === 'race' ? ' active' : ''}`}
            onClick={() => setSession('race')}
          >
            Race
          </button>
          <button
            className={`results-tab${session === 'sprint' ? ' active' : ''}`}
            onClick={() => setSession('sprint')}
          >
            Sprint
          </button>
        </div>
      )}

      {resultsLoading && <div className="results-loading">Loading…</div>}

      {!resultsLoading && sessionRows.length === 0 && (
        <div className="no-session-results">
          No {session} results entered for this round yet
        </div>
      )}

      {!resultsLoading && sessionRows.length > 0 && (
        <div className="results-list">
          {sessionRows.map((r) => {
            const driver = driversById[r.driver_id]
            const pts = calcDriverScore(r, session)
            const label = posLabel(r)
            const isOut = r.is_dnf || r.is_dns || r.is_dsq
            const teamColor = driver?.constructor?.color ?? '#555'

            return (
              <div
                key={r.id ?? r.driver_id}
                className={`result-row${isOut ? ' out' : ''}`}
                style={{ '--team-color': teamColor }}
              >
                <span className={`result-pos${isOut ? ' pos-out' : ''}`}>
                  {label}
                </span>
                <div className="result-color-bar" />
                <div className="result-driver">
                  <span className="result-code">{driver?.code ?? '—'}</span>
                  <span className="result-name">{driver?.name ?? '—'}</span>
                </div>
                <span className="result-team">
                  {driver?.constructor?.short_name ?? ''}
                </span>
                <span
                  className={`result-pts${pts < 0 ? ' pts-neg' : pts === 0 ? ' pts-zero' : ''}`}
                >
                  {pts > 0 ? `+${pts}` : pts}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
