import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function fetchManager(userId) {
  const { data } = await supabase
    .from('managers')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  return data ?? null
}

export function AuthProvider({ children }) {
  // undefined = auth not yet initialized, null = no session
  const [session, setSession] = useState(undefined)
  const [manager, setManager] = useState(null)

  const loading = session === undefined

  // Effect 1: listen for auth state — synchronous only, no DB calls
  useEffect(() => {
    // Fallback: if auth never fires (e.g. network down), treat as no session
    const fallback = setTimeout(() => setSession(null), 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(fallback)
      setSession(session)
    })

    return () => {
      clearTimeout(fallback)
      subscription.unsubscribe()
    }
  }, [])

  // Effect 2: load manager row whenever session changes
  useEffect(() => {
    if (session === undefined) return
    if (!session?.user) {
      setManager(null)
      return
    }
    fetchManager(session.user.id).then(setManager)
  }, [session])

  async function signIn(slug, password) {
    const email = `${slug}@racef1.com`
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, manager, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
