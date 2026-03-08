import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { calcDriverScore, calcConstructorScores, DEFAULT_CONSTRUCTOR_SCORING } from '../lib/scoring'

export function useStandings() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rawData, setRawData] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [
          { data: gps, error: gpsErr },
          { data: managers, error: managersErr },
          { data: drivers, error: driversErr },
          { data: constructors, error: consErr },
          { data: results, error: resultsErr },
          { data: picks, error: picksErr },
          { data: settings, error: settingsErr },
        ] = await Promise.all([
          supabase.from('grand_prix').select('*').eq('status', 'scored').order('round_number'),
          supabase.from('managers').select('*'),
          supabase.from('drivers').select('*'),
          supabase.from('constructors').select('*'),
          supabase.from('race_results').select('*'),
          supabase.from('draft_picks').select('*'),
          supabase.from('league_settings').select('*').eq('id', 1).single(),
        ])

        if (gpsErr) throw gpsErr
        if (managersErr) throw managersErr
        if (driversErr) throw driversErr
        if (consErr) throw consErr
        if (resultsErr) throw resultsErr
        if (picksErr) throw picksErr
        if (settingsErr) throw settingsErr
        if (cancelled) return

        setRawData({
          gps: gps ?? [],
          managers: managers ?? [],
          drivers: drivers ?? [],
          constructors: constructors ?? [],
          results: results ?? [],
          picks: picks ?? [],
          settings,
        })
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const computed = useMemo(() => {
    if (!rawData) return { standings: [], gpScores: [] }
    const { gps, managers, drivers, constructors, results, picks, settings } = rawData

    const payoutFirst = settings?.payout_first ?? 8
    const payoutSecond = settings?.payout_second ?? 2
    const raceScoring = (settings?.scoring_race ?? []).map(Number)
    const sprintScoring = (settings?.scoring_sprint ?? []).map(Number)
    const constructorScoring = (settings?.scoring_constructor?.length ? settings.scoring_constructor : DEFAULT_CONSTRUCTOR_SCORING).map(Number)
    const dnfPenalty = settings?.dnf_penalty ?? 0

    const driversById = Object.fromEntries(drivers.map((d) => [d.id, d]))
    const constructorsById = Object.fromEntries(constructors.map((c) => [c.id, c]))

    const N = managers.length

    // Season accumulators keyed by manager id
    const season = Object.fromEntries(managers.map((m) => [m.id, { total: 0, payouts: 0, owed: 0 }]))

    const gpScores = gps.map((gp) => {
      const gpPicks = picks.filter((p) => p.gp_id === gp.id)
      const gpResults = results.filter((r) => r.gp_id === gp.id)

      // Index results by driver_id → session_type
      const resultMap = {}
      for (const r of gpResults) {
        if (!resultMap[r.driver_id]) resultMap[r.driver_id] = {}
        resultMap[r.driver_id][r.session_type] = r
      }

      // Fantasy pts for every driver (needed for constructor ranking)
      const driverFantasyPts = Object.fromEntries(
        drivers.map((d) => {
          const racePts = calcDriverScore(resultMap[d.id]?.race, 'race', raceScoring, sprintScoring, dnfPenalty)
          const sprintPts = resultMap[d.id]?.sprint
            ? calcDriverScore(resultMap[d.id].sprint, 'sprint', raceScoring, sprintScoring, dnfPenalty)
            : 0
          return [d.id, racePts + sprintPts]
        })
      )

      // Group driver pts by constructor for constructor ranking
      const byConstructor = {}
      for (const d of drivers) {
        const cid = d.constructor_id ?? d.team_id
        if (!byConstructor[cid]) byConstructor[cid] = []
        byConstructor[cid].push(driverFantasyPts[d.id])
      }

      const conScoreList = calcConstructorScores(constructors, byConstructor, constructorScoring)
      const conPtsMap = Object.fromEntries(
        conScoreList.map((cs) => [cs.constructorId, cs.constructorPoints])
      )

      // Per-manager GP scores
      const mgr = Object.fromEntries(
        managers.map((m) => [m.id, { driverPts: 0, constructorPts: 0, total: 0, payout: 0, picks: [] }])
      )

      for (const pick of gpPicks) {
        const s = mgr[pick.manager_id]
        if (!s) continue
        if (pick.driver_id) {
          const pts = driverFantasyPts[pick.driver_id] ?? 0
          s.driverPts += pts
          s.picks.push({ type: 'driver', entity: driversById[pick.driver_id], pts })
        }
        if (pick.constructor_id) {
          const pts = conPtsMap[pick.constructor_id] ?? 0
          s.constructorPts += pts
          s.picks.push({ type: 'constructor', entity: constructorsById[pick.constructor_id], pts })
        }
      }

      for (const s of Object.values(mgr)) {
        s.total = s.driverPts + s.constructorPts
      }

      // Sort managers for this GP and assign payouts
      const ranked = Object.entries(mgr).sort((a, b) => b[1].total - a[1].total)

      const topScore = ranked.length > 0 ? ranked[0][1].total : 0
      const firstPlaceMids = topScore > 0
        ? new Set(ranked.filter(([, s]) => s.total === topScore).map(([mid]) => mid))
        : new Set()
      const isTie = firstPlaceMids.size > 1
      const multiplier = isTie ? 2 : 1
      const numFirst = firstPlaceMids.size || 1
      const secondMid = ranked.find(([mid]) => !firstPlaceMids.has(mid))?.[0]

      // 1st owes nothing. 2nd pays to the 1st pool but not the 2nd pool.
      // Others pay both pools.
      const numNonFirst = N - numFirst          // pays into the 1st pool (includes 2nd)
      const numNonPodium = Math.max(0, numNonFirst - (secondMid ? 1 : 0))  // pays into 2nd pool

      const firstEach = numNonFirst > 0 ? payoutFirst * multiplier * numNonFirst / numFirst : 0
      const secondReceived = payoutSecond * multiplier * numNonPodium

      for (const [mid, s] of ranked) {
        const isFirst = firstPlaceMids.has(mid)
        const isSecond = mid === secondMid
        s.payout = isFirst ? firstEach : isSecond ? secondReceived : 0
        s.owed = isFirst ? 0 : isSecond ? payoutFirst * multiplier : (payoutFirst + payoutSecond) * multiplier
        s.net = s.payout - s.owed
        season[mid].total += s.total
        season[mid].payouts += s.payout
        season[mid].owed += s.owed
      }

      return {
        gp,
        scores: mgr,
        ranked: ranked.map(([mid]) => mid),
        isTie,
      }
    })

    const standings = managers
      .map((m) => ({ manager: m, ...season[m.id], net: season[m.id].payouts - season[m.id].owed }))
      .sort((a, b) => b.total - a.total)
      .map((s, i) => ({ ...s, rank: i + 1 }))

    return { standings, gpScores }
  }, [rawData])

  return {
    loading,
    error,
    standings: computed.standings,
    gpScores: computed.gpScores,
    managers: rawData?.managers ?? [],
    drivers: rawData?.drivers ?? [],
    constructors: rawData?.constructors ?? [],
    totalGps: 24,
  }
}
