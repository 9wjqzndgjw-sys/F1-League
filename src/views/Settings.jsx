import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'

const STATUS_NEXT = {
  upcoming: { label: 'Open Draft', next: 'drafting' },
  drafting: { label: 'Close Draft', next: 'drafted' },
  drafted:  { label: 'Mark Scored', next: 'scored' },
}

const STATUS_LABEL = {
  upcoming: 'Upcoming',
  drafting: 'Draft Open',
  drafted:  'Drafted',
  scored:   'Scored',
}

function Section({ title, children }) {
  return (
    <div className="settings-section">
      <h2 className="settings-section-title">{title}</h2>
      {children}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="settings-info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const [manager, setManager] = useState(null)
  const [settings, setSettings] = useState(null)
  const [gps, setGps] = useState([])
  const [loading, setLoading] = useState(true)

  // Commissioner editable fields
  const [draftRounds, setDraftRounds] = useState(3)
  const [payoutFirst, setPayoutFirst] = useState(8)
  const [payoutSecond, setPayoutSecond] = useState(2)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [gpUpdating, setGpUpdating] = useState(null)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('managers').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('league_settings').select('*').eq('id', 1).single(),
      supabase.from('grand_prix').select('id,name,round_number,status').order('round_number'),
    ]).then(([{ data: mgr }, { data: cfg }, { data: gpsData }]) => {
      setManager(mgr)
      setSettings(cfg)
      setGps(gpsData ?? [])
      if (cfg) {
        setDraftRounds(cfg.draft_rounds ?? 3)
        setPayoutFirst(cfg.payout_first ?? 8)
        setPayoutSecond(cfg.payout_second ?? 2)
      }
      setLoading(false)
    })
  }, [user])

  async function saveLeagueSettings() {
    setSaving(true)
    const { error } = await supabase
      .from('league_settings')
      .update({
        draft_rounds: Number(draftRounds),
        payout_first: Number(payoutFirst),
        payout_second: Number(payoutSecond),
      })
      .eq('id', 1)
    setSaving(false)
    setSavedMsg(error ? 'Error saving.' : 'Saved!')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  async function advanceGp(gp) {
    const action = STATUS_NEXT[gp.status]
    if (!action) return
    setGpUpdating(gp.id)
    await supabase.from('grand_prix').update({ status: action.next }).eq('id', gp.id)
    setGps((prev) =>
      prev.map((g) => (g.id === gp.id ? { ...g, status: action.next } : g))
    )
    setGpUpdating(null)
  }

  if (loading) return <div className="view-loading">Loading…</div>

  const isCommissioner = manager?.is_commissioner ?? false

  return (
    <div className="settings-view">

      {/* Account */}
      <Section title="Account">
        <div className="settings-card">
          <InfoRow label="Name" value={manager?.display_name ?? manager?.name ?? '—'} />
          <InfoRow label="Email" value={user?.email ?? '—'} />
          {isCommissioner && (
            <InfoRow label="Role" value={
              <span className="commissioner-badge">Commissioner</span>
            } />
          )}
        </div>
        <button className="signout-full-btn" onClick={signOut}>Sign Out</button>
      </Section>

      {/* League info */}
      <Section title="League">
        <div className="settings-card">
          <InfoRow label="Draft rounds" value={isCommissioner
            ? <input
                className="settings-input inline"
                type="number"
                min={3}
                max={4}
                value={draftRounds}
                onChange={(e) => setDraftRounds(e.target.value)}
              />
            : settings?.draft_rounds ?? '—'}
          />
          <InfoRow label="Payout — 1st" value={isCommissioner
            ? <input
                className="settings-input inline"
                type="number"
                min={0}
                value={payoutFirst}
                onChange={(e) => setPayoutFirst(e.target.value)}
              />
            : `$${settings?.payout_first ?? '—'}`}
          />
          <InfoRow label="Payout — 2nd" value={isCommissioner
            ? <input
                className="settings-input inline"
                type="number"
                min={0}
                value={payoutSecond}
                onChange={(e) => setPayoutSecond(e.target.value)}
              />
            : `$${settings?.payout_second ?? '—'}`}
          />
        </div>
        {isCommissioner && (
          <div className="settings-save-row">
            <button
              className="settings-save-btn"
              onClick={saveLeagueSettings}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {savedMsg && <span className="settings-saved">{savedMsg}</span>}
          </div>
        )}
      </Section>

      {/* Commissioner — GP status manager */}
      {isCommissioner && (
        <Section title="Season Management">
          <div className="gp-manager-list">
            {gps.map((gp) => {
              const action = STATUS_NEXT[gp.status]
              return (
                <div key={gp.id} className={`gp-manager-row ${gp.status}`}>
                  <div className="gp-mgr-info">
                    <span className="gp-mgr-round">
                      R{String(gp.round_number).padStart(2, '0')}
                    </span>
                    <span className="gp-mgr-name">{gp.name}</span>
                  </div>
                  <span className={`gp-mgr-status ${gp.status}`}>
                    {STATUS_LABEL[gp.status]}
                  </span>
                  {action && (
                    <button
                      className={`gp-action-btn ${gp.status}`}
                      onClick={() => advanceGp(gp)}
                      disabled={gpUpdating === gp.id}
                    >
                      {gpUpdating === gp.id ? '…' : action.label}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}
