'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import { setSession, type User } from '@/lib/auth'
import { log } from '@/lib/logger'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin() {
    setError('')
    if (!username || !password) { setError('נא למלא שם משתמש וסיסמה'); return }

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
        phone:        (user as any).phone ?? '',
      })

      log('login', `התחבר למערכת`, user.name)

      if (user.role === 'relayn') router.push('/availability')
      else                        router.push('/dashboard')
    } catch (e) {
      setError('שגיאה בהתחברות, נסה שוב')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500 mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MatchTime</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">תיאום פגישות Reline × Partner</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">שם משתמש</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="הכנס שם משתמש" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">סיסמה</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="הכנס סיסמה" />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl px-4 py-2.5 text-sm text-center animate-fade-up">
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 active:scale-95 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 transition-all shadow-sm">
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </div>
      </div>
    </div>
  )
}
