import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { JetBrains_Mono } from 'next/font/google'
import PinGate from '@/components/finance/PinGate'
import GlobalModals from '@/components/finance/GlobalModals'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'duitaku',
  description: 'Personal finance tracker — salary, expenses, CC import, AI insights',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.className} ${jetbrainsMono.variable} h-full`}>
      <body style={{ background: '#0d0d0d', color: '#f5f5f4', margin: 0, height: '100%' }}>
        <PinGate><GlobalModals>{children}</GlobalModals></PinGate>
      </body>
    </html>
  )
}
