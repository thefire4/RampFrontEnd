import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

// The signed-in user without requiring <AuthProvider> (RAMP-139): outside it, nobody is signed in
// and nobody is an admin, so admin-only options stay hidden
export function useCurrentUser() {
  const auth = useContext(AuthContext)
  return { user: auth?.user ?? null, isAdmin: auth?.isAdmin === true }
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}
