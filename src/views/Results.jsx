import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
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

// ── Race Results Tab ──────────────────────────────────

function RaceTab({ sessionRows, resultsLoading, session, hasSprint, setSession, driversById, calcPts }) {
  return (
    <>
      {hasSprint && (
        <div className="standings-tabs">
          <button
            className={`standings-tab${session === 'race' ? ' active' : ''}`}
            onClick={() => setSession('race')}
          >
            Race
          </button>
          <button
            className={`standings-tab${session === 'sprint' ? ' active' : ''}`}
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
            const pts = calcPts(r, session)
            const label = posLabel(r)
            const isOut = r.is_dnf || r.is_dns || r.is_dsq
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
                <span className="result-team">
                  {driver?.constructor?.short_name ?? ''}
                </span>
                <span className={`result-pts${pts < 0 ? ' pts-neg' : pts === 0 ? ' pts-zero' : ''}`}>
                  {pts > 0 ? `+${pts}` : pts}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Scores Tab ────────────────────────────────────────

function ScoresTab({ picks, managers, drivers, constructors, results, settings, userId }) {
  const raceScoring    = (settings?.scoring_race ?? []).map(Number)
  const sprintScoring  = (settings?.scoring_sprint ?? []).map(Number)
  const conScoring     = (settings?.scoring_constructor ?? []).map(Number)
  const dnfPenalty     = Number(settings?.dnf_penalty ?? 0)

  const driversById      = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d])), [drivers])
  const constructorsById = useMemo(() => Object.fromEntries(constructors.map(c => [c.id, c])), [constructors])
  const managersById     = useMemo(() => Object.fromEntries(managers.map(m => [m.id, m])), [managers])

  // Index results by driver_id → session_type
  const resultMap = useMemo(() => {
    const map = {}
    for (const r of results) {
      if (!map[r.driver_id]) map[r.driver_id] = {}
      map[r.driver_id][r.session_type] = r
    }
    return map
  }, [results])

  const hasResults = results.length > 0

  // Driver fantasy pts (for constructor scoring)
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

  // Group picks by manager, calculate totals
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

      // Manager card color = first pick's team color
      const cardColor = picksWithPts[0]?.color ?? '#444'

      return {
        manager: m,
        picks: picksWithPts,
        total: hasResults ? total : null,
        cardColor,
        isMe: m.id === userId,
      }
    }).sort((a, b) => {
      if (a.total !== null && b.total !== null) return b.total - a.total
      return (a.manager.display_name ?? '').localeCompare(b.manager.display_name ?? '')
    })
  }, [picks, managers, drivers, constructors, driversById, constructorsById, hasResults, driverFantasyPts, conPtsMap, userId])

  if (!picks.length) {
    return (
      <div className="no-session-results">No picks recorded for this round yet</div>
    )
  }

  return (
    <div className="scores-list">
      {managerData.map((md, idx) => (
        <div
          key={md.manager.id}
          className={`manager-score-card${md.isMe ? ' me' : ''}`}
          style={{ '--manager-color': md.isMe ? 'var(--teal)' : md.cardColor }}
        >
          <div className="manager-score-header">
            <span className="manager-score-rank">{idx + 1}</span>
            <span className="manager-score-initials">{initials(md.manager.display_name)}</span>
            <span className="manager-score-name">{md.manager.display_name ?? '—'}</span>
            <span className="manager-score-total">
              {md.total !== null ? `${md.total} pts` : 'TBD'}
            </span>
          </div>
          <div className="manager-pick-rows">
            {md.picks.map((p, i) => {
              const code = p.type === 'driver'
                ? (p.entity?.code ?? '—')
                : (p.entity?.short_name ?? '—')
              const teamName = p.type === 'constructor' ? (p.entity?.name ?? '') : null

              return (
                <div key={i} className="manager-pick-row" style={{ '--pick-color': p.color }}>
                  <div className="pick-color-bar" />
                  <span className={`pick-badge ${p.type ?? ''}`}>
                    {p.type === 'driver' ? 'DRV' : 'CON'}
                  </span>
                  <span className="pick-code">{code}</span>
                  {teamName && <span className="pick-team">{teamName}</span>}
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
  )
}

// ── Main View ─────────────────────────────────────────

export default function Results() {
  const [gps, setGps] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [results, setResults] = useState([])
  const [picks, setPicks] = useState([])
  const [drivers, setDrivers] = useState([])
  const [constructors, setConstructors] = useState([])
  const [managers, setManagers] = useState([])
  const [settings, setSettings] = useState(null)
  const [session, setSession] = useState('race')
  const [mainTab, setMainTab] = useState('race')
  const [loading, setLoading] = useState(true)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)

  // Initial load
  useEffect(() => {
    Promise.all([
      supabase.from('grand_prix').select('*').in('status', ['drafted', 'scored']).order('round_number', { ascending: false }),
      supabase.from('drivers').select('*, constructor:constructors(id,name,short_name,color)'),
      supabase.from('constructors').select('*'),
      supabase.from('managers').select('*'),
      supabase.from('league_settings').select('*').eq('id', 1).single(),
      supabase.auth.getUser(),
    ]).then(([
      { data: gpsData, error: gpsErr },
      { data: drvsData, error: drvsErr },
      { data: consData, error: consErr },
      { data: mgrsData, error: mgrsErr },
      { data: cfg, error: cfgErr },
      { data: { user } },
    ]) => {
      if (gpsErr || drvsErr || consErr || mgrsErr || cfgErr) {
        setError((gpsErr ?? drvsErr ?? consErr ?? mgrsErr ?? cfgErr).message)
      } else {
        setGps(gpsData ?? [])
        setDrivers(drvsData ?? [])
        setConstructors(consData ?? [])
        setManagers(mgrsData ?? [])
        setSettings(cfg)
        setUserId(user?.id ?? null)
        if (gpsData?.length) setSelectedId(gpsData[0].id)
      }
      setLoading(false)
    })
  }, [])

  // Load results + picks when selected GP changes
  useEffect(() => {
    if (!selectedId) return
    setResultsLoading(true)
    Promise.all([
      supabase.from('race_results').select('*').eq('gp_id', selectedId),
      supabase.from('draft_picks').select('*').eq('gp_id', selectedId),
    ]).then(([{ data: resData }, { data: picksData }]) => {
      setResults(resData ?? [])
      setPicks(picksData ?? [])
      setSession('race')
      setResultsLoading(false)
    })
  }, [selectedId])

  const driversById = useMemo(
    () => Object.fromEntries(drivers.map((d) => [d.id, d])),
    [drivers]
  )

  const selectedGp = gps.find((g) => g.id === selectedId)
  const hasSprint = selectedGp?.has_sprint ?? results.some((r) => r.session_type === 'sprint')

  const sessionRows = useMemo(
    () => sortResults(results.filter((r) => r.session_type === session)),
    [results, session]
  )

  const calcPts = (r, sessionType) =>
    calcDriverScore(r, sessionType)

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

      <div className="standings-tabs">
        <button
          className={`standings-tab${mainTab === 'race' ? ' active' : ''}`}
          onClick={() => setMainTab('race')}
        >
          Race
        </button>
        <button
          className={`standings-tab${mainTab === 'scores' ? ' active' : ''}`}
          onClick={() => setMainTab('scores')}
        >
          Scores
        </button>
      </div>

      {mainTab === 'race' && (
        <RaceTab
          sessionRows={sessionRows}
          resultsLoading={resultsLoading}
          session={session}
          hasSprint={hasSprint}
          setSession={setSession}
          driversById={driversById}
          calcPts={calcPts}
        />
      )}

      {mainTab === 'scores' && (
        <ScoresTab
          picks={picks}
          managers={managers}
          drivers={drivers}
          constructors={constructors}
          results={results}
          settings={settings}
          userId={userId}
        />
      )}
    </div>
  )
}
