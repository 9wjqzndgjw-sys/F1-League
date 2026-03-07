import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { calcDriverScore, calcConstructorScores } from '../lib/scoring'

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

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Scores Tab ────────────────────────────────────────

function ScoresTab({ picks, managers, drivers, constructors, results, settings, currentManagerId, isScored, payoutFirst, payoutSecond }) {
  const raceScoring    = (settings?.scoring_race        ?? []).map(Number)
  const sprintScoring  = (settings?.scoring_sprint      ?? []).map(Number)
  const conScoring     = (settings?.scoring_constructor ?? []).map(Number)
  const dnfPenalty     = Number(settings?.dnf_penalty   ?? 0)

  const driversById      = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d])), [drivers])
  const constructorsById = useMemo(() => Object.fromEntries(constructors.map(c => [c.id, c])), [constructors])

  const resultMap = useMemo(() => {
    const map = {}
    for (const r of results) {
      if (!map[r.driver_id]) map[r.driver_id] = {}
      map[r.driver_id][r.session_type] = r
    }
    return map
  }, [results])

  const hasResults = isScored

  const driverFantasyPts = useMemo(() => {
    if (!hasResults) return {}
    return Object.fromEntries(
      drivers.map(d => {
        const race   = calcDriverScore(resultMap[d.id]?.race,   'race',   raceScoring, sprintScoring, dnfPenalty)
        const sprint = resultMap[d.id]?.sprint
          ? calcDriverScore(resultMap[d.id].sprint, 'sprint', raceScoring, sprintScoring, dnfPenalty)
          : 0
        return [d.id, race + sprint]
      })
    )
  }, [hasResults, drivers, resultMap, raceScoring, sprintScoring, dnfPenalty])

  const conPtsMap = useMemo(() => {
    if (!hasResults) return {}
    const byConstructor = {}
    for (const d of drivers) {
      if (!byConstructor[d.constructor_id]) byConstructor[d.constructor_id] = []
      byConstructor[d.constructor_id].push(driverFantasyPts[d.id] ?? 0)
    }
    const list = calcConstructorScores(constructors, byConstructor, conScoring)
    return Object.fromEntries(list.map(cs => [cs.constructorId, cs.constructorPoints]))
  }, [hasResults, drivers, constructors, driverFantasyPts, conScoring])

  const managerData = useMemo(() => {
    const byManager = {}
    for (const pick of picks) {
      if (!byManager[pick.manager_id]) byManager[pick.manager_id] = []
      byManager[pick.manager_id].push(pick)
    }

    return managers.map(m => {
      const mPicks = (byManager[m.id] ?? []).sort((a, b) => a.pick_number - b.pick_number)
      let total = 0
      const picksWithPts = mPicks.map(p => {
        let pts = null
        let entity = null
        let color = '#444'
        let type = null

        if (p.driver_id) {
          type = 'driver'
          entity = driversById[p.driver_id]
          color = entity?.constructor?.color ?? '#444'
          pts = hasResults ? (driverFantasyPts[p.driver_id] ?? 0) : null
        } else if (p.constructor_id) {
          type = 'constructor'
          entity = constructorsById[p.constructor_id]
          color = entity?.color ?? '#444'
          pts = hasResults ? (conPtsMap[p.constructor_id] ?? 0) : null
        }

        if (pts !== null) total += pts
        return { ...p, type, entity, color, pts }
      })

      const cardColor = picksWithPts[0]?.color ?? '#444'

      const payout = hasResults
        ? (total === managerData?.[0]?.total ? payoutFirst : total === managerData?.[1]?.total ? payoutSecond : 0)
        : 0

      return {
        manager: m,
        picks: picksWithPts,
        total: hasResults ? total : null,
        cardColor,
        isMe: m.id === currentManagerId,
        payout,
      }
    }).sort((a, b) => {
      if (a.total !== null && b.total !== null) return b.total - a.total
      return (a.manager.display_name ?? '').localeCompare(b.manager.display_name ?? '')
    })
  }, [picks, managers, drivers, constructors, driversById, constructorsById,
      hasResults, driverFantasyPts, conPtsMap, currentManagerId, payoutFirst, payoutSecond])

  if (!picks.length) {
    return <div className="no-session-results">No picks recorded for this round yet</div>
  }

  return (
    <div className="scores-list">
      {managerData.map((md, idx) => {
        const payout = idx === 0 ? payoutFirst : idx === 1 ? payoutSecond : 0
        return (
          <div
            key={md.manager.id}
            className={`manager-score-card${md.isMe ? ' me' : ''}`}
            style={{ '--manager-color': md.isMe ? 'var(--teal)' : md.cardColor }}
          >
            <div className="manager-score-header">
              <span className="manager-score-rank">{idx + 1}</span>
              <span className="manager-score-initials">{initials(md.manager.display_name)}</span>
              <span className="manager-score-name">{md.manager.display_name ?? '—'}</span>
              {hasResults && payout > 0 && (
                <span className="manager-score-payout">${payout}</span>
              )}
              <span className="manager-score-total">
                {md.total !== null ? `${md.total} pts` : 'TBD'}
              </span>
            </div>
            <div className="manager-pick-rows">
              {md.picks.length === 0
                ? <span className="manager-score-empty">No picks recorded</span>
                : md.picks.map((p, i) => {
                    const code = p.type === 'driver'
                      ? (p.entity?.code ?? '—')
                      : (p.entity?.short_name ?? '—')
                    const name = p.entity?.name ?? '—'
                    return (
                      <div key={i} className="manager-pick-row" style={{ '--pick-color': p.color }}>
                        <div className="pick-color-bar" />
                        <span className={`pick-badge ${p.type ?? ''}`}>
                          {p.type === 'driver' ? 'DRV' : 'CON'}
                        </span>
                        <span className="pick-code">{code}</span>
                        <span className="pick-team">{name}</span>
                        <span className="pick-pts">
                          {p.pts !== null ? (p.pts > 0 ? `+${p.pts}` : p.pts) : '—'}
                        </span>
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main View ─────────────────────────────────────────

export default function Results() {
  const { manager: currentManager } = useAuth()

  const [gps, setGps]               = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [results, setResults]       = useState([])
  const [picks, setPicks]           = useState([])
  const [drivers, setDrivers]       = useState([])
  const [constructors, setConstructors] = useState([])
  const [managers, setManagers]     = useState([])
  const [settings, setSettings]     = useState(null)
  const [session, setSession]       = useState('race') // 'race' | 'sprint' | 'scores'
  const [loading, setLoading]       = useState(true)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [error, setError]           = useState(null)

  // Initial load
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('grand_prix').select('*').in('status', ['drafted', 'scored']).order('round_number', { ascending: false }),
      supabase.from('drivers').select('*, constructor:constructors(id,name,short_name,color)'),
      supabase.from('constructors').select('*'),
      supabase.from('managers').select('*'),
      supabase.from('league_settings').select('*').eq('id', 1).single(),
    ]).then(([
      { data: gpsData,  error: gpsErr  },
      { data: drvsData, error: drvsErr },
      { data: consData },
      { data: mgrsData },
      { data: cfg      },
    ]) => {
      if (cancelled) return
      if (gpsErr || drvsErr) {
        setError((gpsErr ?? drvsErr).message)
      } else {
        setGps(gpsData ?? [])
        setDrivers(drvsData ?? [])
        setConstructors(consData ?? [])
        setManagers(mgrsData ?? [])
        setSettings(cfg)
        if (gpsData?.length) setSelectedId(gpsData[0].id)
      }
    })
    .catch((err) => { if (!cancelled) setError(err.message ?? 'Failed to load') })
    .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Load results + picks when selected GP changes
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setResultsLoading(true)
    Promise.all([
      supabase.from('race_results').select('*').eq('gp_id', selectedId),
      supabase.from('draft_picks').select('*').eq('gp_id', selectedId),
    ]).then(([{ data: resData }, { data: picksData }]) => {
      if (cancelled) return
      setResults(resData ?? [])
      setPicks(picksData ?? [])
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

  const selectedGp = gps.find((g) => g.id === selectedId)
  const hasSprint  = results.some((r) => r.session_type === 'sprint')

  const sessionRows = useMemo(
    () => sortResults(results.filter((r) => r.session_type === session)),
    [results, session]
  )

  const raceScoring   = (settings?.scoring_race        ?? []).map(Number)
  const sprintScoring = (settings?.scoring_sprint      ?? []).map(Number)
  const dnfPenalty    = Number(settings?.dnf_penalty   ?? 0)

  if (loading) return <div className="view-loading">Loading results…</div>
  if (error)   return <div className="view-loading">Error: {error}</div>

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

      <div className="results-tabs">
        <button
          className={`results-tab${session === 'race' ? ' active' : ''}`}
          onClick={() => setSession('race')}
        >
          Race
        </button>
        {hasSprint && (
          <button
            className={`results-tab${session === 'sprint' ? ' active' : ''}`}
            onClick={() => setSession('sprint')}
          >
            Sprint
          </button>
        )}
        <button
          className={`results-tab${session === 'scores' ? ' active' : ''}`}
          onClick={() => setSession('scores')}
        >
          Scores
        </button>
      </div>

      {resultsLoading ? (
        <div className="results-loading">Loading…</div>

      ) : session === 'scores' ? (
        <ScoresTab
          picks={picks}
          managers={managers}
          drivers={drivers}
          constructors={constructors}
          results={results}
          settings={settings}
          currentManagerId={currentManager?.id}
          isScored={selectedGp?.status === 'scored'}
          payoutFirst={settings?.payout_first ?? 8}
          payoutSecond={settings?.payout_second ?? 2}
        />

      ) : (
        <>
          {sessionRows.length === 0 && (
            <div className="no-session-results">
              No {session} results entered for this round yet
            </div>
          )}
          {sessionRows.length > 0 && (
            <div className="results-list">
              {sessionRows.map((r) => {
                const driver    = driversById[r.driver_id]
                const pts       = calcDriverScore(r, session, raceScoring, sprintScoring, dnfPenalty)
                const label     = posLabel(r)
                const isOut     = r.is_dnf || r.is_dns || r.is_dsq
                const teamColor = driver?.constructor?.color ?? '#555'

                return (
                  <div
                    key={r.id ?? r.driver_id}
                    className={`result-row${isOut ? ' out' : ''}`}
                    style={{ '--team-color': teamColor }}
                  >
                    <span className={`result-pos${isOut ? ' pos-out' : ''}`}>{label}</span>
                    <div className="result-color-bar" />
                    <div className="result-driver">
                      <span className="result-code">{driver?.code ?? '—'}</span>
                      <span className="result-name">{driver?.name ?? '—'}</span>
                    </div>
                    <span className="result-team">{driver?.constructor?.short_name ?? ''}</span>
                    <span className={`result-pts${pts < 0 ? ' pts-neg' : pts === 0 ? ' pts-zero' : ''}`}>
                      {pts > 0 ? `+${pts}` : pts}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
