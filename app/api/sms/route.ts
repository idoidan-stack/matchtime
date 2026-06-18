import { NextRequest, NextResponse } from 'next/server'

const MACRODROID_URL =
  process.env.MACRODROID_URL ??
  'https://trigger.macrodroid.com/a2f82f4d-f5de-4564-b5ba-59c1373a7c28/sms'

export async function POST(req: NextRequest) {
  try {
    const { phone, message } = await req.json()
    if (!phone || !message)
      return NextResponse.json({ error: 'missing params' }, { status: 400 })

    const url = `${MACRODROID_URL}?phone=${encodeURIComponent(phone)}&message=${encodeURIComponent(message)}`
    await fetch(url)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
