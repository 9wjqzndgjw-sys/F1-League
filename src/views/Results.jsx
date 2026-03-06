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

// ── Manager Scores components ─────────────────────────────

function PickRow({ pick, isScored }) {
  const { entity, type, pts } = pick
  const color = type === 'driver'
    ? (entity?.constructor?.color ?? '#555')
    : (entity?.color ?? '#555')
  const code = type === 'driver'
    ? (entity?.code ?? '—')
    : (entity?.short_name ?? entity?.name ?? '—')
  const name = entity?.name ?? '—'

  return (
    <div className="msc-pick-row" style={{ '--team-color': color }}>
      <div className="msc-pick-bar" />
      {type === 'constructor' && <span className="msc-con-badge">CON</span>}
      <span className="msc-pick-code">{code}</span>
      <span className="msc-pick-name">{name}</span>
      <span className={`msc-pick-pts${!isScored ? ' zero' : pts < 0 ? ' neg' : pts === 0 ? ' zero' : ''}`}>
        {isScored ? (pts > 0 ? `+${pts}` : pts) : '—'}
      </span>
    </div>
  )
}

function ManagerScoreCard({ rank, score, isScored, payoutFirst, payoutSecond, isMe }) {
  const payout = rank === 1 ? payoutFirst : rank === 2 ? payoutSecond : 0
  const name = score.manager.display_name || score.manager.name || 'Unknown'

  return (
    <div className={`manager-score-card${isMe ? ' me' : ''}`}>
      <div className="msc-header">
        <span className="msc-rank">{rank}</span>
        <span className="msc-name">{name}</span>
        {isScored && payout > 0 && (
          <span className="msc-payout">${payout}</span>
        )}
        {isScored ? (
          <span className={`msc-total${score.total <= 0 ? ' zero' : ''}`}>
            {score.total > 0 ? `+${score.total}` : score.total} pts
          </span>
        ) : (
          <span className="msc-total zero">TBD</span>
        )}
      </div>
      <div className="msc-picks">
        {score.picks.length === 0
          ? <span className="msc-no-picks">No picks recorded</span>
          : score.picks.map((p, i) => (
              <PickRow key={i} pick={p} isScored={isScored} />
            ))}
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────

export default function Results() {
  const { manager: currentManager } = useAuth()

  // ── Original state (unchanged) ────────────────────────
  const [gps, setGps]               = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [results, setResults]       = useState([])
  const [drivers, setDrivers]       = useState([])
  const [session, setSession]       = useState('race')
  const [loading, setLoading]       = useState(true)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [error, setError]           = useState(null)

  // ── Extra state for Scores tab ────────────────────────
  const [picks, setPicks]           = useState([])
  const [managers, setManagers]     = useState([])
  const [constructors, setConstructors] = useState([])
  const [leagueSettings, setLeagueSettings] = useState(null)

  // ── Original initial load (unchanged) ─────────────────
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase
        .from('grand_prix')
        .select('*')
        .in('status', ['drafting', 'drafted', 'scored'])
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

  // ── Extra load: managers + constructors + settings ────
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('managers').select('*'),
      supabase.from('constructors').select('*'),
      supabase.from('league_settings').select('*').eq('id', 1).maybeSingle(),
    ])
      .then(([{ data: mgrs }, { data: cons }, { data: cfg }]) => {
        if (cancelled) return
        setManagers(mgrs ?? [])
        setConstructors(cons ?? [])
        setLeagueSettings(cfg)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── Original per-GP load (unchanged) ──────────────────
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

  // ── Extra per-GP load: picks ───────────────────────────
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    supabase
      .from('draft_picks')
      .select('*')
      .eq('gp_id', selectedId)
      .then(({ data }) => { if (!cancelled) setPicks(data ?? []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedId])

  // ── Derived ───────────────────────────────────────────

  const driversById = useMemo(
    () => Object.fromEntries(drivers.map((d) => [d.id, d])),
    [drivers]
  )

  const hasSprint = results.some((r) => r.session_type === 'sprint')

  const sessionRows = useMemo(
    () => sortResults(results.filter((r) => r.session_type === session)),
    [results, session]
  )

  const raceScoring   = useMemo(() => (leagueSettings?.scoring_race        ?? []).map(Number), [leagueSettings])
  const sprintScoring = useMemo(() => (leagueSettings?.scoring_sprint      ?? []).map(Number), [leagueSettings])
  const conScoring    = useMemo(() => (leagueSettings?.scoring_constructor ?? []).map(Number), [leagueSettings])
  const dnfPenalty    = leagueSettings?.dnf_penalty  ?? 0
  const payoutFirst   = leagueSettings?.payout_first  ?? 8
  const payoutSecond  = leagueSettings?.payout_second ?? 2

  const gpScores = useMemo(() => {
    if (!managers.length) return []

    const resultMap = {}
    for (const r of results) {
      if (!resultMap[r.driver_id]) resultMap[r.driver_id] = {}
      resultMap[r.driver_id][r.session_type] = r
    }

    const driverPts = {}
    for (const d of drivers) {
      const rPts = calcDriverScore(resultMap[d.id]?.race,   'race',   raceScoring, sprintScoring, dnfPenalty)
      const sPts = resultMap[d.id]?.sprint
        ? calcDriverScore(resultMap[d.id].sprint, 'sprint', raceScoring, sprintScoring, dnfPenalty)
        : 0
      driverPts[d.id] = rPts + sPts
    }

    const byConstructor = {}
    for (const d of drivers) {
      if (!byConstructor[d.constructor_id]) byConstructor[d.constructor_id] = []
      byConstructor[d.constructor_id].push(driverPts[d.id])
    }
    const conScores = calcConstructorScores(constructors, byConstructor, conScoring)
    const conPtsMap = Object.fromEntries(conScores.map((cs) => [cs.constructorId, cs.constructorPoints]))
    const conById   = Object.fromEntries(constructors.map((c) => [c.id, c]))

    const scoreMap = Object.fromEntries(
      managers.map((m) => [m.id, { manager: m, total: 0, picks: [] }])
    )
    for (const pick of picks) {
      const s = scoreMap[pick.manager_id]
      if (!s) continue
      if (pick.driver_id) {
        const pts = driverPts[pick.driver_id] ?? 0
        s.picks.push({ type: 'driver', entity: driversById[pick.driver_id], pts })
        s.total += pts
      }
      if (pick.constructor_id) {
        const pts = conPtsMap[pick.constructor_id] ?? 0
        s.picks.push({ type: 'constructor', entity: conById[pick.constructor_id], pts })
        s.total += pts
      }
    }

    return Object.values(scoreMap).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      const na = a.manager.display_name ?? a.manager.name ?? ''
      const nb = b.manager.display_name ?? b.manager.name ?? ''
      return na.localeCompare(nb)
    })
  }, [managers, picks, results, drivers, constructors, raceScoring, sprintScoring, conScoring, dnfPenalty, driversById])

  const selectedGp = gps.find((g) => g.id === selectedId)

  // ── Render ────────────────────────────────────────────

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

      {/* GP selector */}
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

      {/* Tab bar */}
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

      {/* ── Scores tab ───────────────────────────── */}
      {session === 'scores' && (
        <div className="scores-list">
          {gpScores.length === 0 ? (
            <div className="no-session-results">No picks found for this round</div>
          ) : (
            gpScores.map((score, i) => (
              <ManagerScoreCard
                key={score.manager.id}
                rank={i + 1}
                score={score}
                isScored={selectedGp?.status === 'scored'}
                payoutFirst={payoutFirst}
                payoutSecond={payoutSecond}
                isMe={score.manager.id === currentManager?.id}
              />
            ))
          )}
        </div>
      )}

      {/* ── Race / Sprint tab ────────────────────── */}
      {session !== 'scores' && (
        <>
          {resultsLoading && <div className="results-loading">Loading…</div>}

          {!resultsLoading && sessionRows.length === 0 && (
            <div className="no-session-results">
              No {session} results entered for this round yet
            </div>
          )}

          {!resultsLoading && sessionRows.length > 0 && (
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
        </>
      )}
    </div>
  )
}
