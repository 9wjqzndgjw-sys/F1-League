import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function ScoringTable({ rows, posLabel = 'Position' }) {
  return (
    <div className="scoring-table">
      <div className="scoring-table-head">
        <span>{posLabel}</span>
        <span>Points</span>
      </div>
      {rows.map(({ label, pts }, i) => (
        <div key={i} className={`scoring-table-row${i % 2 === 1 ? ' alt' : ''}`}>
          <span>{label}</span>
          <span className={`scoring-pts${pts < 0 ? ' neg' : pts === 0 ? ' zero' : ''}`}>{pts > 0 ? `+${pts}` : pts}</span>
        </div>
      ))}
    </div>
  )
}

export default function Scoring() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase.from('league_settings').select('*').eq('id', 1).single()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else setSettings(data)
      })
      .catch((err) => { if (!cancelled) setError(err.message ?? 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="view-loading">Loading scoring…</div>
  if (error) return <div className="view-loading">Error: {error}</div>

  const raceScoring = (settings?.scoring_race ?? []).map(Number)
  const sprintScoring = (settings?.scoring_sprint ?? []).map(Number)
  const constructorScoring = (settings?.scoring_constructor ?? []).map(Number)
  const dnfPenalty = Number(settings?.dnf_penalty ?? 0)
  const payoutFirst = settings?.payout_first ?? 8
  const payoutSecond = settings?.payout_second ?? 2
  const draftRounds = settings?.draft_rounds ?? 3

  const raceRows = raceScoring.map((pts, i) => ({ label: ordinal(i + 1), pts }))
  const sprintRows = sprintScoring.map((pts, i) => ({ label: ordinal(i + 1), pts }))
  const conRows = constructorScoring.map((pts, i) => ({ label: ordinal(i + 1), pts }))

  const sameSprint = raceScoring.length === sprintScoring.length &&
    raceScoring.every((v, i) => v === sprintScoring[i])

  return (
    <div className="scoring-view">

      <div className="scoring-section">
        <p className="scoring-section-title">Weekly Payouts</p>
        <div className="settings-card">
          <div className="settings-info-row">
            <span className="info-label">1st place</span>
            <span className="info-value payout-green">${payoutFirst}</span>
          </div>
          <div className="settings-info-row">
            <span className="info-label">2nd place</span>
            <span className="info-value payout-green">${payoutSecond}</span>
          </div>
        </div>
      </div>

      <div className="scoring-section">
        <p className="scoring-section-title">Draft Format</p>
        <div className="settings-card">
          <div className="settings-info-row">
            <span className="info-label">Rounds per GP</span>
            <span className="info-value">{draftRounds}</span>
          </div>
          <div className="settings-info-row">
            <span className="info-label">Rounds 1–2</span>
            <span className="info-value">Drivers only</span>
          </div>
          {draftRounds >= 3 && (
            <div className="settings-info-row">
              <span className="info-label">Round{draftRounds > 3 ? 's' : ''} {draftRounds === 3 ? '3' : '3–' + draftRounds}</span>
              <span className="info-value">Driver or Constructor</span>
            </div>
          )}
          <div className="settings-info-row">
            <span className="info-label">Draft order</span>
            <span className="info-value">Snake (rotates each GP)</span>
          </div>
        </div>
      </div>

      <div className="scoring-section">
        <p className="scoring-section-title">Race Points</p>
        <ScoringTable rows={raceRows} />
        {dnfPenalty !== 0 && (
          <div className="settings-card" style={{ marginTop: '0.5rem' }}>
            <div className="settings-info-row">
              <span className="info-label">DNF penalty</span>
              <span className="info-value" style={{ color: '#f87171' }}>{dnfPenalty} pts</span>
            </div>
            <div className="settings-info-row">
              <span className="info-label">DNS / DSQ</span>
              <span className="info-value" style={{ color: 'var(--text-muted)' }}>0 pts</span>
            </div>
          </div>
        )}
      </div>

      {sprintRows.length > 0 && (
        <div className="scoring-section">
          <p className="scoring-section-title">Sprint Points{sameSprint ? ' (same as race)' : ''}</p>
          {sameSprint
            ? <p className="scoring-note">Sprint weekends use the same points table as a standard race.</p>
            : <ScoringTable rows={sprintRows} />}
        </div>
      )}

      {conRows.length > 0 && (
        <div className="scoring-section">
          <p className="scoring-section-title">Constructor Points</p>
          <p className="scoring-note">Constructors are ranked each round by their drivers' combined fantasy points.</p>
          <ScoringTable rows={conRows} posLabel="Rank" />
        </div>
      )}

    </div>
  )
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
