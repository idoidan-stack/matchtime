import { db } from './firebase'
import { ref, push, set } from 'firebase/database'

export type LogAction =
  | 'login' | 'logout'
  | 'request_created' | 'request_cancelled'
  | 'request_approved' | 'request_rejected'
  | 'user_created' | 'user_updated' | 'user_deleted'
  | 'settings_accessed'

export async function log(action: LogAction, details: string, userName = 'מערכת') {
  try {
    const r = push(ref(db, 'matchtime/logs'))
    await set(r, { id: r.key, action, details, userName, timestamp: Date.now() })
  } catch {}
}
