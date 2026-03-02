import { useAuth } from '../hooks/useAuth.jsx'

const VIEW_TITLES = {
  standings: 'Standings',
  draft: 'Draft',
  results: 'Results',
  calendar: 'Calendar',
  settings: 'Settings',
}

export default function Header({ view }) {
  const { signOut } = useAuth()

  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="brand-badge">F1</span>
        <span className="header-title">{VIEW_TITLES[view] ?? 'Fantasy 2026'}</span>
      </div>
      <button className="signout-btn" onClick={signOut}>Sign out</button>
    </header>
  )
}
