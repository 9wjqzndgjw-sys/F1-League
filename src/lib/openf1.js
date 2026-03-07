const BASE = 'https://api.openf1.org/v1'

async function get(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`)
  if (!res.ok) throw new Error(`OpenF1 ${res.status}`)
  const data = await res.json()
  if (data?.detail) throw new Error(data.detail)
  return data
}

// Cache the full 2026 session list — only fetched once per app session
let sessionsCache = null

async function getSessions2026() {
  if (!sessionsCache) sessionsCache = get('/sessions?year=2026')
  return sessionsCache
}

// Our session_type values → OpenF1 session_name
const OPENF1_SESSION_NAME = {
  qualifying: 'Qualifying',
  sprint_qualifying: 'Sprint Qualifying',
}

/**
 * Find the OpenF1 session_key for a GP.
 * Matches the session whose date_start falls in the window [raceDate-5d, raceDate].
 * This avoids fragile name matching and handles multi-GP countries (USA, Spain).
 */
async function findSessionKey(raceDateStr, sessionType) {
  const sessions = await getSessions2026()
  const targetName = OPENF1_SESSION_NAME[sessionType]
  if (!targetName) throw new Error(`Unknown session type: ${sessionType}`)

  // Race is always a Sunday; qualifying is Saturday (1 day before),
  // sprint qualifying is Friday (2 days before). Use a 5-day window for safety.
  const raceDate = new Date(`${raceDateStr}T23:59:59Z`)
  const windowStart = new Date(`${raceDateStr}T00:00:00Z`)
  windowStart.setDate(windowStart.getDate() - 5)

  const match = sessions.find((s) => {
    if (s.session_name !== targetName) return false
    const d = new Date(s.date_start)
    return d >= windowStart && d <= raceDate
  })

  if (!match) throw new Error(`No "${targetName}" session found for this race week`)
  return match.session_key
}

/**
 * Fetch the starting grid for a GP session.
 * Returns an object keyed by driver name_acronym (e.g. "VER") → grid position (1-based).
 *
 * @param {string} raceDateStr  - "YYYY-MM-DD" race date from our DB
 * @param {string} sessionType  - "qualifying" | "sprint_qualifying"
 */
export async function fetchQualifyingGrid(raceDateStr, sessionType) {
  const sessionKey = await findSessionKey(raceDateStr, sessionType)

  const [driverRows, positionRows] = await Promise.all([
    get(`/drivers?session_key=${sessionKey}`),
    get(`/position?session_key=${sessionKey}`),
  ])

  // driver_number → name_acronym
  const numToAcronym = Object.fromEntries(
    driverRows.map((d) => [d.driver_number, d.name_acronym])
  )

  // Take the latest position entry per driver (= final qualifying order)
  const latestByDriver = {}
  for (const p of positionRows) {
    const dn = p.driver_number
    if (!latestByDriver[dn] || p.date > latestByDriver[dn].date) {
      latestByDriver[dn] = p
    }
  }

  // Build { acronym → position }
  const grid = {}
  for (const [driverNum, entry] of Object.entries(latestByDriver)) {
    const acronym = numToAcronym[driverNum]
    if (acronym && entry.position != null) {
      grid[acronym] = entry.position
    }
  }

  if (!Object.keys(grid).length) {
    throw new Error('No position data returned — session may not have data yet')
  }

  return grid
}
