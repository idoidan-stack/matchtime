'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { log } from '@/lib/logger'
import { db } from '@/lib/firebase'
import { ref, set, onValue } from 'firebase/database'
import { getSession, clearSession } from '@/lib/auth'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         getDay, addMonths, subMonths, isSameMonth, isToday, isBefore, startOfDay } from 'date-fns'
import { he } from 'date-fns/locale'

const HOURS = Array.from({ length: 23 }, (_, i) => {
  const h = Math.floor(i / 2) + 8
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
}).filter((_, i) => i < 22) // 08:00 – 18:30

type DaySlots = Record<string, boolean> // "08:00" => true/false

// ── Slots panel (shared between desktop side-panel and mobile bottom-sheet) ──
function SlotsPanel({ selectedDay, slots, dragging, dragValue, saving, setDragging, setDragValue, toggleSlot, selectAllDay, clearDay, saveDay, setSelectedDay }: {
  selectedDay: string
  slots: Record<string, DaySlots>
  dragging: boolean
  dragValue: boolean
  saving: boolean
  setDragging: (v: boolean) => void
  setDragValue: (v: boolean) => void
  toggleSlot: (h: string, force?: boolean) => void
  selectAllDay: () => void
  clearDay: () => void
  saveDay: () => void
  setSelectedDay: (v: string | null) => void
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white text-base">
          {format(new Date(selectedDay), 'EEEE, d MMMM', { locale: he })}
        </h3>
        <button onClick={() => setSelectedDay(null)}
          className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-sm">✕</button>
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={selectAllDay}
          className="flex-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg py-2 hover:bg-emerald-100 font-medium">
          בחר הכל
        </button>
        <button onClick={clearDay}
          className="flex-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg py-2 hover:bg-red-100 font-medium">
          נקה הכל
        </button>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">לחץ לסימון / בטל</p>

      <div
        className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto"
        onMouseLeave={() => setDragging(false)}
      >
        {HOURS.map(hour => {
          const active = slots[selectedDay]?.[hour] ?? false
          return (
            <button
              key={hour}
              onMouseDown={() => { setDragging(true); setDragValue(!active); toggleSlot(hour, !active) }}
              onMouseEnter={() => { if (dragging) toggleSlot(hour, dragValue) }}
              onMouseUp={() => setDragging(false)}
              onClick={() => toggleSlot(hour)}
              className={`
                text-xs rounded-xl py-2.5 border transition-colors select-none font-medium
                ${active
                  ? 'bg-brand-500 border-brand-600 text-white shadow-sm'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
                }
              `}
            >
              {hour}
            </button>
          )
        })}
      </div>

      <button onClick={saveDay} disabled={saving}
        className="w-full mt-4 bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 transition-all active:scale-95 shadow-sm">
        {saving ? 'שומר...' : '✓ שמור יום'}
      </button>
    </>
  )
}

export default function AvailabilityPage() {
  const router  = useRouter()
  const session = typeof window !== 'undefined' ? getSession() : null

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay]   = useState<string | null>(null)
  const [slots, setSlots]               = useState<Record<string, DaySlots>>({}) // dateKey => slots
  const [requests, setRequests]         = useState<any[]>([])
  const [dragging, setDragging]         = useState(false)
  const [dragValue, setDragValue]       = useState(true)
  const [saving, setSaving]             = useState(false)
  const [tab, setTab]                   = useState<'availability' | 'approvals'>('availability')

  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsPwd, setSettingsPwd]   = useState('')
  const [settingsErr, setSettingsErr]   = useState('')

  const [greeting, setGreeting] = useState('')
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'בוקר טוב ☀️' : h < 17 ? 'צהריים טובים 🌤️' : 'ערב טוב 🌙')
  }, [])

  function checkSettingsPassword() {
    if (settingsPwd === '300395860') {
      localStorage.setItem('settings_unlocked', 'true')
      log('settings_accessed', 'גישה להגדרות מערכת', session?.name)
      router.push('/admin')
    } else {
      setSettingsErr('סיסמה שגויה')
    }
  }

  const person = session?.relayнPerson ?? 'ido'
  const monthKey = format(currentMonth, 'yyyy-MM')

  useEffect(() => {
    if (!session || session.role !== 'relayn') { router.push('/'); return }
  }, [])

  // Load availability for this month
  useEffect(() => {
    const r = ref(db, `matchtime/availability/${person}/${monthKey}`)
    const unsub = onValue(r, snap => {
      setSlots(snap.exists() ? snap.val() : {})
    })
    return () => unsub()
  }, [person, monthKey])

  // Load requests for this person
  useEffect(() => {
    const r = ref(db, `matchtime/requests`)
    const unsub = onValue(r, snap => {
      if (!snap.exists()) { setRequests([]); return }
      const all = Object.values(snap.val()) as any[]
      setRequests(all.filter(req => req.person === person))
    })
    return () => unsub()
  }, [person])

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOfWeek = (getDay(startOfMonth(currentMonth)) + 6) % 7 // Monday-based

  function dateKey(d: Date) { return format(d, 'yyyy-MM-dd') }

  function getDayStatus(d: Date): 'full' | 'partial' | 'empty' {
    const dk = dateKey(d)
    const daySlots = slots[dk]
    if (!daySlots) return 'empty'
    const vals = Object.values(daySlots)
    const count = vals.filter(Boolean).length
    if (count === 0) return 'empty'
    if (count === HOURS.length) return 'full'
    return 'partial'
  }

  function toggleSlot(hour: string, forceTo?: boolean) {
    if (!selectedDay) return
    const dk = selectedDay
    const current = slots[dk]?.[hour] ?? false
    const newVal = forceTo !== undefined ? forceTo : !current
    setSlots(prev => ({
      ...prev,
      [dk]: { ...(prev[dk] ?? {}), [hour]: newVal }
    }))
  }

  async function saveDay() {
    if (!selectedDay) return
    setSaving(true)
    await set(ref(db, `matchtime/availability/${person}/${monthKey}/${selectedDay}`), slots[selectedDay] ?? {})
    setSaving(false)
  }

  function selectAllDay() {
    if (!selectedDay) return
    const all: DaySlots = {}
    HOURS.forEach(h => { all[h] = true })
    setSlots(prev => ({ ...prev, [selectedDay]: all }))
  }

  function clearDay() {
    if (!selectedDay) return
    setSlots(prev => ({ ...prev, [selectedDay]: {} }))
  }

  async function handleRequest(reqId: string, action: 'approved' | 'rejected') {
    await set(ref(db, `matchtime/requests/${reqId}/status`), action)
    if (action === 'approved') {
      await set(ref(db, `matchtime/requests/${reqId}/approvedAt`), Date.now())
    }

    // SMS to requesting person
    const req = requests.find(r => r.id === reqId)
    if (req?.requestedByPhone) {
      const dateStr = format(new Date(req.date), 'd MMMM yyyy', { locale: he })
      const msg = action === 'approved'
        ? `✅ בקשתך לפגישה ב-${dateStr} ${req.startTime}–${req.endTime} אושרה!`
        : `❌ בקשתך לפגישה ב-${dateStr} ${req.startTime}–${req.endTime} נדחתה.`
      fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: req.requestedByPhone, message: msg }),
      }).catch(() => {})
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">MatchTime</h1>
          <p className="text-sm text-gray-500">שלום {session?.name} · {greeting}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setSettingsPwd(''); setSettingsErr(''); setShowSettingsModal(true) }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={() => { clearSession(); router.push('/') }}
            className="text-sm text-gray-500 hover:text-red-600">התנתק</button>
        </div>
      </header>

      {/* ── Pending-requests banner (relayn) ── */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 animate-fade-up">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔔</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-800 text-sm">
                {pendingCount === 1
                  ? 'יש בקשת תיאום אחת הממתינה לאישורך'
                  : `יש ${pendingCount} בקשות תיאום הממתינות לאישורך`}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">עבור לטאב <strong>אישורים</strong> כדי לאשר או לדחות</p>
            </div>
            <button onClick={() => setTab('approvals')}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 whitespace-nowrap">
              לאישורים ←
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-1">
          {[
            { key: 'availability', label: 'זמינות' },
            { key: 'approvals',    label: `אישורים${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'availability' ? (
        <div className="max-w-5xl mx-auto p-4 md:p-6 md:flex gap-6">
          {/* Calendar */}
          <div className="flex-1">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                {format(currentMonth, 'MMMM yyyy', { locale: he })}
              </h2>
              <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {['ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳', 'א׳'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
              {days.map(day => {
                const dk = dateKey(day)
                const status = getDayStatus(day)
                const isPast = isBefore(startOfDay(day), startOfDay(new Date()))
                const isSelected = selectedDay === dk

                return (
                  <button
                    key={dk}
                    onClick={() => !isPast && setSelectedDay(isSelected ? null : dk)}
                    className={`
                      relative aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all
                      ${isPast ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-brand-400'}
                      ${isSelected ? 'ring-2 ring-brand-500' : ''}
                      ${status === 'full'    ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-400' : ''}
                      ${status === 'partial' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400'   : ''}
                      ${status === 'empty'   ? 'bg-white text-gray-700 border-2 border-gray-200'            : ''}
                      ${isToday(day) ? 'font-bold' : ''}
                    `}
                  >
                    {format(day, 'd')}
                    {status !== 'empty' && (
                      <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        status === 'full' ? 'bg-emerald-500' : 'bg-yellow-500'
                      }`} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400 inline-block"/> זמין מלא</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400 inline-block"/> זמין חלקי</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border-2 border-gray-200 inline-block"/> לא מוגדר</span>
            </div>
          </div>

          {/* Time slots panel — desktop */}
          {selectedDay && (
            <div className="hidden md:block w-72 bg-white rounded-xl border border-gray-200 p-4 self-start sticky top-6">
              <SlotsPanel
                selectedDay={selectedDay}
                slots={slots}
                dragging={dragging}
                dragValue={dragValue}
                saving={saving}
                setDragging={setDragging}
                setDragValue={setDragValue}
                toggleSlot={toggleSlot}
                selectAllDay={selectAllDay}
                clearDay={clearDay}
                saveDay={saveDay}
                setSelectedDay={setSelectedDay}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* Time slots — mobile bottom sheet */}
      {tab === 'availability' && selectedDay && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setSelectedDay(null)} />
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="px-4 pb-8">
              <SlotsPanel
                selectedDay={selectedDay}
                slots={slots}
                dragging={dragging}
                dragValue={dragValue}
                saving={saving}
                setDragging={setDragging}
                setDragValue={setDragValue}
                toggleSlot={toggleSlot}
                selectAllDay={selectAllDay}
                clearDay={clearDay}
                saveDay={saveDay}
                setSelectedDay={setSelectedDay}
              />
            </div>
          </div>
        </>
      )}

      {tab === 'approvals' && (
        /* Approvals tab */
        <div className="max-w-2xl mx-auto p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">בקשות תיאום</h2>
          {requests.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
              אין בקשות
            </div>
          ) : (
            <div className="space-y-3">
              {requests.sort((a, b) => b.createdAt - a.createdAt).map((req: any) => (
                <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {format(new Date(req.date), 'd MMMM yyyy', { locale: he })}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {req.startTime} – {req.endTime}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">בקשה מאת: {req.requestedBy}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      req.status === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                      req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {req.status === 'pending' ? 'ממתין' : req.status === 'approved' ? 'אושר' : 'נדחה'}
                    </span>
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleRequest(req.id, 'approved')}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium">
                        אשר
                      </button>
                      <button onClick={() => handleRequest(req.id, 'rejected')}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg py-2 text-sm font-medium">
                        דחה
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">⚙️ הגדרות מערכת</h3>
              <button onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">הכנס סיסמת מנהל לגישה להגדרות</p>
            <input type="password" value={settingsPwd}
              onChange={e => { setSettingsPwd(e.target.value); setSettingsErr('') }}
              onKeyDown={e => e.key === 'Enter' && checkSettingsPassword()}
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3"
              placeholder="••••••••••" />
            {settingsErr && <p className="text-red-500 text-sm text-center mb-3">{settingsErr}</p>}
            <button onClick={checkSettingsPassword}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl py-2.5">
              כניסה להגדרות
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
