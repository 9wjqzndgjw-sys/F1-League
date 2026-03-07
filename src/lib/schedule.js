// 2026 F1 TV Schedule — Central Time
// broadcast: 'free' = ESPN (no subscription) | 'appletv' = Apple TV+
// Empty array = times not yet announced (shows "Broadcast times TBA")

export const TV_SCHEDULE = {
  1: [
    { name: 'FP1',        day: 'Thu, Mar 5',  time: '6:00 PM CT',   broadcast: 'free' },
    { name: 'FP2',        day: 'Thu, Mar 5',  time: '11:00 PM CT',  broadcast: 'free' },
    { name: 'FP3',        day: 'Fri, Mar 6',  time: '7:30 PM CT',   broadcast: 'free' },
    { name: 'Qualifying', day: 'Fri, Mar 6',  time: '11:00 PM CT',  broadcast: 'appletv' },
    { name: 'Race',       day: 'Sat, Mar 7',  time: '10:00 PM CT',  broadcast: 'appletv' },
  ],
  2: [],
  3: [
    { name: 'FP1',        day: 'Thu, Mar 26', time: '11:30 PM CT',  broadcast: 'free' },
    { name: 'FP2',        day: 'Fri, Mar 27', time: '3:00 AM CT',   broadcast: 'free' },
    { name: 'FP3',        day: 'Fri, Mar 27', time: '11:30 PM CT',  broadcast: 'free' },
    { name: 'Qualifying', day: 'Sat, Mar 28', time: '2:00 AM CT',   broadcast: 'appletv' },
    { name: 'Race',       day: 'Sun, Mar 29', time: '12:00 AM CT',  broadcast: 'appletv' },
  ],
  4: [
    { name: 'FP1',        day: 'Fri, Apr 10', time: '5:00 AM CT',   broadcast: 'free' },
    { name: 'FP2',        day: 'Fri, Apr 10', time: '9:00 AM CT',   broadcast: 'free' },
    { name: 'FP3',        day: 'Sat, Apr 11', time: '6:00 AM CT',   broadcast: 'free' },
    { name: 'Qualifying', day: 'Sat, Apr 11', time: '9:00 AM CT',   broadcast: 'appletv' },
    { name: 'Race',       day: 'Sun, Apr 12', time: '9:00 AM CT',   broadcast: 'appletv' },
  ],
  5: [
    { name: 'FP1',        day: 'Fri, Apr 17', time: '6:30 AM CT',   broadcast: 'free' },
    { name: 'FP2',        day: 'Fri, Apr 17', time: '10:00 AM CT',  broadcast: 'free' },
    { name: 'FP3',        day: 'Sat, Apr 18', time: '6:30 AM CT',   broadcast: 'free' },
    { name: 'Qualifying', day: 'Sat, Apr 18', time: '10:00 AM CT',  broadcast: 'appletv' },
    { name: 'Race',       day: 'Sun, Apr 19', time: '9:00 AM CT',   broadcast: 'appletv' },
  ],
}

export function getSessionSchedule(roundNumber) {
  return TV_SCHEDULE[roundNumber] ?? null
}
