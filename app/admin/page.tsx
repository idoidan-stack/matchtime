'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { ref, get, set, remove } from 'firebase/database'
import { getSession, clearSession, type User, type Role } from '@/lib/auth'

const ROLE_LABELS: Record<Role, string> = {
  sales_manager: 'מנהל מכירות',
  manager:       'מנהל',
  system_admin:  'מנהל מערכת',
  relayn:        'Relayn',
}

export default function AdminPage() {
  const router  = useRouter()
  const session = typeof window !== 'undefined' ? getSession() : null

  const [users, setUsers]     = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)

  const [form, setForm] = useState({
    name: '', username: '', password: '',
    role: 'sales_manager' as Role,
    relayнPerson: '' as '' | 'ido' | 'ofek',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState('')

  useEffect(() => {
    if (!session || session.role !== 'system_admin') { router.push('/'); return }
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    const snap = await get(ref(db, 'matchtime/users'))
    if (snap.exists()) {
      setUsers(Object.values(snap.val()) as User[])
    } else {
      setUsers([])
    }
    setLoading(false)
  }

  function openNew() {
    setEditUser(null)
    setForm({ name: '', username: '', password: '', role: 'sales_manager', relayнPerson: '' })
    setShowForm(true)
    setMsg('')
  }

  function openEdit(u: User) {
    setEditUser(u)
    setForm({
      name: u.name, username: u.username, password: u.password,
      role: u.role, relayнPerson: u.relayнPerson ?? '',
    })
    setShowForm(true)
    setMsg('')
  }

  async function saveUser() {
    if (!form.name || !form.username || !form.password) {
      setMsg('נא למלא את כל השדות'); return
    }
    setSaving(true)
    const id = editUser?.id ?? `user_${Date.now()}`
    const userData: User = {
      id, name: form.name, username: form.username,
      password: form.password, role: form.role,
      ...(form.role === 'relayn' && form.relayнPerson ? { relayнPerson: form.relayнPerson } : {}),
    }
    await set(ref(db, `matchtime/users/${id}`), userData)
    setMsg('נשמר בהצלחה')
    setSaving(false)
    setShowForm(false)
    loadUsers()
  }

  async function deleteUser(id: string) {
    if (!confirm('למחוק משתמש זה?')) return
    await remove(ref(db, `matchtime/users/${id}`))
    loadUsers()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">ניהול מערכת — MatchTime</h1>
        <button onClick={() => { clearSession(); router.push('/') }}
          className="text-sm text-gray-500 hover:text-red-600">
          התנתק
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">משתמשים במערכת</h2>
          <button onClick={openNew}
            className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
            <span>+ הוסף משתמש</span>
          </button>
        </div>

        {/* Users table */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">טוען...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
            אין משתמשים עדיין. הוסף את הראשון.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">שם</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">שם משתמש</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">הרשאה</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Relayn</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className="bg-brand-100 text-brand-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {u.relayнPerson === 'ido' ? 'עידו' : u.relayнPerson === 'ofek' ? 'אופק' : '—'}
                    </td>
                    <td className="px-4 py-3 flex gap-2 justify-end">
                      <button onClick={() => openEdit(u)}
                        className="text-brand-600 hover:text-brand-800 text-xs font-medium">ערוך</button>
                      <button onClick={() => deleteUser(u.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium">מחק</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-5">
              {editUser ? 'עריכת משתמש' : 'משתמש חדש'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="שם מלא" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם משתמש</label>
                <input value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="username" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
                <input value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="סיסמה" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">הרשאה</label>
                <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value as Role}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {form.role === 'relayn' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">אדם ב-Relayn</label>
                  <select value={form.relayнPerson} onChange={e => setForm(f => ({...f, relayнPerson: e.target.value as 'ido' | 'ofek'}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="">בחר...</option>
                    <option value="ido">עידו</option>
                    <option value="ofek">אופק</option>
                  </select>
                </div>
              )}
            </div>
            {msg && <p className="text-sm text-center mt-3 text-red-600">{msg}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={saveUser} disabled={saving}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 font-medium hover:bg-gray-50">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
