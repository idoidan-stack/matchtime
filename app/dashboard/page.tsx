'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { ref, set, onValue, push, get } from 'firebase/database'
import { getSession, clearSession, type User } from '@/lib/auth'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         getDay, addMonths, subMonths, isToday, isBefore, startOfDay } from 'date-fns'
import { he } from 'date-fns/locale'

const HOURS = Array.from({ length: 22 }, (_, i) => {
  const h = Math.floor(i / 2) + 8
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

type Person = 'ido' | 'ofek'
const PERSON_LABELS: Record<Person, string> = { ido: 'עידו', ofek: 'אופק' }

const STATUS_LABELS: Record<string, string> = {
  pending:   'ממתין',
  approved:  'אושר',
  rejected:  'נדחה',
  cancelled: 'בוטל',
}
const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  approved:  'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

async function sendSms(phone: string, message: string) {
  try {
    await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
    })
  } catch {}
}

export default function DashboardPage() {
  const router  = useRouter()
  const session = typeof window !== 'undefined' ? getSession() : null

  const [tab, setTab]                   = useState<'calendar' | 'history'>('calendar')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [historyMonth, setHistoryMonth] = useState(new Date())
  const [selectedDay, setSelectedDay]   = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<Person>('ido')
  const [availability, setAvailability] = useState<Record<Person, Record<string, Record<string, boolean>>>>({
    ido: {}, ofek: {}
  })
  const [requests, setRequests]   = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  const monthKey        = format(currentMonth, 'yyyy-MM')
  const historyMonthKey = format(historyMonth, 'yyyy-MM')

  useEffect(() => {
    if (!session) { router.push('/'); return }
    const allowed = ['sales_manager', 'manager', 'system_admin', 'relayn']
    if (!allowed.includes(session.role)) { router.push('/'); return }
  }, [])

  useEffect(() => {
    const unsubs: (() => void)[] = []
    ;(['ido', 'ofek'] as Person[]).forEach(person => {
      const r = ref(db, `matchtime/availability/${person}/${monthKey}`)
      const unsub = onValue(r, snap => {
        setAvailability(prev => ({ ...prev, [person]: snap.exists() ? snap.val() : {} }))
      })
      unsubs.push(unsub)
    })
    return () => unsubs.forEach(u => u())
  }, [monthKey])

  useEffect(() => {
    const r = ref(db, 'matchtime/requests')
    const unsub = onValue(r, snap => {
      setRequests(snap.exists() ? Object.values(snap.val()) as any[] : [])
    })
    return () => unsub()
  }, [])

  const days           = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOfWeek = (getDay(startOfMonth(currentMonth)) + 6) % 7

  function dateKey(d: Date) { return format(d, 'yyyy-MM-dd') }

  function getPersonDayStatus(person: Person, dk: string): 'full' | 'partial' | 'empty' {
    const daySlots = availability[person]?.[dk]
    if (!daySlots) return 'empty'
    const count = Object.values(daySlots).filter(Boolean).length
    if (count === 0) return 'empty'
    if (count >= HOURS.length - 2) return 'full'
    return 'partial'
  }

  function getDayColor(dk: string): 'green' | 'yellow' | 'red' | 'empty' {
    const ido  = getPersonDayStatus('ido', dk)
    const ofek = getPersonDayStatus('ofek', dk)
    if ([ido, ofek].includes('full'))    return 'green'
    if ([ido, ofek].includes('partial')) return 'yellow'
    const hasReqs = requests.some(r => r.date === dk && r.status !== 'rejected' && r.status !== 'cancelled')
    if (hasReqs) return 'red'
    return 'empty'
  }

  function getAvailableSlots(person: Person, dk: string): string[] {
    const daySlots = availability[person]?.[dk]
    if (!daySlots) return []
    return HOURS.filter(h => daySlots[h])
  }

  function getDayRequests(dk: string) { return requests.filter(r => r.date === dk) }

  async function submitRequest() {
    if (!selectedDay || !startTime || !endTime) return
    if (startTime >= endTime) { alert('שעת סיום חייבת להיות אחרי שעת התחלה'); return }
    setSubmitting(true)

    const reqRef = push(ref(db, 'matchtime/requests'))
    const req = {
      id:               reqRef.key,
      date:             selectedDay,
      startTime,
      endTime,
      person:           selectedPerson,
      status:           'pending',
      requestedBy:      session?.name ?? 'לא ידוע',
      requestedById:    session?.userId,
      requestedByPhone: session?.phone ?? '',
      createdAt:        Date.now(),
    }
    await set(reqRef, req)

    // SMS to Reline people
    try {
      const snap = await get(ref(db, 'matchtime/users'))
      if (snap.exists()) {
        const users = Object.values(snap.val()) as User[]
        const relaynUsers = users.filter(u => u.role === 'relayn' && u.phone)
        const msg = `📅 בקשת פגישה חדשה\nמאת: ${session?.name}\nתאריך: ${selectedDay}\nשעות: ${startTime}–${endTime}\nנציג: ${PERSON_LABELS[selectedPerson]}`
        for (const u of relaynUsers) {
          if (u.phone) sendSms(u.phone, msg)
        }
      }
    } catch {}

    setSubmitting(false)
    setShowModal(false)
    setStartTime('')
    setEndTime('')
  }

  async function cancelRequest(reqId: string) {
    if (!confirm('לבטל בקשה זו?')) return
    await set(ref(db, `matchtime/requests/${reqId}/status`), 'cancelled')
  }

  const selectedDayRequests = selectedDay ? getDayRequests(selectedDay) : []
  const monthRequests = requests
    .filter(r => r.date?.startsWith(historyMonthKey))
    .sort((a, b) => b.createdAt - a.createdAt)

  const canCancel = (req: any) =>
    req.status === 'pending' &&
    (req.requestedById === session?.userId || session?.role === 'system_admin' || session?.role === 'manager' || session?.role === 'sales_manager')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">MatchTime</h1>
          <p className="text-sm text-gray-500">{session?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {session?.role === 'system_admin' && (
            <button onClick={() => router.push('/admin')}
              className="text-sm text-brand-600 hover:text-brand-800 font-medium">ניהול</button>
          )}
          <button onClick={() => { clearSession(); router.push('/') }}
            className="text-sm text-gray-500 hover:text-red-600">התנתק</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-1">
          {[
            { key: 'calendar', label: 'לוח שנה' },
            { key: 'history',  label: 'היסטוריה' },
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

      {/* ── Calendar tab ── */}
      {tab === 'calendar' && (
        <div className="max-w-5xl mx-auto p-6 flex gap-6">
          <div className="flex-1">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                {format(currentMonth, 'MMMM yyyy', { locale: he })}
              </h2>
              <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
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

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
              {days.map(day => {
                const dk           = dateKey(day)
                const color        = getDayColor(dk)
                const isPast       = isBefore(startOfDay(day), startOfDay(new Date()))
                const isSelected   = selectedDay === dk
                const pendingReqs  = getDayRequests(dk).filter(r => r.status === 'pending')
                const approvedReqs = getDayRequests(dk).filter(r => r.status === 'approved')
                return (
                  <button key={dk} onClick={() => setSelectedDay(isSelected ? null : dk)}
                    className={`
                      relative aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all cursor-pointer
                      hover:ring-2 hover:ring-brand-400
                      ${isSelected ? 'ring-2 ring-brand-500' : ''}
                      ${color === 'green'  ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-400' : ''}
                      ${color === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400'   : ''}
                      ${color === 'red'    ? 'bg-red-100 text-red-800 border-2 border-red-400'            : ''}
                      ${color === 'empty'  ? 'bg-white text-gray-600 border-2 border-gray-200'            : ''}
                      ${isPast ? 'opacity-50' : ''}
                      ${isToday(day) ? 'font-bold' : ''}
                    `}
                  >
                    {format(day, 'd')}
                    <div className="flex gap-0.5 mt-0.5">
                      {pendingReqs.length  > 0 && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
                      {approvedReqs.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500"   />}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400 inline-block"/> זמין מלא</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400 inline-block"/> זמין חלקי</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200   border border-red-400    inline-block"/> תפוס</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block"/> ממתין</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500   inline-block"/> אושר</span>
            </div>
          </div>

          {/* Side panel */}
          {selectedDay && (
            <div className="w-80 self-start sticky top-6 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4">
                  {format(new Date(selectedDay), 'd MMMM yyyy', { locale: he })}
                </h3>
                {(['ido', 'ofek'] as Person[]).map(person => {
                  const slots  = getAvailableSlots(person, selectedDay)
                  const status = getPersonDayStatus(person, selectedDay)
                  return (
                    <div key={person} className="mb-3 last:mb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{PERSON_LABELS[person]}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          status === 'full'    ? 'bg-emerald-100 text-emerald-700' :
                          status === 'partial' ? 'bg-yellow-100 text-yellow-700'  :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {status === 'full' ? 'פנוי מלא' : status === 'partial' ? 'פנוי חלקי' : 'לא פנוי'}
                        </span>
                      </div>
                      {slots.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {slots.map(s => <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s}</span>)}
                        </div>
                      )}
                    </div>
                  )
                })}
                {(getPersonDayStatus('ido', selectedDay) !== 'empty' || getPersonDayStatus('ofek', selectedDay) !== 'empty') && (
                  <button onClick={() => setShowModal(true)}
                    className="w-full mt-4 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium">
                    שלח בקשת תיאום
                  </button>
                )}
              </div>

              {selectedDayRequests.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-800 mb-3 text-sm">בקשות ליום זה</h4>
                  <div className="space-y-2">
                    {selectedDayRequests.map((req: any) => (
                      <div key={req.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            {PERSON_LABELS[req.person as Person]} · {req.startTime}–{req.endTime}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_LABELS[req.status] ?? req.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">מאת: {req.requestedBy}</p>
                        {canCancel(req) && (
                          <button onClick={() => cancelRequest(req.id)}
                            className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium">
                            ביטול בקשה
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <div className="max-w-3xl mx-auto p-6">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setHistoryMonth(m => subMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {format(historyMonth, 'MMMM yyyy', { locale: he })}
            </h2>
            <button onClick={() => setHistoryMonth(m => addMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {monthRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
              אין בקשות בחודש זה
            </div>
          ) : (
            <div className="space-y-3">
              {monthRequests.map((req: any) => (
                <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {format(new Date(req.date), 'd MMMM yyyy', { locale: he })}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {PERSON_LABELS[req.person as Person]} · {req.startTime}–{req.endTime}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">מאת: {req.requestedBy}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[req.status] ?? req.status}
                    </span>
                  </div>
                  {canCancel(req) && (
                    <button onClick={() => cancelRequest(req.id)}
                      className="mt-3 text-sm text-red-500 hover:text-red-700 font-medium border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50">
                      ביטול בקשה
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Request modal */}
      {showModal && selectedDay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">בקשת תיאום פגישה</h3>
            <p className="text-sm text-gray-500 mb-5">
              {format(new Date(selectedDay), 'd MMMM yyyy', { locale: he })}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">בחר נציג Reline</label>
                <div className="flex gap-2">
                  {(['ido', 'ofek'] as Person[]).map(p => {
                    const status   = getPersonDayStatus(p, selectedDay)
                    const disabled = status === 'empty'
                    return (
                      <button key={p} onClick={() => !disabled && setSelectedPerson(p)} disabled={disabled}
                        className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                          selectedPerson === p && !disabled ? 'border-brand-500 bg-brand-50 text-brand-700' :
                          disabled ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' :
                          'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {PERSON_LABELS[p]}
                        <span className={`block text-xs font-normal mt-0.5 ${
                          disabled ? 'text-gray-400' : status === 'full' ? 'text-emerald-600' : 'text-yellow-600'
                        }`}>
                          {disabled ? 'לא פנוי' : status === 'full' ? 'פנוי מלא' : 'פנוי חלקי'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שעת התחלה</label>
                  <select value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 text-right">
                    <option value="">בחר...</option>
                    {getAvailableSlots(selectedPerson, selectedDay).map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שעת סיום</label>
                  <select value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 text-right">
                    <option value="">בחר...</option>
                    {getAvailableSlots(selectedPerson, selectedDay).filter(h => h > startTime).map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={submitRequest} disabled={submitting || !startTime || !endTime}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
                {submitting ? 'שולח...' : 'שלח בקשה'}
              </button>
              <button onClick={() => { setShowModal(false); setStartTime(''); setEndTime('') }}
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
