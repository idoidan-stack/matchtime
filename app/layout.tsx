import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MatchTime',
  description: 'תיאום פגישות Relayn',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
