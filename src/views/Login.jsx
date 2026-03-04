import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'

function Brand() {
  return (
    <div className="login-brand">
      <span className="brand-badge">F1</span>
      <div className="login-brand-text">
        <div className="login-title">Fantasy League</div>
        <div className="login-season">2026 Season</div>
      </div>
    </div>
  )
}

export default function Login() {
  const { signIn } = useAuth()
  const [managers, setManagers] = useState([])
  const [selected, setSelected] = useState(null)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('managers')
      .select('id, display_name, slug')
      .order('display_name')
      .then(({ data }) => setManagers(data ?? []))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selected?.slug) return
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(selected.slug, password)
    if (error) setError('Wrong password. Try again.')
    setSubmitting(false)
  }

  if (!selected) {
    return (
      <div className="login-page">
        <Brand />
        <p className="login-prompt">Who are you?</p>
        <div className="manager-grid">
          {managers.map((m) => (
            <button
              key={m.id}
              className="manager-pick-btn"
              onClick={() => setSelected(m)}
            >
              {m.display_name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <Brand />
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-who">
          <span className="login-who-name">{selected.display_name}</span>
          <button
            type="button"
            className="login-who-change"
            onClick={() => { setSelected(null); setError(null); setPassword('') }}
          >
            Not you?
          </button>
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            autoFocus
            required
          />
        </div>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="login-btn" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
