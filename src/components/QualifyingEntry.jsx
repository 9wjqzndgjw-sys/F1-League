import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchQualifyingGrid } from '../lib/openf1'

export default function QualifyingEntry() {
  const [gps, setGps] = useState([])
  const [drivers, setDrivers] = useState([])
  const [selectedGpId, setSelectedGpId] = useState('')
  const [sessionType, setSessionType] = useState('qualifying')
  const [slots, setSlots] = useState(Array(22).fill(''))
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    Promise.all([
      supabase
        .from('grand_prix')
        .select('id, name, round_number, has_sprint, race_date')
        .in('status', ['drafting', 'drafted', 'scored'])
        .order('round_number'),
      supabase
        .from('drivers')
        .select('id, code, full_name, number')
        .order('code'),
    ]).then(([{ data: gpsData }, { data: drvsData }]) => {
      setGps(gpsData ?? [])
      setDrivers(drvsData ?? [])
    })
  }, [])

  useEffect(() => {
    if (!selectedGpId) return
    setSlots(Array(22).fill(''))
    supabase
      .from('race_results')
      .select('driver_id, position')
      .eq('gp_id', Number(selectedGpId))
      .eq('session_type', sessionType)
      .order('position')
      .then(({ data }) => {
        if (!data?.length) return
        const next = Array(22).fill('')
        for (const row of data) {
          const i = row.position - 1
          if (i >= 0 && i < 22) next[i] = row.driver_id
        }
        setSlots(next)
      })
  }, [selectedGpId, sessionType])

  async function importFromOpenF1() {
    const raceDateStr = selectedGp?.race_date
    if (!raceDateStr) {
      setMsg('No race date on this GP — cannot match OpenF1 session')
      return
    }
    setImporting(true)
    setMsg('')
    try {
      const grid = await fetchQualifyingGrid(raceDateStr, sessionType)
      // Map driver_number → driver ID using our drivers list
      const numberToId = Object.fromEntries(drivers.map((d) => [d.number, d.id]))
      console.log('numberToId', numberToId)
      console.log('OpenF1 grid', grid)
      const next = Array(22).fill('')
      for (const [driverNumber, position] of Object.entries(grid)) {
        const driverId = numberToId[Number(driverNumber)]
        const i = position - 1
        if (!driverId) console.warn(`No driver match for number ${driverNumber} (P${position})`)
        if (driverId && i >= 0 && i < 22) next[i] = driverId
      }
      setSlots(next)
      setMsg('Imported from OpenF1 — review and save')
    } catch (err) {
      setMsg(`OpenF1: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  async function save() {
    if (!selectedGpId) return
    setSaving(true)
    setMsg('')

    const gpId = Number(selectedGpId)

    const rows = slots
      .map((driverId, i) => ({ driver_id: driverId, position: i + 1 }))
      .filter((r) => r.driver_id)
      .map((r) => ({
        gp_id: gpId,
        session_type: sessionType,
        driver_id: r.driver_id,
        position: r.position,
      }))

    const { error: delErr } = await supabase
      .from('race_results')
      .delete()
      .eq('gp_id', gpId)
      .eq('session_type', sessionType)

    if (delErr) {
      setSaving(false)
      setMsg(`Error: ${delErr.message}`)
      return
    }

    if (rows.length) {
      const { error: insErr } = await supabase.from('race_results').insert(rows)
      setSaving(false)
      setMsg(insErr ? `Error: ${insErr.message}` : 'Saved!')
    } else {
      setSaving(false)
      setMsg('Saved!')
    }

    setTimeout(() => setMsg(''), 2500)
  }

  const selectedGp = gps.find((g) => String(g.id) === selectedGpId)

  // Drivers already picked in other slots (to flag duplicates)
  const usedIds = new Set(slots.filter(Boolean))

  return (
    <div>
      <div className="settings-card">
        <select
          className="settings-select"
          value={selectedGpId}
          onChange={(e) => setSelectedGpId(e.target.value)}
        >
          <option value="">Select GP…</option>
          {gps.map((gp) => (
            <option key={gp.id} value={gp.id}>
              R{String(gp.round_number).padStart(2, '0')} {gp.name}
            </option>
          ))}
        </select>

        {selectedGpId && (
          <div className="qual-session-toggle">
            <button
              className={`qual-session-btn${sessionType === 'qualifying' ? ' active' : ''}`}
              onClick={() => setSessionType('qualifying')}
            >
              Qualifying
            </button>
            {selectedGp?.has_sprint && (
              <button
                className={`qual-session-btn${sessionType === 'sprint_qualifying' ? ' active' : ''}`}
                onClick={() => setSessionType('sprint_qualifying')}
              >
                Sprint Qual
              </button>
            )}
          </div>
        )}

        {selectedGpId && (
          <button
            className="qual-openf1-btn"
            onClick={importFromOpenF1}
            disabled={importing || saving}
          >
            {importing ? 'Fetching…' : 'Import from OpenF1'}
          </button>
        )}

        {selectedGpId && (
          <div className="qual-slots">
            {slots.map((driverId, i) => {
              const isDupe = driverId && [...slots].filter((id) => id === driverId).length > 1
              return (
                <div key={i} className="qual-slot-row">
                  <span className="qual-pos">P{i + 1}</span>
                  <select
                    className={`qual-driver-select${isDupe ? ' dupe' : ''}`}
                    value={driverId}
                    onChange={(e) => {
                      const next = [...slots]
                      next[i] = e.target.value
                      setSlots(next)
                    }}
                  >
                    <option value="">—</option>
                    {drivers.map((d) => (
                      <option
                        key={d.id}
                        value={d.id}
                        disabled={usedIds.has(d.id) && d.id !== driverId}
                      >
                        {d.code} — {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedGpId && (
        <div className="settings-save-row">
          <button
            className="settings-save-btn"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Grid'}
          </button>
          {msg && <span className="settings-saved">{msg}</span>}
        </div>
      )}
    </div>
  )
}
