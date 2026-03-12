import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { getSubscriptionState, subscribeToPush, unsubscribeFromPush } from '../lib/push'
import DriverSync from '../components/DriverSync.jsx'
import ResultSync from '../components/ResultSync.jsx'
import QualifyingEntry from '../components/QualifyingEntry.jsx'

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

  // Notifications
  const [notifStatus, setNotifStatus] = useState('idle') // idle | requesting | sending | sent | denied | unsupported
  const [pushState, setPushState] = useState('loading') // loading | unsupported | denied | unsubscribed | subscribed

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
    let cancelled = false
    Promise.all([
      supabase.from('managers').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('league_settings').select('*').eq('id', 1).single(),
      supabase.from('grand_prix').select('id,name,round_number,status').order('round_number'),
      supabase.from('managers').select('id, display_name').order('display_name'),
    ])
      .then(([{ data: mgr }, { data: cfg }, { data: gpsData }, { data: mgrsData }]) => {
        if (cancelled) return
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
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user])

  // Load push subscription state once manager is known
  useEffect(() => {
    if (!manager) return
    getSubscriptionState(manager.id).then(setPushState)
  }, [manager])

  async function enablePush() {
    if (!('Notification' in window)) { setPushState('unsupported'); return }
    setPushState('requesting')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { setPushState('denied'); return }
    try {
      await subscribeToPush(manager.id)
      setPushState('subscribed')
    } catch {
      setPushState('unsubscribed')
    }
  }

  async function disablePush() {
    try {
      await unsubscribeFromPush(manager.id)
    } catch { /* ignore */ }
    setPushState('unsubscribed')
  }

  async function sendTestNotification() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotifStatus('unsupported')
      return
    }
    setNotifStatus('requesting')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setNotifStatus('denied')
      return
    }
    setNotifStatus('sending')
    try {
      const swReady = Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SW not ready')), 4000)),
      ])
      const registration = await swReady
      await registration.showNotification('F1 Fantasy 2026', {
        body: 'Push notifications are working! 🏁',
        icon: '/icon.svg',
        badge: '/icon.svg',
      })
    } catch {
      // SW not ready yet — fall back to a plain Notification
      new Notification('F1 Fantasy 2026', { body: 'Push notifications are working! 🏁', icon: '/icon.svg' })
    }
    setNotifStatus('sent')
    setTimeout(() => setNotifStatus('idle'), 3000)
  }

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
    const now = new Date().toISOString()
    const newCount = (settings?.draft_order_randomized_count ?? 0) + 1
    setOrderSaving(true)
    const { error } = await supabase
      .from('league_settings')
      .update({
        initial_draft_order: ids,
        draft_order_randomized_count: newCount,
        draft_order_last_randomized_at: now,
      })
      .eq('id', 1)
    setOrderSaving(false)
    if (!error) {
      setDraftOrderIds(ids)
      setSettings(prev => ({
        ...prev,
        draft_order_randomized_count: newCount,
        draft_order_last_randomized_at: now,
      }))
    }
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

      {/* Notifications */}
      <Section title="Notifications">
        <div className="settings-card">
          <div className="settings-info-row">
            <span className="info-label">Pick alerts</span>
            {pushState === 'loading' && <span className="info-value">…</span>}
            {pushState === 'subscribed' && (
              <button className="settings-save-btn" onClick={disablePush}>Disable</button>
            )}
            {(pushState === 'unsubscribed') && (
              <button className="settings-save-btn" onClick={enablePush}>Enable</button>
            )}
            {pushState === 'requesting' && (
              <button className="settings-save-btn" disabled>Requesting…</button>
            )}
            {pushState === 'unsupported' && <span className="info-value" style={{ color: 'var(--color-red, #f87171)' }}>Not supported</span>}
            {pushState === 'denied' && <span className="info-value" style={{ color: 'var(--color-red, #f87171)' }}>Blocked in browser</span>}
          </div>
          {pushState === 'subscribed' && <p className="settings-saved" style={{ padding: '0.25rem 0.75rem' }}>You'll get notified when someone makes a pick.</p>}
          <div className="settings-info-row" style={{ marginTop: '0.5rem' }}>
            <span className="info-label">Test notification</span>
            <button
              className="settings-save-btn"
              onClick={sendTestNotification}
              disabled={notifStatus === 'requesting' || notifStatus === 'sending'}
            >
              {notifStatus === 'requesting' ? 'Requesting…'
                : notifStatus === 'sending' ? 'Sending…'
                : 'Send Test'}
            </button>
          </div>
          {notifStatus === 'sent' && <p className="settings-saved" style={{ padding: '0.25rem 0.75rem' }}>Notification sent!</p>}
          {notifStatus === 'denied' && <p className="settings-saved" style={{ padding: '0.25rem 0.75rem', color: 'var(--color-red, #f87171)' }}>Notifications blocked — check your browser settings.</p>}
          {notifStatus === 'unsupported' && <p className="settings-saved" style={{ padding: '0.25rem 0.75rem', color: 'var(--color-red, #f87171)' }}>Push notifications not supported on this device.</p>}
        </div>
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

      {/* Draft order — visible to all, randomize commissioner-only */}
      <Section title="Draft Order">
        <div className="settings-card">
          {draftOrderIds.length === 0 ? (
            <p className="draft-order-empty">Not set yet.</p>
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
          {settings?.draft_order_last_randomized_at && (
            <div className="draft-order-meta">
              <span>Randomized {settings.draft_order_randomized_count ?? 0} time{settings.draft_order_randomized_count !== 1 ? 's' : ''}</span>
              <span>Last: {new Date(settings.draft_order_last_randomized_at).toLocaleString()}</span>
            </div>
          )}
        </div>
        {isCommissioner && (
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
        )}
      </Section>

      {/* Commissioner — Driver sync */}
      {isCommissioner && (
        <Section title="Driver Sync">
          <DriverSync />
        </Section>
      )}

      {/* Commissioner — Qualifying grid entry */}
      {isCommissioner && (
        <Section title="Qualifying Grid">
          <QualifyingEntry />
        </Section>
      )}

      {/* Commissioner — Result sync from OpenF1 */}
      {isCommissioner && (
        <Section title="Result Sync">
          <ResultSync />
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
