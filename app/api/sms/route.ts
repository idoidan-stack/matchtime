import { NextRequest, NextResponse } from 'next/server'

const MACRODROID_URL =
  process.env.MACRODROID_URL ??
  'https://trigger.macrodroid.com/a2f82f4d-f5de-4564-b5ba-59c1373a7c28/sms'

export async function POST(req: NextRequest) {
  try {
    const { phone, message } = await req.json()
    if (!phone || !message)
      return NextResponse.json({ error: 'missing params' }, { status: 400 })

    // Normalize Israeli number: 05X → +9725X
    const normalized = phone.startsWith('0')
      ? '+972' + phone.slice(1)
      : phone

    const url = `${MACRODROID_URL}?phone=${encodeURIComponent(normalized)}&message=${encodeURIComponent(message)}`
    console.log('[SMS] sending to', normalized, '| url:', url)

    const res = await fetch(url)
    console.log('[SMS] macrodroid response status:', res.status)

    return NextResponse.json({ ok: true, to: normalized })
  } catch (e) {
    console.error('[SMS] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
