'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { ref, set, onValue, push, get } from 'firebase/database'
import { getSession, clearSession, type User } from '@/lib/auth'
import { log } from '@/lib/logger'
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
  pending: 'ממתין', approved: 'אושר', rejected: 'נדחה', cancelled: 'בוטל',
}
const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  approved:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

export default function DashboardPage() {
  const router  = useRouter()
  const session = typeof window !== 'undefined' ? getSession() : null

  const [tab, setTab]                   = useState<'calendar' | 'history'>('calendar')
  const [darkMode, setDarkMode]         = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [historyMonth, setHistoryMonth] = useState(new Date())
  const [selectedDay, setSelectedDay]   = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<Person>('ido')
  const [availability, setAvailability] = useState<Record<Person, Record<string, Record<string, boolean>>>>({ ido: {}, ofek: {} })
  const [requests, setRequests]         = useState<any[]>([])
  const [relaynPhones, setRelaynPhones] = useState<Record<string, string>>({})
  const [showModal, setShowModal]       = useState(false)
  const [startTime, setStartTime]       = useState('')
  const [endTime, setEndTime]           = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsPwd, setSettingsPwd]   = useState('')
  const [settingsErr, setSettingsErr]   = useState('')

  const monthKey        = format(currentMonth, 'yyyy-MM')
  const historyMonthKey = format(historyMonth, 'yyyy-MM')

  // Auth check
  useEffect(() => {
    if (!session) { router.push('/'); return }
    if (!['sales_manager','manager','system_admin','relayn'].includes(session.role)) router.push('/')
  }, [])

  // Dark mode init
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'))
  }, [])

  // PWA install prompt
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Load relayn phones
  useEffect(() => {
    get(ref(db, 'matchtime/users')).then(snap => {
      if (!snap.exists()) return
      const users = Object.values(snap.val()) as User[]
      const phones: Record<string, string> = {}
      users.filter(u => u.role === 'relayn' && u.relayнPerson && u.phone)
           .forEach(u => { phones[u.relayнPerson!] = u.phone! })
      setRelaynPhones(phones)
    })
  }, [])

  // Availability
  useEffect(() => {
    const unsubs: (() => void)[] = []
    ;(['ido', 'ofek'] as Person[]).forEach(person => {
      const unsub = onValue(ref(db, `matchtime/availability/${person}/${monthKey}`), snap => {
        setAvailability(prev => ({ ...prev, [person]: snap.exists() ? snap.val() : {} }))
      })
      unsubs.push(unsub)
    })
    return () => unsubs.forEach(u => u())
  }, [monthKey])

  // Requests
  useEffect(() => {
    return onValue(ref(db, 'matchtime/requests'), snap => {
      setRequests(snap.exists() ? Object.values(snap.val()) as any[] : [])
    })
  }, [])

  const days           = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOfWeek = (getDay(startOfMonth(currentMonth)) + 6) % 7

  const dk = (d: Date) => format(d, 'yyyy-MM-dd')

  function getPersonDayStatus(person: Person, dateKey: string): 'full' | 'partial' | 'empty' {
    const s = availability[person]?.[dateKey]
    if (!s) return 'empty'
    const count = Object.values(s).filter(Boolean).length
    if (count === 0) return 'empty'
    return count >= HOURS.length - 2 ? 'full' : 'partial'
  }

  function getDayColor(dateKey: string): 'green' | 'yellow' | 'red' | 'empty' {
    const ido  = getPersonDayStatus('ido', dateKey)
    const ofek = getPersonDayStatus('ofek', dateKey)
    if ([ido, ofek].includes('full'))    return 'green'
    if ([ido, ofek].includes('partial')) return 'yellow'
    if (requests.some(r => r.date === dateKey && r.status !== 'rejected' && r.status !== 'cancelled')) return 'red'
    return 'empty'
  }

  // Filter out slots occupied by approved requests
  function getAvailableSlots(person: Person, dateKey: string): string[] {
    const s = availability[person]?.[dateKey]
    if (!s) return []
    const approved = requests.filter(r => r.date === dateKey && r.person === person && r.status === 'approved')
    return HOURS.filter(h => {
      if (!s[h]) return false
      return !approved.some(r => h >= r.startTime && h < r.endTime)
    })
  }

  const dayReqs     = (dateKey: string) => requests.filter(r => r.date === dateKey)
  const canCancel   = (req: any) => req.status === 'pending' &&
    (req.requestedById === session?.userId || ['system_admin','manager','sales_manager'].includes(session?.role ?? ''))

  async function saveRequest() {
    if (!selectedDay || !startTime || !endTime) return
    const reqRef = push(ref(db, 'matchtime/requests'))
    await set(reqRef, {
      id: reqRef.key, date: selectedDay, startTime, endTime,
      person: selectedPerson, status: 'pending',
      requestedBy: session?.name ?? '', requestedById: session?.userId,
      requestedByPhone: session?.phone ?? '', createdAt: Date.now(),
    })
  }

  async function submitRequest() {
    if (!selectedDay || !startTime || !endTime) return
    if (startTime >= endTime) { alert('שעת סיום חייבת להיות אחרי שעת התחלה'); return }
    setSubmitting(true)
    await saveRequest()
    setSubmitting(false)
    setShowModal(false)
    setStartTime(''); setEndTime('')
  }

  function sendWhatsApp() {
    if (!selectedDay || !startTime || !endTime) return
    const phone = relaynPhones[selectedPerson]
    if (!phone) { alert(`אין מספר WhatsApp מוגדר ל-${PERSON_LABELS[selectedPerson]}.\nהוסף בעמוד ניהול → ערוך משתמש.`); return }
    const waPhone = phone.startsWith('0') ? '972' + phone.slice(1) : phone.replace(/^\+/, '')
    const dateStr = format(new Date(selectedDay), 'EEEE d MMMM yyyy', { locale: he })
    const siteUrl = window.location.origin
    const msg =
      `📅 *בקשת פגישה חדשה*\n\n` +
      `👤 מאת: ${session?.name}\n` +
      `📆 תאריך: ${dateStr}\n` +
      `🕐 שעות: ${startTime}–${endTime}\n\n` +
      `לאישור כנס לאתר:\n🔗 ${siteUrl}`
    // Save to Firebase + open WhatsApp
    saveRequest()
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank')
    setShowModal(false)
    setStartTime(''); setEndTime('')
  }

  async function cancelRequest(reqId: string) {
    if (!confirm('לבטל בקשה זו?')) return
    await set(ref(db, `matchtime/requests/${reqId}/status`), 'cancelled')
  }

  function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'בוקר טוב ☀️'
    if (h < 17) return 'צהריים טובים 🌤️'
    return 'ערב טוב 🌙'
  }

  function openSettings() {
    setSettingsPwd(''); setSettingsErr(''); setShowSettingsModal(true)
  }

  function checkSettingsPassword() {
    if (settingsPwd === '300395860') {
      localStorage.setItem('settings_unlocked', 'true')
      log('settings_accessed', 'גישה להגדרות מערכת', session?.name)
      router.push('/admin')
    } else {
      setSettingsErr('סיסמה שגויה')
    }
  }

  function toggleDark() {
    const next = !darkMode
    setDarkMode(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  function installPWA() {
    installPrompt?.prompt()
    setInstallPrompt(null)
  }

  const selectedDayRequests = selectedDay ? dayReqs(selectedDay) : []
  const monthRequests = requests
    .filter(r => r.date?.startsWith(historyMonthKey))
    .sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      {/* ── Header ── */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="animate-fade-up">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">MatchTime</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            שלום {session?.name} · {getGreeting()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Install PWA */}
          {installPrompt && (
            <button onClick={installPWA}
              className="animate-pulse-ring flex items-center gap-1.5 text-xs bg-brand-500 text-white px-3 py-1.5 rounded-full font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              התקן אפליקציה
            </button>
          )}
          {/* Settings gear */}
          <button onClick={openSettings}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {/* Dark mode toggle */}
          <button onClick={toggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
            {darkMode
              ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/></svg>
              : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
            }
          </button>
          {session?.role === 'system_admin' && (
            <button onClick={() => router.push('/admin')}
              className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 font-medium px-2 py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20">
              ניהול
            </button>
          )}
          <button onClick={() => { clearSession(); router.push('/') }}
            className="text-xs text-gray-500 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
            התנתק
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
        <div className="flex gap-1">
          {[{ key: 'calendar', label: '📅 לוח שנה' }, { key: 'history', label: '📋 היסטוריה' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                tab === t.key
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ CALENDAR TAB ══ */}
      {tab === 'calendar' && (
        <div className="max-w-5xl mx-auto p-4 flex gap-4 animate-fade-up">
          <div className="flex-1">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {format(currentMonth, 'MMMM yyyy', { locale: he })}
              </h2>
              <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['ב׳','ג׳','ד׳','ה׳','ו׳','ש׳','א׳'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 stagger">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`}/>)}
              {days.map(day => {
                const key       = dk(day)
                const color     = getDayColor(key)
                const isPast    = isBefore(startOfDay(day), startOfDay(new Date()))
                const isSelected = selectedDay === key
                const pending   = dayReqs(key).filter(r => r.status === 'pending').length
                const approved  = dayReqs(key).filter(r => r.status === 'approved').length
                return (
                  <button key={key} onClick={() => setSelectedDay(isSelected ? null : key)}
                    className={`
                      animate-fade-up relative aspect-square rounded-xl flex flex-col items-center justify-center
                      text-sm font-medium transition-all duration-200
                      hover:scale-105 hover:shadow-md active:scale-95
                      ${isSelected ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-gray-900 scale-105 shadow-md' : ''}
                      ${color === 'green'  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-2 border-emerald-400 dark:border-emerald-600' : ''}
                      ${color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border-2 border-yellow-400 dark:border-yellow-600' : ''}
                      ${color === 'red'    ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-2 border-red-400 dark:border-red-600' : ''}
                      ${color === 'empty'  ? 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700' : ''}
                      ${isPast ? 'opacity-40 cursor-not-allowed hover:scale-100 hover:shadow-none' : 'cursor-pointer'}
                      ${isToday(day) ? 'font-black' : ''}
                    `}
                  >
                    <span>{format(day, 'd')}</span>
                    {isToday(day) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand-500"/>}
                    <div className="flex gap-0.5 mt-0.5">
                      {pending  > 0 && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"/>}
                      {approved > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-3 mt-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              {[
                { color: 'bg-emerald-200 border-emerald-400', label: 'זמין מלא' },
                { color: 'bg-yellow-200 border-yellow-400',   label: 'זמין חלקי' },
                { color: 'bg-red-200 border-red-400',         label: 'תפוס' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded border inline-block ${l.color}`}/>
                  {l.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block"/> ממתין</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"/> אושר</span>
            </div>
          </div>

          {/* ── Side panel ── */}
          {selectedDay && (
            <div className="w-80 self-start sticky top-4 space-y-3 animate-slide-right">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                  {format(new Date(selectedDay), 'EEEE, d MMMM yyyy', { locale: he })}
                </h3>

                {(['ido','ofek'] as Person[]).map(person => {
                  const slots  = getAvailableSlots(person, selectedDay)
                  const status = getPersonDayStatus(person, selectedDay)
                  const occupied = dayReqs(selectedDay).filter(r => r.person === person && r.status === 'approved')
                  return (
                    <div key={person} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-0 border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{PERSON_LABELS[person]}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          status === 'full'    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                          status === 'partial' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' :
                          'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {status === 'full' ? 'פנוי מלא' : status === 'partial' ? 'פנוי חלקי' : 'לא פנוי'}
                        </span>
                      </div>
                      {occupied.length > 0 && (
                        <div className="mb-1 flex flex-wrap gap-1">
                          {occupied.map(r => (
                            <span key={r.id} className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 px-2 py-0.5 rounded line-through">
                              {r.startTime}–{r.endTime}
                            </span>
                          ))}
                        </div>
                      )}
                      {slots.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {slots.map(s => (
                            <span key={s} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {(getPersonDayStatus('ido', selectedDay) !== 'empty' || getPersonDayStatus('ofek', selectedDay) !== 'empty') && (
                  <button onClick={() => setShowModal(true)}
                    className="w-full mt-3 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white rounded-xl py-2.5 text-sm font-semibold shadow-sm transition-all">
                    + שלח בקשת תיאום
                  </button>
                )}
              </div>

              {selectedDayRequests.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 text-sm">בקשות ליום זה</h4>
                  <div className="space-y-2 stagger">
                    {selectedDayRequests.map((req: any) => (
                      <div key={req.id} className="animate-fade-up border border-gray-100 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-750">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {PERSON_LABELS[req.person as Person]} · {req.startTime}–{req.endTime}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_LABELS[req.status] ?? req.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">מאת: {req.requestedBy}</p>
                        {canCancel(req) && (
                          <button onClick={() => cancelRequest(req.id)}
                            className="mt-1.5 text-xs text-red-500 hover:text-red-700 font-medium">
                            ביטול ✕
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

      {/* ══ HISTORY TAB ══ */}
      {tab === 'history' && (
        <div className="max-w-3xl mx-auto p-4 animate-fade-up">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setHistoryMonth(m => subMonths(m, 1))}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {format(historyMonth, 'MMMM yyyy', { locale: he })}
            </h2>
            <button onClick={() => setHistoryMonth(m => addMonths(m, 1))}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
          </div>

          {monthRequests.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="text-4xl mb-3">📭</div>
              אין בקשות בחודש זה
            </div>
          ) : (
            <div className="space-y-2 stagger">
              {monthRequests.map((req: any) => (
                <div key={req.id} className="animate-fade-up bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {format(new Date(req.date), 'd MMMM yyyy', { locale: he })}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                        {PERSON_LABELS[req.person as Person]} · {req.startTime}–{req.endTime}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">מאת: {req.requestedBy}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[req.status] ?? req.status}
                    </span>
                  </div>
                  {canCancel(req) && (
                    <button onClick={() => cancelRequest(req.id)}
                      className="mt-3 text-xs text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-all">
                      ביטול בקשה
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ SETTINGS MODAL ══ */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-pop-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                הגדרות מערכת
              </h3>
              <button onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">הכנס סיסמת מנהל לגישה להגדרות</p>
            <input
              type="password"
              value={settingsPwd}
              onChange={e => { setSettingsPwd(e.target.value); setSettingsErr('') }}
              onKeyDown={e => e.key === 'Enter' && checkSettingsPassword()}
              autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3"
              placeholder="••••••••••"
            />
            {settingsErr && (
              <p className="text-red-500 text-sm text-center mb-3 animate-fade-up">{settingsErr}</p>
            )}
            <button onClick={checkSettingsPassword}
              className="w-full bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-semibold rounded-xl py-2.5 transition-all">
              כניסה להגדרות
            </button>
          </div>
        </div>
      )}

      {/* ══ REQUEST MODAL ══ */}
      {showModal && selectedDay && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-6 animate-pop-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">בקשת תיאום פגישה</h3>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600">
                ✕
              </button>
            </div>
            <p className="text-sm text-brand-600 dark:text-brand-400 font-medium mb-5">
              📆 {format(new Date(selectedDay), 'EEEE, d MMMM yyyy', { locale: he })}
            </p>

            <div className="space-y-4">
              {/* Person selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">בחר נציג Reline</label>
                <div className="flex gap-2">
                  {(['ido','ofek'] as Person[]).map(p => {
                    const status   = getPersonDayStatus(p, selectedDay)
                    const disabled = status === 'empty'
                    return (
                      <button key={p} onClick={() => !disabled && setSelectedPerson(p)} disabled={disabled}
                        className={`flex-1 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                          selectedPerson === p && !disabled
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 shadow-sm'
                            : disabled ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 text-gray-400 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-brand-300'
                        }`}>
                        {PERSON_LABELS[p]}
                        <span className={`block text-xs font-normal mt-0.5 ${
                          disabled ? 'text-gray-400' : status === 'full' ? 'text-emerald-600' : 'text-yellow-600'
                        }`}>
                          {disabled ? 'לא פנוי' : status === 'full' ? '✓ פנוי מלא' : '~ פנוי חלקי'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time range */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'שעת התחלה', value: startTime, onChange: setStartTime, slots: getAvailableSlots(selectedPerson, selectedDay) },
                  { label: 'שעת סיום',  value: endTime,   onChange: setEndTime,   slots: getAvailableSlots(selectedPerson, selectedDay).filter(h => h > startTime) },
                ].map(({ label, value, onChange, slots }) => (
                  <div key={label}>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                    <select value={value} onChange={e => onChange(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-right">
                      <option value="">בחר...</option>
                      {slots.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-2">
              {/* WhatsApp button - primary */}
              <button onClick={sendWhatsApp} disabled={!startTime || !endTime}
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] disabled:opacity-40 text-white font-bold rounded-2xl py-3 transition-all active:scale-95 shadow-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                שלח בקשה בוואטסאפ
              </button>

              {/* Save only (without WhatsApp) */}
              <button onClick={submitRequest} disabled={submitting || !startTime || !endTime}
                className="w-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-2xl py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all">
                {submitting ? 'שומר...' : 'שמור בלבד (ללא וואטסאפ)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
