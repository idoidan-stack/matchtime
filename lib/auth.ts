export type Role = 'sales_manager' | 'manager' | 'system_admin' | 'relayn'

export interface User {
  id: string
  name: string
  username: string
  password: string
  role: Role
  relayнPerson?: 'ido' | 'ofek' // only for relayn role
  phone?: string
}

export interface Session {
  userId: string
  username: string
  name: string
  role: Role
  relayнPerson?: 'ido' | 'ofek'
  phone?: string
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem('matchtime_session')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function setSession(session: Session) {
  sessionStorage.setItem('matchtime_session', JSON.stringify(session))
}

export function clearSession() {
  sessionStorage.removeItem('matchtime_session')
}

export function canAccess(session: Session | null, required: Role[]): boolean {
  if (!session) return false
  if (session.role === 'system_admin') return true
  return required.includes(session.role)
}
