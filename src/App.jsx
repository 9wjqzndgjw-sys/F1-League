import { useState } from 'react'
import { useAuth } from './hooks/useAuth.jsx'
import Login from './views/Login'
import Standings from './views/Standings'
import Draft from './views/Draft'
import Results from './views/Results'
import Calendar from './views/Calendar'
import Settings from './views/Settings'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import './App.css'

const VIEWS = {
  standings: Standings,
  draft: Draft,
  results: Results,
  calendar: Calendar,
  settings: Settings,
}

export default function App() {
  const { session, manager, loading } = useAuth()
  const [view, setView] = useState('standings')

  if (loading || (session && !manager)) return (
    <div className="splash">
      <div className="splash-badge">F1</div>
      <span className="splash-title">Fantasy 2026</span>
      <div className="splash-spinner" />
    </div>
  )
  if (!session || !manager) return <Login />

  const View = VIEWS[view]

  return (
    <div className="app-shell">
      <Header view={view} />
      <main className="app-main">
        <View />
      </main>
      <BottomNav view={view} onNavigate={setView} />
    </div>
  )
}
