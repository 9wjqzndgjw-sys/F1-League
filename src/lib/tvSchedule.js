// US TV schedule for the 2026 F1 season
// All times are approximate Central Time (CT)
//
// Broadcaster: Apple TV+ (exclusive US rights, 5-year deal)
//   • Practice sessions stream FREE — no subscription required
//   • Qualifying, Sprint, and Race require Apple TV+ ($12.99/mo or $99/yr)
//   • Select altcast races available free on Tubi
//   • Live audio free on Apple Music
//
// Sprint weekends 2026: China, Miami, Canada, Great Britain, Netherlands, Singapore
// Source: formula1.com / apple.com/newsroom

// dayOffset is relative to the race_date stored in Supabase (local race-day date)
// Network values: 'Apple TV+' (paid) | 'Free' (practice, no subscription needed)

export const TV_CIRCUITS = [
  // ── R1: Australia (AEDT = UTC+11) ────────────────────────
  // Race airs Saturday night CT. Confirmed times from official schedule.
  {
    pattern: /australia/i,
    label: 'Melbourne',
    sessions: [
      { label: 'FP1',        dayOffset: -3, time: '6:00 PM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -3, time: '11:00 PM', network: 'Free'      },
      { label: 'FP3',        dayOffset: -2, time: '7:30 PM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -2, time: '11:00 PM', network: 'Apple TV+' },
      { label: 'Race',       dayOffset: -1, time: '10:00 PM', network: 'Apple TV+' },
    ],
  },

  // ── R2: China · SPRINT (CST = UTC+8) ─────────────────────
  // Confirmed times: FP1 03:30 GMT, SQ 07:30 GMT, Sprint 03:00 GMT, Q 07:00 GMT, Race 07:00 GMT
  {
    pattern: /china|shanghai/i,
    label: 'Shanghai',
    sessions: [
      { label: 'FP1',               dayOffset: -3, time: '10:30 PM', network: 'Free'      },
      { label: 'Sprint Qualifying', dayOffset: -2, time: '2:30 AM',  network: 'Apple TV+' },
      { label: 'Sprint',            dayOffset: -2, time: '10:00 PM', network: 'Apple TV+' },
      { label: 'Qualifying',        dayOffset: -1, time: '2:00 AM',  network: 'Apple TV+' },
      { label: 'Race',              dayOffset:  0, time: '2:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R3: Japan (JST = UTC+9) ───────────────────────────────
  {
    pattern: /japan|suzuka/i,
    label: 'Suzuka',
    sessions: [
      { label: 'FP1',        dayOffset: -3, time: '11:30 PM', network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '3:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -2, time: '11:30 PM', network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '2:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '12:00 AM', network: 'Apple TV+' },
    ],
  },

  // ── R4: Bahrain (AST = UTC+3) ─────────────────────────────
  {
    pattern: /bahrain|sakhir/i,
    label: 'Sakhir',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '5:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '9:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '5:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '10:00 AM', network: 'Apple TV+' },
    ],
  },

  // ── R5: Saudi Arabia · night race (AST = UTC+3) ───────────
  {
    pattern: /saudi|jeddah/i,
    label: 'Jeddah',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '7:30 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '11:30 AM', network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '7:30 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '11:00 AM', network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '12:00 PM', network: 'Apple TV+' },
    ],
  },

  // ── R6: Miami · SPRINT (EDT = UTC−4) ─────────────────────
  {
    pattern: /miami/i,
    label: 'Miami',
    sessions: [
      { label: 'FP1',               dayOffset: -2, time: '12:00 PM', network: 'Free'      },
      { label: 'Sprint Qualifying', dayOffset: -2, time: '4:00 PM',  network: 'Apple TV+' },
      { label: 'Sprint',            dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Qualifying',        dayOffset: -1, time: '1:00 PM',  network: 'Apple TV+' },
      { label: 'Race',              dayOffset:  0, time: '1:30 PM',  network: 'Apple TV+' },
    ],
  },

  // ── R7: Canada · SPRINT (EDT = UTC−4) ────────────────────
  {
    pattern: /canada|montreal/i,
    label: 'Montréal',
    sessions: [
      { label: 'FP1',               dayOffset: -2, time: '12:00 PM', network: 'Free'      },
      { label: 'Sprint Qualifying', dayOffset: -2, time: '4:00 PM',  network: 'Apple TV+' },
      { label: 'Sprint',            dayOffset: -1, time: '10:00 AM', network: 'Apple TV+' },
      { label: 'Qualifying',        dayOffset: -1, time: '2:00 PM',  network: 'Apple TV+' },
      { label: 'Race',              dayOffset:  0, time: '1:00 PM',  network: 'Apple TV+' },
    ],
  },

  // ── R8: Monaco (CEST = UTC+2) ─────────────────────────────
  {
    pattern: /monaco/i,
    label: 'Monaco',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '5:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '9:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '5:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '8:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R9: Spain/Barcelona (CEST = UTC+2) ───────────────────
  {
    pattern: /spain|barcelona|catalunya/i,
    label: 'Barcelona',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '5:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '9:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '5:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '8:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R10: Austria (CEST = UTC+2) ──────────────────────────
  {
    pattern: /austria|spielberg|styrian/i,
    label: 'Spielberg',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '5:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '9:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '5:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '9:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R11: Great Britain · SPRINT (BST = UTC+1) ────────────
  {
    pattern: /britain|silverstone|british/i,
    label: 'Silverstone',
    sessions: [
      { label: 'FP1',               dayOffset: -2, time: '7:00 AM',  network: 'Free'      },
      { label: 'Sprint Qualifying', dayOffset: -2, time: '11:00 AM', network: 'Apple TV+' },
      { label: 'Sprint',            dayOffset: -1, time: '5:00 AM',  network: 'Apple TV+' },
      { label: 'Qualifying',        dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Race',              dayOffset:  0, time: '9:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R12: Belgium/Spa (CEST = UTC+2) ──────────────────────
  {
    pattern: /belgium|spa|belgian/i,
    label: 'Spa',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '5:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '9:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '5:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '9:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R13: Hungary (CEST = UTC+2) ──────────────────────────
  {
    pattern: /hungary|budapest/i,
    label: 'Budapest',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '5:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '9:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '5:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '9:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R14: Netherlands · SPRINT (CEST = UTC+2) ─────────────
  {
    pattern: /netherlands|zandvoort|dutch/i,
    label: 'Zandvoort',
    sessions: [
      { label: 'FP1',               dayOffset: -2, time: '5:00 AM',  network: 'Free'      },
      { label: 'Sprint Qualifying', dayOffset: -2, time: '9:30 AM',  network: 'Apple TV+' },
      { label: 'Sprint',            dayOffset: -1, time: '3:30 AM',  network: 'Apple TV+' },
      { label: 'Qualifying',        dayOffset: -1, time: '8:30 AM',  network: 'Apple TV+' },
      { label: 'Race',              dayOffset:  0, time: '8:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R15: Italy/Monza (CEST = UTC+2) ──────────────────────
  {
    pattern: /italy|monza|italian/i,
    label: 'Monza',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '5:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '9:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '5:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '9:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R16: Madrid — debut (CEST = UTC+2) ───────────────────
  {
    pattern: /madrid/i,
    label: 'Madrid',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '5:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '9:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '5:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '9:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R17: Azerbaijan/Baku (AZT = UTC+4) ───────────────────
  {
    pattern: /azerbaijan|baku/i,
    label: 'Baku',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '4:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '8:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '3:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '7:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '7:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R18: Singapore · SPRINT · night race (SGT = UTC+8) ───
  {
    pattern: /singapore/i,
    label: 'Singapore',
    sessions: [
      { label: 'FP1',               dayOffset: -2, time: '5:00 AM',  network: 'Free'      },
      { label: 'Sprint Qualifying', dayOffset: -2, time: '8:30 AM',  network: 'Apple TV+' },
      { label: 'Sprint',            dayOffset: -1, time: '6:00 AM',  network: 'Apple TV+' },
      { label: 'Qualifying',        dayOffset: -1, time: '9:00 AM',  network: 'Apple TV+' },
      { label: 'Race',              dayOffset:  0, time: '7:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R19: USA/Austin (CDT = UTC−5) ────────────────────────
  {
    pattern: /united states|usa|austin|cota/i,
    label: 'Austin',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '12:00 PM', network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '4:00 PM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '12:00 PM', network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '4:00 PM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '2:00 PM',  network: 'Apple TV+' },
    ],
  },

  // ── R20: Mexico City (CST = UTC−6) ───────────────────────
  {
    pattern: /mexico/i,
    label: 'Mexico City',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '12:00 PM', network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '4:00 PM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '12:00 PM', network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '3:00 PM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '1:00 PM',  network: 'Apple TV+' },
    ],
  },

  // ── R21: Brazil/São Paulo (BRT = UTC−3) ──────────────────
  {
    pattern: /brazil|paulo|interlagos/i,
    label: 'São Paulo',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '9:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '1:00 PM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '9:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '1:00 PM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '12:00 PM', network: 'Apple TV+' },
    ],
  },

  // ── R22: Las Vegas · night race (PST = UTC−8) ────────────
  // FP3, Q, and Race all take place on Saturday local time
  {
    pattern: /las vegas/i,
    label: 'Las Vegas',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '10:00 PM', network: 'Free'      },
      { label: 'FP2',        dayOffset: -1, time: '2:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '5:00 PM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '9:00 PM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset: -1, time: '11:00 PM', network: 'Apple TV+' },
    ],
  },

  // ── R23: Qatar/Lusail (AST = UTC+3) ──────────────────────
  {
    pattern: /qatar|lusail/i,
    label: 'Lusail',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '3:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '7:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '3:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '7:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '7:00 AM',  network: 'Apple TV+' },
    ],
  },

  // ── R24: Abu Dhabi/Yas Marina (GST = UTC+4) ──────────────
  {
    pattern: /abu dhabi|yas/i,
    label: 'Yas Marina',
    sessions: [
      { label: 'FP1',        dayOffset: -2, time: '2:00 AM',  network: 'Free'      },
      { label: 'FP2',        dayOffset: -2, time: '6:00 AM',  network: 'Free'      },
      { label: 'FP3',        dayOffset: -1, time: '2:00 AM',  network: 'Free'      },
      { label: 'Qualifying', dayOffset: -1, time: '6:00 AM',  network: 'Apple TV+' },
      { label: 'Race',       dayOffset:  0, time: '7:00 AM',  network: 'Apple TV+' },
    ],
  },
]

export function getTvData(gpName) {
  if (!gpName) return null
  return TV_CIRCUITS.find((c) => c.pattern.test(gpName)) ?? null
}

// Network badge colors
export const NETWORK_COLOR = {
  'Apple TV+': '#1a1a1a',
  'Free':      '#1a7f37',
}
