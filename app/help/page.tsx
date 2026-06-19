'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Suspense } from 'react'

/* ── Data ── */
type Step = { icon: string; title: string; body: string; tip?: string }

const SALES_STEPS: Step[] = [
  {
    icon: '🔐',
    title: 'כניסה למערכת',
    body: 'בדף הכניסה הכנס את שם המשתמש והסיסמה שקיבלת מהמנהל. לאחר הכניסה הראשונה האפליקציה תזכור אותך — בפעמים הבאות תיכנס ישירות ללוח הבקרה.',
    tip: 'ניתן להתקין את האפליקציה על הנייד — לחץ על "התקן" בפינה הימנית עליונה.',
  },
  {
    icon: '📅',
    title: 'הבנת לוח השנה',
    body: 'לוח השנה מציג את הזמינות של עידו ואופק לפי צבעים:',
  },
  {
    icon: '👆',
    title: 'בחירת יום',
    body: 'לחץ על כל יום צבעוני כדי לראות פרטי הזמינות. יפתח מסך (או פאנל) שמציג:\n• מי פנוי ובאיזה שעות\n• שעות תפוסות כבר (בקשות שאושרו)\n• כפתור "שלח בקשת תיאום"',
    tip: 'ניתן ללחוץ על יום בצבע כלשהו, אך ימים ירוקים/צהובים משמעותם שיש זמינות.',
  },
  {
    icon: '📤',
    title: 'שליחת בקשת תיאום',
    body: '1. בחר את נציג Reline — עידו או אופק (רק נציגים פנויים לחיצה)\n2. בחר שעת התחלה מהרשימה (מציגה רק שעות פנויות)\n3. בחר שעת סיום\n4. לחץ "שלח בקשה בוואטסאפ" — תיפתח הודעה מוכנה בוואטסאפ לנציג',
    tip: 'כפתור "שמור בלבד" שומר את הבקשה במערכת בלי לשלוח הודעת וואטסאפ.',
  },
  {
    icon: '✅',
    title: 'קבלת אישור',
    body: 'לאחר שהנציג מאשר את הבקשה — בכניסה הבאה לאפליקציה יופיע לך באנר ירוק עם פרטי הבקשות שאושרו מאז הכניסה האחרונה שלך.',
  },
  {
    icon: '📋',
    title: 'היסטוריית בקשות',
    body: 'לחץ על טאב "היסטוריה" בחלק העליון. ניתן לנווט בין חודשים ולראות את כל הבקשות שלך עם הסטטוס: ממתין / אושר / נדחה / בוטל.',
  },
  {
    icon: '❌',
    title: 'ביטול בקשה ממתינה',
    body: 'בטאב "היסטוריה" — לחץ על "ביטול בקשה" מתחת לבקשה שסטטוסה "ממתין". ניתן לבטל רק בקשות שטרם אושרו.',
  },
]

const RELINE_STEPS: Step[] = [
  {
    icon: '🔐',
    title: 'כניסה למערכת',
    body: 'הכנס שם משתמש וסיסמה. לאחר הכניסה הראשונה האפליקציה תזכור אותך — בפעמים הבאות תיכנס ישירות למסך הזמינות.',
    tip: 'מומלץ להתקין כאפליקציה — לחץ "התקן" בראש הדף.',
  },
  {
    icon: '🔔',
    title: 'בקשות ממתינות',
    body: 'כשיש בקשות חדשות שמחכות לאישורך — יופיע באנר כתום בראש הדף עם מספר הבקשות הממתינות וכפתור מהיר לטאב האישורים.',
  },
  {
    icon: '📆',
    title: 'הגדרת זמינות',
    body: 'בטאב "זמינות":\n1. לחץ על יום בלוח השנה (עתידי בלבד)\n2. יפתח מסך עם כל השעות 08:00–18:30\n3. לחץ על שעה לסימון כ"פנוי" (תכלת) או בטלה לביטול\n4. לחץ "שמור יום" לשמירה',
    tip: '"בחר הכל" סומן את כל השעות ביום. "נקה הכל" מאפס.',
  },
  {
    icon: '🎨',
    title: 'צבעי ימים בלוח',
    body: 'ירוק = יום מוגדר כמעט במלואו\nצהוב = יום מוגדר חלקית\nלבן/אפור = לא הוגדרה זמינות',
  },
  {
    icon: '✅',
    title: 'אישור ודחיית בקשות',
    body: 'בטאב "אישורים" רואים את כל בקשות התיאום שהגיעו:\n• לחץ "אשר" — הבקשה מאושרת ומנהל המכירות יקבל הודעה בכניסה הבאה\n• לחץ "דחה" — הבקשה נדחית',
    tip: 'הזמן האמיתי שנבחר יוצג מול כל בקשה. בקש מהמשתמש לבחור שעות מתוך שעות הפנויות.',
  },
  {
    icon: '🔒',
    title: 'שעות תפוסות',
    body: 'לאחר אישור בקשה — אותן שעות מסומנות כ"תפוסות" בלוח של מנהלי המכירות (מוצגות עם קו חוצה). לא ניתן לשלוח בקשה חדשה לשעות שכבר אושרו.',
  },
]

const COLORS = [
  { color: 'bg-emerald-200 border-emerald-400', label: 'זמין מלא — רוב השעות פנויות' },
  { color: 'bg-yellow-200 border-yellow-400',   label: 'זמין חלקי — חלק מהשעות פנויות' },
  { color: 'bg-red-200 border-red-400',         label: 'תפוס — קיימת כבר בקשה לאישור' },
  { color: 'bg-gray-100 border-gray-300',       label: 'ללא זמינות מוגדרת' },
]

/* ── Component ── */
function HelpContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const session      = typeof window !== 'undefined' ? getSession() : null

  // Default tab based on role or query param
  const defaultTab = searchParams.get('tab') === 'reline' ? 'reline'
    : session?.role === 'relayn' ? 'reline' : 'sales'
  const [tab, setTab] = useState<'sales' | 'reline'>(defaultTab as 'sales' | 'reline')
  const [open, setOpen] = useState<number | null>(0)

  const steps = tab === 'sales' ? SALES_STEPS : RELINE_STEPS

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">מדריך שימוש</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">MatchTime</p>
        </div>
      </header>

      {/* Tab switcher */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
        <div className="flex gap-1 max-w-2xl mx-auto">
          {[
            { key: 'sales',  label: '💼 מנהל מכירות' },
            { key: 'reline', label: '📅 עידו / אופק' },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key as any); setOpen(0) }}
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

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3 animate-fade-up">

        {/* Intro card */}
        <div className={`rounded-2xl p-4 text-sm font-medium ${
          tab === 'sales'
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
            : 'bg-brand-50 dark:bg-brand-900/20 text-brand-800 dark:text-brand-200 border border-brand-200 dark:border-brand-700'
        }`}>
          {tab === 'sales'
            ? '👋 מדריך זה מסביר כיצד לתאם פגישות עם נציגי Reline דרך המערכת — צעד אחר צעד.'
            : '👋 מדריך זה מסביר כיצד להגדיר זמינות ולאשר בקשות תיאום פגישות.'}
        </div>

        {/* Calendar legend (sales only) */}
        {tab === 'sales' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3">🎨 מקרא צבעי לוח השנה</p>
            <div className="space-y-2">
              {COLORS.map(c => (
                <div key={c.label} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-lg border-2 flex-shrink-0 ${c.color}`}/>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{c.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/>ממתין לאישור
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>אושר
              </span>
            </div>
          </div>
        )}

        {/* Steps — accordion */}
        {steps.map((step, i) => (
          <div key={i}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center gap-3 px-4 py-4 text-right">
              <span className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
                open === i ? 'bg-brand-100 dark:bg-brand-900/40' : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {step.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-500">שלב {i + 1}</span>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{step.title}</p>
              </div>
              <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {open === i && (
              <div className="px-4 pb-4 animate-fade-up">
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {step.body}
                  </p>
                  {step.tip && (
                    <div className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2.5">
                      <span className="text-base flex-shrink-0">💡</span>
                      <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{step.tip}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Quick action at bottom */}
        <button onClick={() => router.back()}
          className="w-full bg-brand-500 hover:bg-brand-600 active:scale-95 text-white rounded-2xl py-3.5 font-semibold text-sm transition-all shadow-sm mt-2">
          חזור לאפליקציה ←
        </button>

      </div>
    </div>
  )
}

export default function HelpPage() {
  return (
    <Suspense>
      <HelpContent />
    </Suspense>
  )
}
