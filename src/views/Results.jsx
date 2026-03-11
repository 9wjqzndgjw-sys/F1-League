import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { calcDriverScore, calcConstructorScores, calcPayouts, DEFAULT_CONSTRUCTOR_SCORING } from '../lib/scoring'

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

function PickRow({ pick, isScored, gridPos }) {
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
      <span className="msc-pick-code">{code}</span>
      {gridPos != null && (
        <span className="msc-grid-pos" title="Starting grid position">P{gridPos}</span>
      )}
      <span className="msc-pick-name">{name}</span>
      <span className={`msc-pick-pts${!isScored ? ' zero' : pts < 0 ? ' neg' : pts === 0 ? ' zero' : ''}`}>
        {isScored ? (pts > 0 ? `+${pts}` : pts) : '—'}
      </span>
      <span className={`msc-type-badge${type === 'constructor' ? ' con' : ''}`}>
        {type === 'constructor' ? 'CON' : 'DRV'}
      </span>
    </div>
  )
}

function fmtNet(n) {
  const abs = Math.abs(n)
  const str = abs % 1 === 0 ? String(abs) : abs.toFixed(2)
  return `${n < 0 ? '-' : '+'}$${str}`
}

function ManagerScoreCard({ score, isScored, isMe, gridMap }) {
  const name = score.manager.display_name || score.manager.name || 'Unknown'
  const rank = score.rank

  return (
    <div className={`manager-score-card${isMe ? ' me' : ''}`}>
      <div className="msc-header">
        <span className="msc-rank">{rank}</span>
        <span className="msc-name">{name}</span>
        {isScored && score.net !== 0 && (
          <span className={`msc-payout${score.net < 0 ? ' neg' : ''}`}>{fmtNet(score.net)}</span>
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
          : [...score.picks]
              .sort((a, b) => (a.type === 'constructor' ? -1 : b.type === 'constructor' ? 1 : 0))
              .map((p, i) => (
                <PickRow
                  key={i}
                  pick={p}
                  isScored={isScored}
                  gridPos={p.type === 'driver' ? gridMap?.[p.entity?.id] : null}
                />
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

  // ── Recap state ───────────────────────────────────────
  const [recap, setRecap]           = useState(null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [recapError, setRecapError] = useState(null)

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

  // ── Load recap for selected GP ────────────────────────
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setRecap(null)
    setRecapError(null)
    supabase
      .from('grand_prix')
      .select('recap')
      .eq('id', selectedId)
      .single()
      .then(({ data }) => { if (!cancelled) setRecap(data?.recap ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedId])

  async function generateRecap() {
    if (!selectedId) return
    setRecapLoading(true)
    setRecapError(null)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const token = authSession?.access_token
      if (!token) throw new Error('Not authenticated')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-recap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ gp_id: selectedId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate recap')
      setRecap(json.recap)
    } catch (err) {
      setRecapError(err.message ?? 'Error generating recap')
    } finally {
      setRecapLoading(false)
    }
  }

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
  const conScoring    = useMemo(() => (leagueSettings?.scoring_constructor?.length ? leagueSettings.scoring_constructor : DEFAULT_CONSTRUCTOR_SCORING).map(Number), [leagueSettings])
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
      const cid = d.constructor_id ?? d.team_id
      if (!byConstructor[cid]) byConstructor[cid] = []
      byConstructor[cid].push(driverPts[d.id])
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

    const ranked = Object.values(scoreMap).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      const na = a.manager.display_name ?? a.manager.name ?? ''
      const nb = b.manager.display_name ?? b.manager.name ?? ''
      return na.localeCompare(nb)
    })

    const payoutResults = calcPayouts(
      ranked.map((s) => ({ id: s.manager.id, total: s.total })),
      payoutFirst,
      payoutSecond,
    )
    for (const { id, rank, payout, owed, net } of payoutResults) {
      const s = ranked.find((r) => r.manager.id === id)
      s.rank = rank
      s.payout = payout
      s.owed = owed
      s.net = net
    }

    return ranked
  }, [managers, picks, results, drivers, constructors, raceScoring, sprintScoring, conScoring, dnfPenalty, payoutFirst, payoutSecond, driversById])

  // Build driverId → qualifying grid position for the selected GP
  // results already includes all session_type rows for the selected GP
  const gridMap = useMemo(() => {
    const map = {}
    for (const r of results) {
      if (r.session_type === 'qualifying' || r.session_type === 'sprint_qualifying') {
        if (!map[r.session_type]) map[r.session_type] = {}
        map[r.session_type][r.driver_id] = r.position
      }
    }
    return map
  }, [results])

  // Constructor scores for the current race/sprint session
  const constructorSessionScores = useMemo(() => {
    if (!sessionRows.length || !constructors.length) return []
    const sessionDriverPts = {}
    for (const r of sessionRows) {
      sessionDriverPts[r.driver_id] = calcDriverScore(r, session, raceScoring, sprintScoring, dnfPenalty)
    }
    const byConstructor = {}
    for (const d of drivers) {
      const cid = d.constructor_id ?? d.team_id
      if (sessionDriverPts[d.id] !== undefined) {
        if (!byConstructor[cid]) byConstructor[cid] = []
        byConstructor[cid].push(sessionDriverPts[d.id])
      }
    }
    const conScoreList = calcConstructorScores(constructors, byConstructor, conScoring)
    return conScoreList
      .filter(cs => byConstructor[cs.constructorId])
      .sort((a, b) => a.rank - b.rank)
      .map(cs => ({ ...cs, constructor: constructors.find(c => c.id === cs.constructorId) }))
  }, [sessionRows, session, drivers, constructors, raceScoring, sprintScoring, conScoring, dnfPenalty])

  const selectedGp = gps.find((g) => g.id === selectedId)
  const liveGp     = gps.find((g) => g.status === 'drafted')

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

      {/* In-progress GP banner */}
      {liveGp && (
        <button
          className="live-gp-banner"
          onClick={() => { setSelectedId(liveGp.id); setSession('scores') }}
        >
          <span className="live-dot" />
          <span className="live-gp-label">
            R{String(liveGp.round_number).padStart(2, '0')} {liveGp.name} — in progress
          </span>
          <span className="live-gp-cta">View Scores ›</span>
        </button>
      )}

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
            gpScores.map((score) => (
              <ManagerScoreCard
                key={score.manager.id}
                score={score}
                isScored={selectedGp?.status === 'scored'}
                isMe={score.manager.id === currentManager?.id}
                gridMap={gridMap.qualifying}
              />
            ))
          )}

          {/* ── AI Recap section ─────────────────── */}
          {selectedGp?.status === 'scored' && (
            <div className="recap-section">
              <div className="recap-header">
                <span className="recap-title">AI Recap</span>
                {currentManager?.is_commissioner && (
                  <button
                    className="recap-generate-btn"
                    onClick={generateRecap}
                    disabled={recapLoading}
                  >
                    {recapLoading ? 'Generating…' : recap ? 'Regenerate' : 'Generate Recap'}
                  </button>
                )}
              </div>
              {recapLoading && (
                <div className="recap-loading">
                  <span className="recap-loading-dot" />
                  <span className="recap-loading-dot" />
                  <span className="recap-loading-dot" />
                  <span className="recap-loading-text">Claude is writing the recap…</span>
                </div>
              )}
              {recapError && !recapLoading && (
                <div className="recap-error">{recapError}</div>
              )}
              {recap && !recapLoading && (
                <div className="recap-body">
                  {recap.split('\n').filter(l => l.trim()).map((line, i) => (
                    <p key={i} className="recap-paragraph">{line}</p>
                  ))}
                </div>
              )}
              {!recap && !recapLoading && !recapError && (
                <div className="recap-empty">
                  {currentManager?.is_commissioner
                    ? 'No recap yet. Hit "Generate Recap" to have Claude write one.'
                    : 'No recap yet for this round.'}
                </div>
              )}
            </div>
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

          {!resultsLoading && constructorSessionScores.length > 0 && (
            <div className="constructor-scores-section">
              {constructorSessionScores.map((cs) => {
                const color = cs.constructor?.color ?? '#555'
                const name = cs.constructor?.short_name ?? cs.constructor?.name ?? '—'
                return (
                  <div
                    key={cs.constructorId}
                    className="constructor-score-row"
                    style={{ '--team-color': color }}
                  >
                    <span className="con-score-rank">P{cs.rank}</span>
                    <div className="result-color-bar" />
                    <span className="con-score-name">{name}</span>
                    <span className="con-score-total" title="Combined driver points">{cs.total} drv</span>
                    <span className={`con-score-pts${cs.constructorPoints === 0 ? ' pts-zero' : ''}`}>
                      +{cs.constructorPoints}
                    </span>
                  </div>
                )
              })}
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
                    {session === 'race' && r.grid != null && (
                      <span className="result-grid" title="Starting grid position">
                        Grd {r.grid}
                      </span>
                    )}
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
