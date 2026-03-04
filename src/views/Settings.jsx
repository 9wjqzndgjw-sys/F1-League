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

  // Name editing
  const [displayName, setDisplayName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState('')

  // Commissioner editable fields
  const [draftRounds, setDraftRounds] = useState(3)
  const [payoutFirst, setPayoutFirst] = useState(8)
  const [payoutSecond, setPayoutSecond] = useState(2)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [gpUpdating, setGpUpdating] = useState(null)
  const [allManagers, setAllManagers] = useState([])
  const [draftOrderIds, setDraftOrderIds] = useState([])
  const [orderSaving, setOrderSaving] = useState(false)
  const [orderMsg, setOrderMsg] = useState('')

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('managers').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('league_settings').select('*').eq('id', 1).single(),
      supabase.from('grand_prix').select('id,name,round_number,status').order('round_number'),
      supabase.from('managers').select('id, display_name').order('display_name'),
    ]).then(([{ data: mgr }, { data: cfg }, { data: gpsData }, { data: mgrsData }]) => {
      setManager(mgr)
      setDisplayName(mgr?.display_name ?? '')
      setSettings(cfg)
      setGps(gpsData ?? [])
      setAllManagers(mgrsData ?? [])
      setDraftOrderIds(cfg?.initial_draft_order ?? [])
      if (cfg) {
        setDraftRounds(cfg.draft_rounds ?? 3)
        setPayoutFirst(cfg.payout_first ?? 8)
        setPayoutSecond(cfg.payout_second ?? 2)
      }
      setLoading(false)
    })
  }, [user])

  async function saveName() {
    if (!displayName.trim()) return
    setNameSaving(true)
    const { error } = await supabase
      .from('managers')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id)
    setNameSaving(false)
    setNameMsg(error ? 'Error saving.' : 'Saved!')
    setTimeout(() => setNameMsg(''), 2000)
  }

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

  async function randomizeDraftOrder() {
    const ids = allManagers.map(m => m.id)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]]
    }
    setOrderSaving(true)
    const { error } = await supabase
      .from('league_settings')
      .update({ initial_draft_order: ids })
      .eq('id', 1)
    setOrderSaving(false)
    if (!error) setDraftOrderIds(ids)
    setOrderMsg(error ? 'Error saving.' : 'Saved!')
    setTimeout(() => setOrderMsg(''), 2000)
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
          <InfoRow label="Name" value={
            <input
              className="settings-input inline"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          } />
          {isCommissioner && (
            <InfoRow label="Role" value={
              <span className="commissioner-badge">Commissioner</span>
            } />
          )}
        </div>
        <div className="settings-save-row">
          <button
            className="settings-save-btn"
            onClick={saveName}
            disabled={nameSaving}
          >
            {nameSaving ? 'Saving…' : 'Save Name'}
          </button>
          {nameMsg && <span className="settings-saved">{nameMsg}</span>}
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

      {/* Commissioner — Draft order */}
      {isCommissioner && (
        <Section title="Draft Order">
          <div className="settings-card">
            {draftOrderIds.length === 0 ? (
              <p className="draft-order-empty">Not set — randomize to generate.</p>
            ) : (
              <ol className="draft-order-list">
                {draftOrderIds.map((id, i) => {
                  const mgr = allManagers.find(m => m.id === id)
                  return (
                    <li key={id} className="draft-order-item">
                      <span className="draft-order-pos">{i + 1}</span>
                      <span className="draft-order-name">{mgr?.display_name ?? id}</span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
          <div className="settings-save-row">
            <button
              className="settings-save-btn"
              onClick={randomizeDraftOrder}
              disabled={orderSaving}
            >
              {orderSaving ? 'Saving…' : 'Randomize'}
            </button>
            {orderMsg && <span className="settings-saved">{orderMsg}</span>}
          </div>
        </Section>
      )}

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
