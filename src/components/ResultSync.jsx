import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const OF1 = 'https://api.openf1.org/v1'

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenF1 error ${res.status}: ${url}`)
  return res.json()
}

// Get the last recorded position for each driver in a session
async function getFinalPositions(sessionKey) {
  const data = await fetchJson(`${OF1}/position?session_key=${sessionKey}`)
  const latest = {}
  for (const entry of data) {
    const dn = entry.driver_number
    if (!latest[dn] || entry.date > latest[dn].date) {
      latest[dn] = entry
    }
  }
  return Object.values(latest)
    .filter(e => e.position > 0)
    .sort((a, b) => a.position - b.position)
}

function StatusToggle({ label, checked, onChange }) {
  return (
    <label className="result-sync-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

function ResultSyncRow({ row, onChange }) {
  const isOut = row.is_dnf || row.is_dns || row.is_dsq
  return (
    <div className={`sync-change-row result-sync-row${isOut ? ' out' : ''}`}>
      <span className="result-sync-pos">
        {isOut ? '—' : `P${row.position}`}
      </span>
      <span className="result-sync-num">#{row.driverNumber}</span>
      <span className="sync-change-name">{row.driverLabel}</span>
      {row.driverId === null && (
        <span className="sync-badge update">No match</span>
      )}
      <StatusToggle
        label="DNF"
        checked={row.is_dnf}
        onChange={v => onChange({ ...row, is_dnf: v, is_dns: false, is_dsq: false })}
      />
      <StatusToggle
        label="DNS"
        checked={row.is_dns}
        onChange={v => onChange({ ...row, is_dns: v, is_dnf: false, is_dsq: false })}
      />
      <StatusToggle
        label="DSQ"
        checked={row.is_dsq}
        onChange={v => onChange({ ...row, is_dsq: v, is_dnf: false, is_dns: false })}
      />
    </div>
  )
}

function buildRows(positions, driversByNumber) {
  return positions.map(p => {
    const dbDriver = driversByNumber[p.driver_number]
    return {
      driverNumber: p.driver_number,
      position: p.position,
      driverId: dbDriver?.id ?? null,
      driverLabel: dbDriver?.code ?? `#${p.driver_number}`,
      is_dnf: false,
      is_dns: false,
      is_dsq: false,
    }
  })
}

export default function ResultSync() {
  const [gps, setGps] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loadingData, setLoadingData] = useState(true)

  const [selectedGpId, setSelectedGpId] = useState('')
  const [status, setStatus] = useState('idle') // idle | fetching | ready | saving | done
  const [activeTab, setActiveTab] = useState('race')
  const [raceRows, setRaceRows] = useState([])
  const [sprintRows, setSprintRows] = useState([])
  const [hasSprintData, setHasSprintData] = useState(false)
  const [matchedMeeting, setMatchedMeeting] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase
        .from('grand_prix')
        .select('id,name,round_number,status,race_date,date,has_sprint')
        .in('status', ['drafted', 'scored'])
        .order('round_number'),
      supabase.from('drivers').select('id,number,code,full_name'),
    ]).then(([{ data: gpsData }, { data: drvsData }]) => {
      if (cancelled) return
      const gpList = gpsData ?? []
      setGps(gpList)
      setDrivers(drvsData ?? [])
      if (gpList.length) setSelectedGpId(gpList[gpList.length - 1].id)
    }).finally(() => { if (!cancelled) setLoadingData(false) })
    return () => { cancelled = true }
  }, [])

  const driversByNumber = Object.fromEntries(
    (drivers ?? []).map(d => [d.number, d])
  )

  async function fetchResults() {
    const gp = gps.find(g => g.id === selectedGpId)
    if (!gp) return

    setStatus('fetching')
    setMsg('')
    setRaceRows([])
    setSprintRows([])
    setHasSprintData(false)
    setMatchedMeeting(null)

    try {
      const rawDate = gp.race_date ?? gp.date
      const year = rawDate ? new Date(rawDate).getFullYear() : new Date().getFullYear()

      // 1. Find the matching OpenF1 meeting by closest date
      const meetings = await fetchJson(`${OF1}/meetings?year=${year}`)
      if (!Array.isArray(meetings) || meetings.length === 0) {
        throw new Error(`No OpenF1 meetings found for ${year}`)
      }

      const gpDate = rawDate ? new Date(rawDate) : null
      let meeting
      if (gpDate) {
        meeting = meetings.reduce((best, m) => {
          const d = Math.abs(new Date(m.date_start) - gpDate)
          const bd = best ? Math.abs(new Date(best.date_start) - gpDate) : Infinity
          return d < bd ? m : best
        }, null)
      } else {
        meeting = meetings[meetings.length - 1]
      }

      if (!meeting) throw new Error('Could not match a meeting in OpenF1')
      setMatchedMeeting(meeting.meeting_name ?? `Meeting ${meeting.meeting_key}`)

      // 2. Get sessions for this meeting
      const sessions = await fetchJson(`${OF1}/sessions?meeting_key=${meeting.meeting_key}`)
      const raceSession = sessions.find(s => s.session_name === 'Race')
      if (!raceSession) throw new Error('No Race session found for this meeting')

      const sprintSession = sessions.find(s => s.session_name === 'Sprint')

      // 3. Get final positions
      const racePositions = await getFinalPositions(raceSession.session_key)
      setRaceRows(buildRows(racePositions, driversByNumber))

      if (sprintSession) {
        const sprintPositions = await getFinalPositions(sprintSession.session_key)
        setSprintRows(buildRows(sprintPositions, driversByNumber))
        setHasSprintData(true)
        setActiveTab('race')
      }

      setStatus('ready')
    } catch (err) {
      setMsg(err.message)
      setStatus('idle')
    }
  }

  async function saveResults() {
    const gp = gps.find(g => g.id === selectedGpId)
    if (!gp) return

    setStatus('saving')

    try {
      // Remove existing results for this GP
      const { error: delErr } = await supabase
        .from('race_results')
        .delete()
        .eq('gp_id', gp.id)
      if (delErr) throw new Error(delErr.message)

      const toInsert = []

      for (const row of raceRows) {
        if (!row.driverId) continue
        toInsert.push({
          gp_id: gp.id,
          driver_id: row.driverId,
          session_type: 'race',
          position: row.is_dnf || row.is_dns || row.is_dsq ? null : row.position,
          is_dnf: row.is_dnf,
          is_dns: row.is_dns,
          is_dsq: row.is_dsq,
        })
      }

      for (const row of sprintRows) {
        if (!row.driverId) continue
        toInsert.push({
          gp_id: gp.id,
          driver_id: row.driverId,
          session_type: 'sprint',
          position: row.is_dnf || row.is_dns || row.is_dsq ? null : row.position,
          is_dnf: row.is_dnf,
          is_dns: row.is_dns,
          is_dsq: row.is_dsq,
        })
      }

      if (toInsert.length === 0) throw new Error('No matched drivers to save')

      const { error: insErr } = await supabase.from('race_results').insert(toInsert)
      if (insErr) throw new Error(insErr.message)

      setMsg(`Saved ${toInsert.length} result${toInsert.length !== 1 ? 's' : ''}.`)
      setStatus('done')
    } catch (err) {
      setMsg(`Save failed: ${err.message}`)
      setStatus('ready')
    }
  }

  function reset() {
    setStatus('idle')
    setRaceRows([])
    setSprintRows([])
    setHasSprintData(false)
    setMatchedMeeting(null)
    setMsg('')
  }

  const activeRows = activeTab === 'race' ? raceRows : sprintRows
  const setActiveRows = activeTab === 'race' ? setRaceRows : setSprintRows

  function updateRow(idx, updated) {
    setActiveRows(prev => prev.map((r, i) => (i === idx ? updated : r)))
  }

  if (loadingData) return <p className="sync-msg">Loading…</p>

  if (gps.length === 0) {
    return <p className="sync-msg">No drafted GPs to sync results for.</p>
  }

  return (
    <div className="driver-sync">
      {/* GP selector */}
      <div className="settings-info-row">
        <span className="info-label">Grand Prix</span>
        <select
          className="settings-input inline"
          style={{ width: 'auto', textAlign: 'left' }}
          value={selectedGpId}
          onChange={e => setSelectedGpId(e.target.value)}
          disabled={status === 'fetching' || status === 'saving'}
        >
          {gps.map(gp => (
            <option key={gp.id} value={gp.id}>
              R{String(gp.round_number).padStart(2, '0')} – {gp.name}
            </option>
          ))}
        </select>
      </div>

      {/* Fetch / reset buttons */}
      {(status === 'idle' || status === 'done') && (
        <div className="settings-save-row">
          <button
            className="settings-save-btn"
            onClick={fetchResults}
            disabled={!selectedGpId}
          >
            Fetch from OpenF1
          </button>
        </div>
      )}

      {status === 'fetching' && <p className="sync-msg">Fetching from OpenF1…</p>}

      {matchedMeeting && (
        <p className="sync-msg">Matched: {matchedMeeting}</p>
      )}
      {msg && <p className="sync-msg">{msg}</p>}

      {/* Results preview */}
      {status === 'ready' && (
        <>
          {hasSprintData && (
            <div className="results-tabs" style={{ margin: '0.5rem 0' }}>
              <button
                className={`results-tab${activeTab === 'race' ? ' active' : ''}`}
                onClick={() => setActiveTab('race')}
              >
                Race
              </button>
              <button
                className={`results-tab${activeTab === 'sprint' ? ' active' : ''}`}
                onClick={() => setActiveTab('sprint')}
              >
                Sprint
              </button>
            </div>
          )}

          <div className="sync-changes-list">
            {activeRows.length === 0 ? (
              <p className="sync-msg">No position data found for this session.</p>
            ) : (
              activeRows.map((row, i) => (
                <ResultSyncRow
                  key={row.driverNumber}
                  row={row}
                  onChange={updated => updateRow(i, updated)}
                />
              ))
            )}
          </div>

          <div className="settings-save-row">
            <button
              className="settings-save-btn"
              onClick={saveResults}
              disabled={status === 'saving'}
            >
              {status === 'saving' ? 'Saving…' : 'Save Results'}
            </button>
            <button
              className="btn-cancel"
              onClick={reset}
              disabled={status === 'saving'}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
