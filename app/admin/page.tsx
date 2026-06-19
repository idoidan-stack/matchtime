'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { ref, get, set, remove } from 'firebase/database'
import { getSession, clearSession, type User, type Role } from '@/lib/auth'

/* ── Role metadata ── */
const ROLES: { value: Role; label: string; color: string; icon: string; desc: string }[] = [
  {
    value: 'sales_manager',
    label: 'מנהל מכירות',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    icon: '💼',
    desc: 'צפייה בלוח שנה, שליחת בקשות תיאום פגישות, ביטול בקשות עצמיות',
  },
  {
    value: 'manager',
    label: 'מנהל',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    icon: '👔',
    desc: 'כל הרשאות מנהל מכירות + ביטול בקשות של כל המשתמשים',
  },
  {
    value: 'relayn',
    label: 'Reline',
    color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
    icon: '📅',
    desc: 'עובד Reline — מנהל זמינות אישית, מאשר ודוחה בקשות תיאום',
  },
  {
    value: 'system_admin',
    label: 'מנהל מערכת',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    icon: '⚙️',
    desc: 'גישה מלאה לכל האפליקציה כולל ניהול משתמשים',
  },
]

const roleInfo = (role: Role) => ROLES.find(r => r.value === role)!

export default function AdminPage() {
  const router  = useRouter()
  const session = typeof window !== 'undefined' ? getSession() : null

  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [showRoles, setShowRoles] = useState(false)

  const [form, setForm] = useState({
    name: '', username: '', password: '',
    role: 'sales_manager' as Role,
    relayнPerson: '' as '' | 'ido' | 'ofek',
    phone: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState('')

  useEffect(() => {
    const unlocked = typeof window !== 'undefined' && localStorage.getItem('settings_unlocked') === 'true'
    if (!session || !unlocked) { router.push('/'); return }
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    const snap = await get(ref(db, 'matchtime/users'))
    setUsers(snap.exists() ? (Object.values(snap.val()) as User[]) : [])
    setLoading(false)
  }

  function openNew() {
    setEditUser(null)
    setForm({ name: '', username: '', password: '', role: 'sales_manager', relayнPerson: '', phone: '' })
    setShowForm(true)
    setMsg('')
  }

  function openEdit(u: User) {
    setEditUser(u)
    setForm({
      name: u.name, username: u.username, password: u.password,
      role: u.role, relayнPerson: u.relayнPerson ?? '', phone: (u as any).phone ?? '',
    })
    setShowForm(true)
    setMsg('')
  }

  async function saveUser() {
    if (!form.name || !form.username || !form.password) { setMsg('נא למלא את כל השדות'); return }
    setSaving(true)
    const id = editUser?.id ?? `user_${Date.now()}`
    const userData: User = {
      id, name: form.name, username: form.username,
      password: form.password, role: form.role,
      ...(form.role === 'relayn' && form.relayнPerson ? { relayнPerson: form.relayнPerson } : {}),
      ...(form.phone ? { phone: form.phone } : {}),
    }
    await set(ref(db, `matchtime/users/${id}`), userData)
    setSaving(false)
    setShowForm(false)
    loadUsers()
  }

  async function deleteUser(id: string) {
    if (!confirm('למחוק משתמש זה?')) return
    await remove(ref(db, `matchtime/users/${id}`))
    loadUsers()
  }

  const selectedRole = roleInfo(form.role)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      {/* ── Header ── */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">ניהול מערכת</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">MatchTime</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/admin/logs')}
            className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            לוגים
          </button>
          <button onClick={() => { localStorage.removeItem('settings_unlocked'); clearSession(); router.push('/') }}
            className="text-xs text-gray-500 hover:text-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
            התנתק
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5">

        {/* ── Roles legend ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm mb-5 overflow-hidden">
          <button
            onClick={() => setShowRoles(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-right">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              🔑 הסבר הרשאות
            </span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showRoles ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {showRoles && (
            <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {ROLES.map(r => (
                <div key={r.value} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-xl mt-0.5">{r.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.color}`}>{r.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Title + Add button ── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            משתמשים ({users.length})
          </h2>
          <button onClick={openNew}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            הוסף
          </button>
        </div>

        {/* ── Users list ── */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
            טוען...
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className="text-4xl mb-3">👤</div>
            אין משתמשים עדיין
          </div>
        ) : (
          <div className="space-y-2.5">
            {users.map(u => {
              const role = roleInfo(u.role)
              return (
                <div key={u.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    {/* Avatar + info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-300 font-bold text-sm flex-shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{u.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5" dir="ltr">{u.username}</p>
                        {u.relayнPerson && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Reline: {u.relayнPerson === 'ido' ? 'עידו' : 'אופק'}
                          </p>
                        )}
                        {(u as any).phone && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5" dir="ltr">
                            {(u as any).phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Role badge */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${role.color}`}>
                        {role.icon} {role.label}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(u)}
                          className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all">
                          ערוך
                        </button>
                        <button onClick={() => deleteUser(u.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                          מחק
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md animate-pop-in max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 rounded-t-3xl px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700 z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editUser ? '✏️ עריכת משתמש' : '➕ משתמש חדש'}
                </h3>
                <button onClick={() => setShowForm(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600">✕</button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">שם מלא</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  placeholder="ישראל ישראלי" />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">שם משתמש</label>
                <input value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  placeholder="israel123" dir="ltr" />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">סיסמה</label>
                <input value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  placeholder="••••••••" dir="ltr" />
              </div>

              {/* Role selector — cards */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">הרשאה</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r => (
                    <button key={r.value} type="button"
                      onClick={() => setForm(f => ({...f, role: r.value, relayнPerson: r.value !== 'relayn' ? '' : f.relayнPerson}))}
                      className={`flex flex-col items-start gap-1 p-3 rounded-2xl border-2 text-right transition-all active:scale-95 ${
                        form.role === r.value
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-brand-300'
                      }`}>
                      <span className="text-lg">{r.icon}</span>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight">{r.label}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 leading-tight">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  טלפון
                  <span className="text-xs font-normal text-gray-400 mr-1">(לוואטסאפ)</span>
                </label>
                <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  placeholder="05X-XXXXXXX" dir="ltr" />
              </div>

              {/* Reline person (only for relayn role) */}
              {form.role === 'relayn' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">אדם ב-Reline</label>
                  <div className="flex gap-2">
                    {[{ v: 'ido', l: 'עידו' }, { v: 'ofek', l: 'אופק' }].map(({ v, l }) => (
                      <button key={v} type="button"
                        onClick={() => setForm(f => ({...f, relayнPerson: v as 'ido' | 'ofek'}))}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                          form.relayнPerson === v
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-300'
                        }`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msg && (
                <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 rounded-xl py-2">{msg}</p>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={saveUser} disabled={saving}
                className="flex-1 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white rounded-xl py-3 font-semibold disabled:opacity-50 transition-all shadow-sm">
                {saving ? 'שומר...' : '✓ שמור'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl py-3 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
