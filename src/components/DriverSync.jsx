import { useState } from 'react'
import { supabase } from '../lib/supabase'

const OPENF1_URL = 'https://api.openf1.org/v1/drivers?session_key=latest'

// Map OpenF1 team names to our constructor IDs
const TEAM_MAP = {
  'McLaren':        1,
  'Mercedes':       2,
  'Red Bull Racing': 3,
  'Ferrari':        4,
  'Williams':       5,
  'Racing Bulls':   6,
  'Aston Martin':   7,
  'Haas F1 Team':   8,
  'Audi':           9,
  'Alpine':         10,
  'Cadillac':       11,
}

function titleCase(str) {
  return str
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function ChangeRow({ change }) {
  if (change.type === 'add') {
    return (
      <div className="sync-change-row add">
        <span className="sync-badge add">New</span>
        <span className="sync-change-name">#{change.number} {change.fullName}</span>
        <span className="sync-change-meta">{change.teamName}</span>
      </div>
    )
  }
  if (change.type === 'update') {
    return (
      <div className="sync-change-row update">
        <span className="sync-badge update">Changed</span>
        <span className="sync-change-name">#{change.number} {change.fullName}</span>
        <span className="sync-change-meta">{change.fields.join(', ')}</span>
      </div>
    )
  }
  return null
}

export default function DriverSync() {
  const [status, setStatus] = useState('idle') // idle | checking | ready | applying | done
  const [diff, setDiff] = useState([])
  const [msg, setMsg] = useState('')

  async function checkSync() {
    setStatus('checking')
    setDiff([])
    setMsg('')

    try {
      const [res, { data: dbDrivers }] = await Promise.all([
        fetch(OPENF1_URL),
        supabase.from('drivers').select('*'),
      ])
      const openF1 = await res.json()

      const dbByNumber = Object.fromEntries((dbDrivers ?? []).map(d => [d.number, d]))
      const changes = []

      for (const d of openF1) {
        const number = d.driver_number
        const fullName = titleCase(d.full_name)
        const code = d.name_acronym
        const teamId = TEAM_MAP[d.team_name] ?? null
        const teamName = d.team_name
        const existing = dbByNumber[number]

        if (!existing) {
          changes.push({ type: 'add', number, fullName, code, teamId, teamName })
        } else {
          const fields = []
          if (existing.full_name !== fullName) fields.push('name')
          if (existing.code !== code) fields.push('code')
          if (teamId && existing.team_id !== teamId) fields.push('team')
          if (fields.length > 0) {
            changes.push({ type: 'update', number, fullName, code, teamId, teamName, dbId: existing.id, fields })
          }
        }
      }

      setDiff(changes)
      setStatus('ready')
      if (changes.length === 0) setMsg('All up to date.')
    } catch (err) {
      setStatus('idle')
      setMsg('Failed to reach OpenF1. Try again.')
    }
  }

  async function applySync() {
    setStatus('applying')
    const { data: dbDrivers } = await supabase.from('drivers').select('id, team_id, color')

    // Build color lookup by team_id from existing drivers
    const colorByTeam = {}
    for (const d of dbDrivers ?? []) {
      if (d.color) colorByTeam[d.team_id] = d.color
    }

    for (const change of diff) {
      const color = colorByTeam[change.teamId] ?? '#888888'

      if (change.type === 'add') {
        await supabase.from('drivers').insert({
          number: change.number,
          code: change.code,
          full_name: change.fullName,
          team_id: change.teamId,
          color,
        })
      } else if (change.type === 'update') {
        const updates = {}
        if (change.fields.includes('name')) updates.full_name = change.fullName
        if (change.fields.includes('code')) updates.code = change.code
        if (change.fields.includes('team')) {
          updates.team_id = change.teamId
          updates.color = color
        }
        await supabase.from('drivers').update(updates).eq('id', change.dbId)
      }
    }

    setStatus('done')
    setDiff([])
    setMsg('Changes applied.')
  }

  return (
    <div className="driver-sync">
      {status === 'idle' || status === 'checking' ? (
        <button
          className="settings-save-btn"
          onClick={checkSync}
          disabled={status === 'checking'}
        >
          {status === 'checking' ? 'Checking…' : 'Check OpenF1'}
        </button>
      ) : null}

      {msg && <p className="sync-msg">{msg}</p>}

      {diff.length > 0 && (
        <>
          <div className="sync-changes-list">
            {diff.map((c, i) => <ChangeRow key={i} change={c} />)}
          </div>
          <div className="settings-save-row">
            <button
              className="settings-save-btn"
              onClick={applySync}
              disabled={status === 'applying'}
            >
              {status === 'applying' ? 'Applying…' : `Apply ${diff.length} change${diff.length !== 1 ? 's' : ''}`}
            </button>
            <button
              className="btn-cancel"
              onClick={() => { setDiff([]); setStatus('idle'); setMsg('') }}
              disabled={status === 'applying'}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {status === 'done' && (
        <button
          className="settings-save-btn"
          onClick={() => { setStatus('idle'); setMsg('') }}
        >
          Check Again
        </button>
      )}
    </div>
  )
}
