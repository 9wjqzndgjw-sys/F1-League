import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Scoring helpers (mirrors src/lib/scoring.js) ──────────────────────────

function driverScore(result: any, sessionType: string, raceScoring: number[], sprintScoring: number[], dnfPenalty: number): number {
  if (!result) return 0
  if (result.is_dnf) return dnfPenalty
  if (result.is_dns || result.is_dsq) return 0
  const scoring = sessionType === 'sprint' ? sprintScoring : raceScoring
  const idx = result.position - 1
  return idx >= 0 && idx < scoring.length ? scoring[idx] : 0
}

function constructorScores(constructors: any[], byConstructor: Record<string, number[]>, conScoring: number[]) {
  const totals = constructors.map(c => ({
    id: c.id,
    name: c.short_name ?? c.name,
    total: (byConstructor[c.id] ?? []).reduce((s, p) => s + p, 0),
  }))
  totals.sort((a, b) => b.total - a.total)
  return totals.map((item, idx) => ({ ...item, pts: conScoring[idx] ?? 0, rank: idx + 1 }))
}

function posLabel(r: any): string {
  if (r.is_dsq) return 'DSQ'
  if (r.is_dns) return 'DNS'
  if (r.is_dnf) return 'DNF'
  return `P${r.position}`
}

// ── Compute scores for one GP ─────────────────────────────────────────────

function computeGpScores(
  gp: any,
  gpResults: any[],
  gpPicks: any[],
  managers: any[],
  drivers: any[],
  constructors: any[],
  settings: any,
) {
  const raceScoring   = (settings?.scoring_race        ?? [25,18,15,12,10,8,6,4,2,1]).map(Number)
  const sprintScoring = (settings?.scoring_sprint      ?? [8,7,6,5,4,3,2,1]).map(Number)
  const conScoring    = (settings?.scoring_constructor ?? [10,9,8,7,6,5,4,3,2,1]).map(Number)
  const dnfPenalty    = settings?.dnf_penalty  ?? 0
  const payoutFirst   = settings?.payout_first  ?? 8
  const payoutSecond  = settings?.payout_second ?? 2

  const resultMap: Record<string, Record<string, any>> = {}
  for (const r of gpResults) {
    if (!resultMap[r.driver_id]) resultMap[r.driver_id] = {}
    resultMap[r.driver_id][r.session_type] = r
  }

  const driverFantasyPts: Record<string, number> = {}
  for (const d of drivers) {
    const rPts = driverScore(resultMap[d.id]?.race, 'race', raceScoring, sprintScoring, dnfPenalty)
    const sPts = resultMap[d.id]?.sprint ? driverScore(resultMap[d.id].sprint, 'sprint', raceScoring, sprintScoring, dnfPenalty) : 0
    driverFantasyPts[d.id] = rPts + sPts
  }

  const byConstructor: Record<string, number[]> = {}
  for (const d of drivers) {
    const cid = d.constructor_id ?? d.team_id
    if (!byConstructor[cid]) byConstructor[cid] = []
    byConstructor[cid].push(driverFantasyPts[d.id])
  }
  const conScoreList = constructorScores(constructors, byConstructor, conScoring)
  const conPtsMap: Record<string, number> = Object.fromEntries(conScoreList.map(cs => [cs.id, cs.pts]))

  const mgrById: Record<string, any> = {}
  for (const m of managers) {
    mgrById[m.id] = { manager: m, total: 0, picks: [] }
  }
  for (const pick of gpPicks) {
    const s = mgrById[pick.manager_id]
    if (!s) continue
    if (pick.driver_id) {
      const d = drivers.find((x: any) => x.id === pick.driver_id)
      const pts = driverFantasyPts[pick.driver_id] ?? 0
      s.picks.push({ type: 'driver', code: d?.code ?? '?', name: d?.name ?? '?', team: d?.constructor?.short_name ?? d?.team ?? '?', pts })
      s.total += pts
    }
    if (pick.constructor_id) {
      const c = constructors.find((x: any) => x.id === pick.constructor_id)
      const pts = conPtsMap[pick.constructor_id] ?? 0
      s.picks.push({ type: 'constructor', name: c?.short_name ?? c?.name ?? '?', pts })
      s.total += pts
    }
  }

  const ranked = Object.values(mgrById).sort((a: any, b: any) => {
    if (b.total !== a.total) return b.total - a.total
    const na = a.manager.display_name ?? a.manager.name ?? ''
    const nb = b.manager.display_name ?? b.manager.name ?? ''
    return na.localeCompare(nb)
  })

  const N = managers.length
  const topScore = ranked.length > 0 ? (ranked[0] as any).total : 0
  const firstIds = topScore > 0 ? new Set(ranked.filter((s: any) => s.total === topScore).map((s: any) => s.manager.id)) : new Set()
  const isTie = firstIds.size > 1
  const multiplier = isTie ? 2 : 1
  const numFirst = firstIds.size || 1
  const secondMid = ranked.find((s: any) => !firstIds.has(s.manager.id)) as any
  const numNonFirst = N - numFirst
  const numNonPodium = Math.max(0, numNonFirst - (secondMid ? 1 : 0))
  const firstEach = numNonFirst > 0 ? payoutFirst * multiplier * numNonFirst / numFirst : 0
  const secondReceived = payoutSecond * multiplier * numNonPodium

  for (const [i, s] of ranked.entries()) {
    const mid = (s as any).manager.id
    const isFirst = firstIds.has(mid)
    const isSecond = secondMid && mid === secondMid.manager.id
    ;(s as any).rank = i + 1
    ;(s as any).payout = isFirst ? firstEach : isSecond ? secondReceived : 0
    ;(s as any).owed   = isFirst ? 0 : isSecond ? payoutFirst * multiplier : (payoutFirst + payoutSecond) * multiplier
    ;(s as any).net    = (s as any).payout - (s as any).owed
  }

  return ranked
}

// ── Build prompt ──────────────────────────────────────────────────────────

function buildPrompt(
  targetGp: any,
  allGps: any[],
  gpResults: any[],
  allPicks: any[],
  managers: any[],
  drivers: any[],
  constructors: any[],
  settings: any,
): string {
  const totalRounds = 24
  const round = targetGp.round_number
  const phase = round <= 8 ? 'early season' : round <= 16 ? 'mid-season' : 'late season'

  const raceScoring   = (settings?.scoring_race        ?? [25,18,15,12,10,8,6,4,2,1]).map(Number)
  const sprintScoring = (settings?.scoring_sprint      ?? [8,7,6,5,4,3,2,1]).map(Number)
  const conScoring    = (settings?.scoring_constructor ?? [10,9,8,7,6,5,4,3,2,1]).map(Number)
  const dnfPenalty    = settings?.dnf_penalty  ?? 0
  const payoutFirst   = settings?.payout_first  ?? 8
  const payoutSecond  = settings?.payout_second ?? 2

  // ── Race results this GP ──────────────────────────────────────────────
  const targetResults = gpResults.filter(r => r.gp_id === targetGp.id)
  const raceRows = [...targetResults.filter(r => r.session_type === 'race')]
    .sort((a, b) => {
      const rank = (r: any) => (r.is_dns || r.is_dsq ? 999 : r.is_dnf ? 998 : r.position)
      return rank(a) - rank(b)
    })
    .map(r => {
      const d = drivers.find(x => x.id === r.driver_id)
      const pts = driverScore(r, 'race', raceScoring, sprintScoring, dnfPenalty)
      return `  ${posLabel(r).padEnd(4)} ${(d?.code ?? '?').padEnd(4)} ${(d?.constructor?.short_name ?? d?.team ?? '?').padEnd(12)} ${pts > 0 ? '+' + pts : pts} fantasy pts`
    }).join('\n')

  const sprintRows = [...targetResults.filter(r => r.session_type === 'sprint')]
    .sort((a, b) => {
      const rank = (r: any) => (r.is_dns || r.is_dsq ? 999 : r.is_dnf ? 998 : r.position)
      return rank(a) - rank(b)
    })
    .map(r => {
      const d = drivers.find(x => x.id === r.driver_id)
      const pts = driverScore(r, 'sprint', raceScoring, sprintScoring, dnfPenalty)
      return `  ${posLabel(r).padEnd(4)} ${(d?.code ?? '?').padEnd(4)} ${(d?.constructor?.short_name ?? d?.team ?? '?').padEnd(12)} ${pts > 0 ? '+' + pts : pts} fantasy pts`
    }).join('\n')

  const hasSprint = sprintRows.length > 0

  // ── Manager scores this GP ────────────────────────────────────────────
  const targetPicks = allPicks.filter(p => p.gp_id === targetGp.id)
  const gpScores = computeGpScores(targetGp, targetResults, targetPicks, managers, drivers, constructors, settings)

  const scoresText = (gpScores as any[]).map(s => {
    const picksText = s.picks.map((p: any) =>
      `    - ${p.type === 'constructor' ? 'CON' : 'DRV'} ${p.type === 'driver' ? p.code + ' ' : ''}${p.name}: ${p.pts > 0 ? '+' + p.pts : p.pts} pts`
    ).join('\n')
    const netStr = s.net >= 0 ? `+$${s.net.toFixed(2)}` : `-$${Math.abs(s.net).toFixed(2)}`
    return `  #${s.rank} ${s.manager.display_name ?? s.manager.name} — ${s.total} pts (${netStr})\n${picksText}`
  }).join('\n\n')

  // ── Season standings (cumulative across all scored GPs incl. this one) ──
  const seasonTotals: Record<string, { total: number, payouts: number, owed: number }> =
    Object.fromEntries(managers.map(m => [m.id, { total: 0, payouts: 0, owed: 0 }]))

  const scoredGps = allGps.filter(g => g.status === 'scored').sort((a, b) => a.round_number - b.round_number)

  for (const gp of scoredGps) {
    const gResults = gpResults.filter(r => r.gp_id === gp.id)
    const gPicks   = allPicks.filter(p => p.gp_id === gp.id)
    const scores   = computeGpScores(gp, gResults, gPicks, managers, drivers, constructors, settings)
    for (const s of scores as any[]) {
      seasonTotals[s.manager.id].total   += s.total
      seasonTotals[s.manager.id].payouts += s.payout
      seasonTotals[s.manager.id].owed    += s.owed
    }
  }

  const seasonStandings = managers
    .map(m => ({ manager: m, ...seasonTotals[m.id], net: seasonTotals[m.id].payouts - seasonTotals[m.id].owed }))
    .sort((a, b) => b.total - a.total)
    .map((s, i) => {
      const netStr = s.net >= 0 ? `+$${s.net.toFixed(2)}` : `-$${Math.abs(s.net).toFixed(2)}`
      return `  #${i + 1} ${s.manager.display_name ?? s.manager.name} — ${s.total} pts total, ${netStr} net`
    }).join('\n')

  // ── Manager draft history (prior GPs only) ────────────────────────────
  const priorGps = scoredGps.filter(g => g.id !== targetGp.id)

  const historyText = managers.map(m => {
    const mgrName = m.display_name ?? m.name
    if (!priorGps.length) return `  ${mgrName}: no prior rounds`

    const rounds = priorGps.map(gp => {
      const gPicks   = allPicks.filter(p => p.gp_id === gp.id && p.manager_id === m.id)
      const gResults = gpResults.filter(r => r.gp_id === gp.id)
      const scores   = computeGpScores(gp, gResults, allPicks.filter(p => p.gp_id === gp.id), managers, drivers, constructors, settings)
      const mScore   = (scores as any[]).find(s => s.manager.id === m.id)
      const picksSummary = (mScore?.picks ?? []).map((p: any) =>
        `${p.type === 'constructor' ? 'CON:' : ''}${p.code ?? p.name}(${p.pts})`
      ).join(', ')
      return `    R${gp.round_number} ${gp.name}: ${mScore?.total ?? 0} pts [${picksSummary}]`
    }).join('\n')

    return `  ${mgrName}:\n${rounds}`
  }).join('\n\n')

  return `You are writing a weekly recap for a private F1 fantasy league. Be specific, engaging, and casual — like a knowledgeable friend who watched every session. Reference real names and specific picks. Keep it to about 300 words.

LEAGUE SETUP:
- ${managers.length} managers, snake draft format, ${settings?.draft_rounds ?? 3} picks per GP
- Race scoring: ${raceScoring.slice(0, 10).join(', ')} (top 10)
- Sprint scoring: ${sprintScoring.join(', ')}
- Constructor scoring: ${conScoring.join(', ')}
- Payout: 1st place earns $${payoutFirst} from each non-1st; 2nd earns $${payoutSecond} from each 3rd+
- DNF penalty: ${dnfPenalty} pts

SEASON CONTEXT:
- Round ${round} of ${totalRounds} (${phase})

THIS WEEK — ${targetGp.name}${hasSprint ? ' (SPRINT WEEKEND)' : ''}:

Race Results:
${raceRows || '  (no results)'}
${hasSprint ? `\nSprint Results:\n${sprintRows}` : ''}

Manager Scores This Week (picks → pts → net money):
${scoresText}

Season Standings After Round ${round}:
${seasonStandings}

Manager Draft History (all prior rounds, for style analysis):
${historyText || '  (first round — no history yet)'}

Write the recap now. Include: race narrative, who won the week, any notable picks that paid off or bombed, any DNF/surprise that changed the outcome, standings impact. If there's a pattern emerging in how a manager drafts (constructor-heavy, value picks, top-team loyalist, etc.), call it out. Reference season context where relevant.`
}

// ── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) throw new Error('Unauthorized')

    const { data: mgr } = await supabaseAdmin
      .from('managers').select('is_commissioner').eq('id', user.id).single()
    if (!mgr?.is_commissioner) throw new Error('Commissioner access required')

    // Parse request
    const { gp_id } = await req.json()
    if (!gp_id) throw new Error('Missing gp_id')

    // Fetch all data in parallel
    const [
      { data: allGps },
      { data: managers },
      { data: drivers },
      { data: constructors },
      { data: allResults },
      { data: allPicks },
      { data: settings },
      { data: targetGp },
    ] = await Promise.all([
      supabaseAdmin.from('grand_prix').select('*').order('round_number'),
      supabaseAdmin.from('managers').select('*'),
      supabaseAdmin.from('drivers').select('*, constructor:constructors(id,name,short_name,color)'),
      supabaseAdmin.from('constructors').select('*'),
      supabaseAdmin.from('race_results').select('*'),
      supabaseAdmin.from('draft_picks').select('*'),
      supabaseAdmin.from('league_settings').select('*').eq('id', 1).single(),
      supabaseAdmin.from('grand_prix').select('*').eq('id', gp_id).single(),
    ])

    if (!targetGp) throw new Error('GP not found')

    // Build the prompt
    const prompt = buildPrompt(
      targetGp, allGps ?? [], allResults ?? [], allPicks ?? [],
      managers ?? [], drivers ?? [], constructors ?? [], settings
    )

    // Call Claude API
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1500,
        thinking: { type: 'adaptive' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      throw new Error(`Claude API error ${anthropicRes.status}: ${errBody}`)
    }

    const claudeData = await anthropicRes.json()
    const recap = (claudeData.content as any[])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    // Save to database
    await supabaseAdmin.from('grand_prix').update({ recap }).eq('id', gp_id)

    return new Response(JSON.stringify({ recap }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
