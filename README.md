# MatchTime — תיאום פגישות Relayn × Partner

## מבנה המשתמשים

| הרשאה | גישה |
|-------|------|
| `system_admin` | הכל + ניהול משתמשים |
| `manager` | יומן חודשי + שליחת בקשות |
| `sales_manager` | יומן חודשי + שליחת בקשות |
| `relayn` | הזנת זמינות + אישור בקשות |

## כניסת מנהל מערכת
- שם משתמש: `admin`
- סיסמה: `300395860`
- כתובת: `/admin`

## Firebase — מבנה DB

```
matchtime/
  users/
    {userId}/
      id, name, username, password, role, relayнPerson
  availability/
    ido/
      {yyyy-MM}/
        {yyyy-MM-dd}/
          "08:00": true/false
          "08:30": true/false
          ...
    ofek/
      (same structure)
  requests/
    {pushId}/
      id, date, startTime, endTime, person, status, requestedBy, requestedById, createdAt
```

## Firebase Rules (העתק ל-Realtime Database Rules)

```json
{
  "rules": {
    "matchtime": {
      ".read": true,
      ".write": true
    }
  }
}
```

## פריסה ב-Vercel

1. `npm install`
2. העלה לגיטהאב
3. ב-Vercel: Import project → Next.js
4. הוסף Environment Variables (תוכן קובץ `.env.local`)
5. Deploy

## הרצה מקומית

```bash
npm install
npm run dev
```
