# WatchTowerX Frontend — Phase 2

React dashboard for the WatchTowerX uptime monitor.

## Stack
| | |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Data fetching | Axios + custom hooks |
| Charts | Recharts |
| Styling | Pure CSS variables (no framework) |
| Fonts | Space Mono + DM Sans |

## Features
- Login / Register with JWT auth
- Dashboard with summary cards (total, up, down, avg uptime %)
- Response time area chart (last 50 checks)
- Recent incidents list
- Monitor cards with uptime sparkbar + stats
- Add / Edit / Delete / Pause monitors
- Incidents table with full history
- Auto-refresh every 30s with countdown bar

## Project Structure

```
src/
├── components/
│   ├── ui/
│   │   ├── index.jsx        # Card, Button, Input, StatusBadge, UptimeBar, Spinner
│   │   └── Sidebar.jsx      # Nav sidebar
│   ├── dashboard/
│   │   ├── SummaryCards.jsx
│   │   ├── ResponseTimeChart.jsx
│   │   └── IncidentsList.jsx
│   └── monitors/
│       ├── MonitorCard.jsx
│       └── MonitorModal.jsx
├── hooks/
│   └── useAutoRefresh.js    # 30s auto-refresh with countdown
├── lib/
│   ├── api.js               # Axios client + all API calls
│   └── auth.jsx             # Auth context (JWT)
├── pages/
│   ├── AuthPage.jsx         # Login + Register
│   ├── DashboardPage.jsx    # Main overview
│   ├── MonitorsPage.jsx     # Manage monitors
│   └── IncidentsPage.jsx    # All down events
├── App.jsx                  # Routes + layout
├── main.jsx                 # Entry point
└── index.css                # Global theme (CSS variables)
```

## Quick Start

```bash
# Make sure the Phase 1 backend is running on port 8000 first

npm install
npm run dev
# → App live at http://localhost:5173
```

## Design
- Dark neon theme (`#080b14` background)
- Space Mono for numbers/mono, DM Sans for body
- Green `#00f5a0` for healthy, red `#ff4d6a` for down
- Subtle grid background on auth page
- Animated status dot pulses, fade-up entrance animations
- 30s auto-refresh with live countdown bar
