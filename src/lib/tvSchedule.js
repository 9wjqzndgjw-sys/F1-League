// US TV schedule for the 2026 F1 season
// All times are approximate Central Time (CT)
// Networks: ESPN, ESPN2, ESPN+ (streaming), ABC
// Note: Live timing at f1.com; networks subject to change

function normal(fp1, fp2, fp3, q, race, qNet = 'ESPN2', raceNet = 'ESPN') {
  return [
    { label: 'FP1',        dayOffset: -2, time: fp1,  network: 'ESPN+' },
    { label: 'FP2',        dayOffset: -2, time: fp2,  network: 'ESPN+' },
    { label: 'FP3',        dayOffset: -1, time: fp3,  network: 'ESPN+' },
    { label: 'Qualifying', dayOffset: -1, time: q,    network: qNet    },
    { label: 'Race',       dayOffset:  0, time: race, network: raceNet },
  ]
}

function sprint(fp1, sq, spr, q, race, raceNet = 'ESPN2') {
  return [
    { label: 'FP1',               dayOffset: -2, time: fp1, network: 'ESPN+' },
    { label: 'Sprint Qualifying', dayOffset: -2, time: sq,  network: 'ESPN2' },
    { label: 'Sprint',            dayOffset: -1, time: spr, network: 'ESPN2' },
    { label: 'Qualifying',        dayOffset: -1, time: q,   network: 'ESPN2' },
    { label: 'Race',              dayOffset:  0, time: race, network: raceNet },
  ]
}

// ── Region presets ────────────────────────────────────────────────────────────
// European circuits (CEST = UTC+2, race Sun ~3pm local = ~9am CT)
const EU   = (isSprint, net = 'ESPN') => isSprint
  ? sprint('7:30 AM', '11:30 AM', '7:00 AM', '11:00 AM', '9:00 AM', net)
  : normal('7:30 AM', '11:00 AM', '6:30 AM', '10:00 AM', '9:00 AM', 'ESPN2', net)

// Middle East (UTC+3, race Sun ~5pm local = ~11am CT)
const ME   = (isSprint, net = 'ESPN') => isSprint
  ? sprint('10:00 AM', '2:00 PM', '10:00 AM', '2:00 PM', '11:00 AM', net)
  : normal('9:30 AM',  '1:00 PM', '9:30 AM',  '1:30 PM', '11:00 AM', 'ESPN2', net)

// East Asia (UTC+8/+9, race Sun ~2pm local ≈ 1–2am CT Sat night)
const EA   = (isSprint, net = 'ESPN2') => isSprint
  ? sprint('12:30 AM', '4:30 AM', '12:30 AM', '4:00 AM', '1:00 AM', net)
  : normal('12:30 AM', '4:00 AM', '12:30 AM', '4:00 AM', '1:00 AM', 'ESPN2', net)

// Australia (AEDT = UTC+11, race Sun ~3pm local ≈ midnight Sat CT)
const AUS  = () => normal('1:30 AM', '5:00 AM', '1:30 AM', '5:00 AM', '12:00 AM', 'ESPN2', 'ESPN2')

// North America / Americas (race ~2pm local)
const NA   = (isSprint, net = 'ESPN') => isSprint
  ? sprint('12:30 PM', '4:30 PM', '12:00 PM', '3:00 PM', '2:00 PM', net)
  : normal('12:30 PM', '4:00 PM', '12:00 PM', '3:00 PM', '2:00 PM', 'ESPN2', net)

// Azerbaijan (UTC+4)
const AZE  = () => normal('6:30 AM', '10:00 AM', '7:00 AM', '11:00 AM', '7:00 AM', 'ESPN2', 'ESPN2')

// Singapore (UTC+8, night race Sun ~8pm local ≈ 8am CT)
const SGP  = () => normal('5:30 AM', '9:00 AM', '6:00 AM', '10:00 AM', '8:00 AM', 'ESPN2', 'ESPN2')

// Brazil (UTC-3, sprint weekend)
const BRA  = () => sprint('9:30 AM', '1:30 PM', '9:30 AM', '1:30 PM', '11:00 AM', 'ESPN')

// Las Vegas (UTC-8, race Sat night ~10pm local)
const LAS  = () => [
  { label: 'FP1',        dayOffset: -3, time: '8:00 PM',  network: 'ESPN+' },
  { label: 'FP2',        dayOffset: -2, time: '12:00 AM', network: 'ESPN+' },
  { label: 'FP3',        dayOffset: -1, time: '8:00 PM',  network: 'ESPN+' },
  { label: 'Qualifying', dayOffset: -1, time: '11:00 PM', network: 'ESPN2' },
  { label: 'Race',       dayOffset:  0, time: '9:00 PM',  network: 'ESPN'  },
]

// ── Circuit lookup ────────────────────────────────────────────────────────────
// Matched against the `name` field from the grand_prix Supabase table
export const TV_CIRCUITS = [
  { pattern: /australia/i,                   label: 'Melbourne',    sessions: AUS()              },
  { pattern: /china|shanghai/i,              label: 'Shanghai',     sessions: EA(true)            },
  { pattern: /japan|suzuka/i,                label: 'Suzuka',       sessions: EA(false)           },
  { pattern: /bahrain|sakhir/i,              label: 'Sakhir',       sessions: ME(false)           },
  { pattern: /saudi|jeddah/i,                label: 'Jeddah',       sessions: ME(false)           },
  { pattern: /miami/i,                       label: 'Miami',        sessions: NA(true,  'ABC')    },
  { pattern: /emilia|imola/i,                label: 'Imola',        sessions: EU(false)           },
  { pattern: /monaco/i,                      label: 'Monaco',       sessions: EU(false)           },
  { pattern: /spain|barcelona|catalunya/i,   label: 'Barcelona',    sessions: EU(false)           },
  { pattern: /canada|montreal/i,             label: 'Montréal',     sessions: NA(false)           },
  { pattern: /austria|spielberg|styrian/i,   label: 'Spielberg',    sessions: EU(false)           },
  { pattern: /britain|silverstone|british/i, label: 'Silverstone',  sessions: EU(false)           },
  { pattern: /belgium|spa|belgian/i,         label: 'Spa',          sessions: EU(true)            },
  { pattern: /hungary|budapest/i,            label: 'Budapest',     sessions: EU(false)           },
  { pattern: /netherlands|zandvoort|dutch/i, label: 'Zandvoort',    sessions: EU(false)           },
  { pattern: /italy|monza|italian/i,         label: 'Monza',        sessions: EU(false)           },
  { pattern: /azerbaijan|baku/i,             label: 'Baku',         sessions: AZE()               },
  { pattern: /singapore/i,                   label: 'Singapore',    sessions: SGP()               },
  { pattern: /united states|usa|austin|cota/i, label: 'Austin',     sessions: NA(true,  'ABC')    },
  { pattern: /mexico/i,                      label: 'Mexico City',  sessions: NA(false)           },
  { pattern: /brazil|paulo|interlagos/i,     label: 'São Paulo',    sessions: BRA()               },
  { pattern: /las vegas/i,                   label: 'Las Vegas',    sessions: LAS()               },
  { pattern: /qatar|lusail/i,                label: 'Lusail',       sessions: ME(true)            },
  { pattern: /abu dhabi|yas/i,               label: 'Yas Marina',   sessions: ME(false)           },
]

export function getTvData(gpName) {
  if (!gpName) return null
  return TV_CIRCUITS.find((c) => c.pattern.test(gpName)) ?? null
}

// Network badge color tokens
export const NETWORK_COLOR = {
  'ESPN':  '#e10600',
  'ESPN2': '#c8420a',
  'ESPN+': '#1a6ff4',
  'ABC':   '#00529b',
}
