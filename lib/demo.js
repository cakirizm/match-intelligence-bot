export const demoFixtures = [
  {
    id: 900001,
    name: 'Arsenal vs Everton',
    starting_at: '2026-09-16 18:45:00',
    has_odds: true,
    league: { name: 'Premier League' },
    participants: [
      { id: 1, name: 'Arsenal', image_path: null, meta: { location: 'home' } },
      { id: 2, name: 'Everton', image_path: null, meta: { location: 'away' } }
    ],
    odds: [
      { market_id: 1, bookmaker_id: 10, label: 'Home', name: 'Home', value: '1.62' },
      { market_id: 1, bookmaker_id: 10, label: 'Draw', name: 'Draw', value: '4.20' },
      { market_id: 1, bookmaker_id: 10, label: 'Away', name: 'Away', value: '5.80' },
      { market_id: 14, bookmaker_id: 10, label: 'Over 2.5', name: 'Over 2.5', value: '1.74' },
      { market_id: 14, bookmaker_id: 10, label: 'Under 2.5', name: 'Under 2.5', value: '2.02' }
    ],
    predictions: [
      { type_id: 1, prediction: { home: 68, draw: 20, away: 12 } }
    ]
  },
  {
    id: 900002,
    name: 'Inter vs Bologna',
    starting_at: '2026-09-16 19:00:00',
    has_odds: true,
    league: { name: 'Serie A' },
    participants: [
      { id: 3, name: 'Inter', meta: { location: 'home' } },
      { id: 4, name: 'Bologna', meta: { location: 'away' } }
    ],
    odds: [
      { market_id: 1, bookmaker_id: 10, label: 'Home', value: '1.75' },
      { market_id: 1, bookmaker_id: 10, label: 'Draw', value: '3.70' },
      { market_id: 1, bookmaker_id: 10, label: 'Away', value: '4.90' }
    ],
    predictions: [
      { type_id: 1, prediction: { home: 61, draw: 23, away: 16 } }
    ]
  },
  {
    id: 900003,
    name: 'Trabzonspor vs Kasımpaşa',
    starting_at: '2026-09-16 17:00:00',
    has_odds: true,
    league: { name: 'Süper Lig' },
    participants: [
      { id: 5, name: 'Trabzonspor', meta: { location: 'home' } },
      { id: 6, name: 'Kasımpaşa', meta: { location: 'away' } }
    ],
    odds: [
      { market_id: 1, bookmaker_id: 10, label: 'Home', value: '1.93' },
      { market_id: 1, bookmaker_id: 10, label: 'Draw', value: '3.55' },
      { market_id: 1, bookmaker_id: 10, label: 'Away', value: '3.65' }
    ],
    predictions: [
      { type_id: 1, prediction: { home: 50, draw: 27, away: 23 } }
    ]
  }
];
