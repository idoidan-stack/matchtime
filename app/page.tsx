'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import { setSession, type User } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin() {
    setError('')
    if (!username || !password) { setError('נא למלא שם משתמש וסיסמה'); return }

    // Check system admin bypass
    if (username === 'admin' && password === '300395860') {
      setSession({ userId: 'admin', username: 'admin', name: 'מנהל מערכת', role: 'system_admin' })
      router.push('/admin')
      return
    }

    setLoading(true)
    try {
      const snap = await get(ref(db, 'matchtime/users'))
      if (!snap.exists()) { setError('שם משתמש או סיסמה שגויים'); setLoading(false); return }

      const users: Record<string, User> = snap.val()
      const user = Object.values(users).find(
        u => u.username === username && u.password === password
      )
      if (!user) { setError('שם משתמש או סיסמה שגויים'); setLoading(false); return }

      setSession({
        userId:       user.id,
        username:     user.username,
        name:         user.name,
        role:         user.role,
        relayнPerson: user.relayнPerson,
      })

      if (user.role === 'relayn')         router.push('/availability')
      else if (user.role === 'system_admin') router.push('/admin')
      else                                router.push('/dashboard')
    } catch (e) {
      setError('שגיאה בהתחברות, נסה שוב')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MatchTime</h1>
          <p className="text-gray-500 text-sm mt-1">תיאום פגישות Relayn × Partner</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם משתמש</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="הכנס שם משתמש"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="הכנס סיסמה"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors"
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </div>
      </div>
    </div>
  )
}
