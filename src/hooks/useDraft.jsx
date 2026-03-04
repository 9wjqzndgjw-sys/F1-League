import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth.jsx'
import { getDraftOrder } from '../lib/draftOrder'

export function useDraft() {
  const { manager } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(null)
  const [gp, setGp] = useState(undefined) // undefined = not yet loaded, null = no active GP
  const [managers, setManagers] = useState({})
  const [drivers, setDrivers] = useState([])
  const [constructors, setConstructors] = useState([])
  const [picks, setPicks] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [
          { data: settingsData, error: settingsErr },
          { data: gpData, error: gpErr },
          { data: managersData, error: managersErr },
          { data: driversData, error: driversErr },
          { data: constructorsData, error: constructorsErr },
        ] = await Promise.all([
          supabase.from('league_settings').select('*').eq('id', 1).single(),
          supabase.from('grand_prix').select('*').eq('status', 'drafting').maybeSingle(),
          supabase.from('managers').select('*'),
          supabase.from('drivers').select('*, constructor:constructors(id,name,short_name,color)'),
          supabase.from('constructors').select('*'),
        ])

        if (settingsErr) throw settingsErr
        if (gpErr) throw gpErr
        if (managersErr) throw managersErr
        if (driversErr) throw driversErr
        if (constructorsErr) throw constructorsErr
        if (cancelled) return

        setSettings(settingsData)
        setGp(gpData) // null if no active GP

        const managersMap = {}
        for (const m of managersData ?? []) {
          managersMap[m.id] = m
        }
        setManagers(managersMap)
        setDrivers(driversData ?? [])
        setConstructors(constructorsData ?? [])

        if (gpData) {
          const { data: picksData, error: picksErr } = await supabase
            .from('draft_picks')
            .select('*')
            .eq('gp_id', gpData.id)
            .order('pick_number', { ascending: true })
          if (picksErr) throw picksErr
          if (!cancelled) setPicks(picksData ?? [])
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Realtime subscription — append incoming picks in order
  useEffect(() => {
    if (!gp) return

    const channel = supabase
      .channel(`draft-picks-${gp.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'draft_picks',
          filter: `gp_id=eq.${gp.id}`,
        },
        (payload) => {
          setPicks((prev) => {
            if (prev.some((p) => p.id === payload.new.id)) return prev
            return [...prev, payload.new].sort((a, b) => a.pick_number - b.pick_number)
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [gp])

  const draftOrder = useMemo(() => {
    if (!settings || !gp) return []
    return getDraftOrder(
      settings.initial_draft_order,
      gp.round_number - 1,
      settings.draft_rounds
    )
  }, [settings, gp])

  const currentPickIndex = picks.length
  const currentSlot = draftOrder[currentPickIndex] ?? null
  const isMyTurn = !!(currentSlot && manager && currentSlot.managerId === manager.id)
  const isDraftComplete = draftOrder.length > 0 && picks.length >= draftOrder.length

  const pickedDriverIds = useMemo(
    () => new Set(picks.filter((p) => p.driver_id).map((p) => p.driver_id)),
    [picks]
  )
  const pickedConstructorIds = useMemo(
    () => new Set(picks.filter((p) => p.constructor_id).map((p) => p.constructor_id)),
    [picks]
  )

  const availableDrivers = useMemo(
    () => drivers.filter((d) => !pickedDriverIds.has(d.id)),
    [drivers, pickedDriverIds]
  )
  const availableConstructors = useMemo(
    () => constructors.filter((c) => !pickedConstructorIds.has(c.id)),
    [constructors, pickedConstructorIds]
  )

  const makePick = useCallback(
    async ({ driverId = null, constructorId = null }) => {
      if (!currentSlot || !gp || !manager) return { error: 'No active pick slot' }
      const { data, error } = await supabase
        .from('draft_picks')
        .insert({
          gp_id: gp.id,
          manager_id: manager.id,
          pick_number: currentSlot.pick,
          round_number: currentSlot.round,
          driver_id: driverId,
          constructor_id: constructorId,
          pick_type: currentSlot.type,
        })
        .select()
        .single()
      if (!error && data) {
        setPicks((prev) => {
          if (prev.some((p) => p.id === data.id)) return prev
          return [...prev, data].sort((a, b) => a.pick_number - b.pick_number)
        })
      }
      return { error }
    },
    [currentSlot, gp, manager]
  )

  return {
    loading,
    error,
    gp,
    managers,
    drivers,
    constructors,
    picks,
    draftOrder,
    currentPickIndex,
    currentSlot,
    isMyTurn,
    isDraftComplete,
    availableDrivers,
    availableConstructors,
    pickedDriverIds,
    pickedConstructorIds,
    makePick,
  }
}
