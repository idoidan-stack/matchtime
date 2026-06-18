'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { getSession } from '@/lib/auth'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  login:            { label: 'כניסה למערכת',     icon: '🔓', color: 'bg-green-100 text-green-700' },
  logout:           { label: 'יציאה מהמערכת',    icon: '🔒', color: 'bg-gray-100 text-gray-600' },
  request_created:  { label: 'בקשה חדשה',         icon: '📅', color: 'bg-blue-100 text-blue-700' },
  request_approved: { label: 'בקשה אושרה',        icon: '✅', color: 'bg-emerald-100 text-emerald-700' },
  request_rejected: { label: 'בקשה נדחתה',        icon: '❌', color: 'bg-red-100 text-red-700' },
  request_cancelled:{ label: 'בקשה בוטלה',        icon: '🚫', color: 'bg-orange-100 text-orange-700' },
  user_created:     { label: 'משתמש נוצר',        icon: '👤', color: 'bg-purple-100 text-purple-700' },
  user_updated:     { label: 'משתמש עודכן',       icon: '✏️', color: 'bg-yellow-100 text-yellow-700' },
  user_deleted:     { label: 'משתמש נמחק',        icon: '🗑️', color: 'bg-red-100 text-red-700' },
  settings_accessed:{ label: 'גישה להגדרות',      icon: '⚙️', color: 'bg-brand-100 text-brand-700' },
}

export default function LogsPage() {
  const router  = useRouter()
  const session = typeof window !== 'undefined' ? getSession() : null
  const [logs, setLogs]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<string>('all')

  useEffect(() => {
    const unlocked = typeof window !== 'undefined' && localStorage.getItem('settings_unlocked') === 'true'
    if (!session || !unlocked) { router.push('/'); return }

    const unsub = onValue(ref(db, 'matchtime/logs'), snap => {
      if (snap.exists()) {
        const all = Object.values(snap.val()) as any[]
        setLogs(all.sort((a, b) => b.timestamp - a.timestamp))
      } else {
        setLogs([])
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action === filter)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">📋 לוג פעולות</h1>
        </div>
        <span className="text-sm text-gray-400">{logs.length} רשומות</span>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {/* Filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === 'all' ? 'bg-brand-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}>
            הכל
          </button>
          {Object.entries(ACTION_LABELS).map(([key, val]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === key ? 'bg-brand-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}>
              {val.icon} {val.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className="text-4xl mb-3">📭</div>
            אין לוגים להציג
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry: any) => {
              const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, icon: '•', color: 'bg-gray-100 text-gray-600' }
              return (
                <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-4 hover:shadow-sm transition-shadow animate-fade-up">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{entry.details}</span>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{entry.userName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {format(new Date(entry.timestamp), 'dd/MM HH:mm', { locale: he })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
