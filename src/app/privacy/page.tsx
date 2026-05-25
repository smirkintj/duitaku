import React from 'react'
import Link from 'next/link'

const S = {
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
}

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', padding: '48px 24px', ...S.sans }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <div style={{ marginBottom: 40 }}>
          <Link href="/login" style={{ fontSize: 12, color: '#5b5b59', ...S.mono, letterSpacing: '0.08em', textDecoration: 'none' }}>
            ← DUITAKU
          </Link>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f5f5f4', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Privacy Notice</h1>
        <p style={{ fontSize: 13, color: '#5b5b59', ...S.mono, letterSpacing: '0.06em', marginBottom: 40 }}>Last updated: May 2026</p>

        {[
          {
            title: 'What this app is',
            body: 'Duitaku is a personal finance tracker. It is a small, privately operated app shared with a limited group of users — not a commercial product. There is no company behind it.',
          },
          {
            title: 'What data we collect',
            body: 'We collect only what you enter: your name and email address (for your account), your financial data (transactions, salary, accounts, bills, investments, loans, savings goals), and usage preferences. We do not collect device data, analytics, or tracking cookies.',
          },
          {
            title: 'How your data is stored',
            body: 'All data is stored in a private PostgreSQL database hosted on Neon (neon.tech), a US-based cloud database provider. Data is encrypted in transit (TLS). Sensitive credentials such as third-party API keys are encrypted at rest using AES-256-GCM before being stored.',
          },
          {
            title: 'Who can see your data',
            body: 'The app is designed so that each user can only see their own data — every query is scoped to your account. The person who operates this app has administrative access to the database and can technically access data directly. This access is not used for any purpose other than maintenance and support. We commit to not reading, sharing, or using your financial data for any purpose beyond keeping the app running.',
          },
          {
            title: 'Third-party services',
            body: 'The app uses Anthropic\'s Claude API to generate AI financial insights. When you use the AI Coach feature, a summary of your financial data (category spending, salary, flags) is sent to Anthropic\'s API for processing. No data is stored by Anthropic beyond the duration of a single API call. Neon.tech stores your data as described above. No other third parties receive your data.',
          },
          {
            title: 'Your rights under PDPA',
            body: 'Under Malaysia\'s Personal Data Protection Act 2010, you have the right to access your personal data, correct inaccurate data, and withdraw consent. You can delete your account and all associated data at any time from Settings → Danger Zone. This permanently and irreversibly removes everything.',
          },
          {
            title: 'Data retention',
            body: 'Your data is retained for as long as your account exists. When you delete your account, all data is deleted immediately and cannot be recovered.',
          },
          {
            title: 'Contact',
            body: 'If you have questions or concerns about your data, contact the app operator directly via WhatsApp or the channel through which you were invited.',
          },
        ].map(({ title, body }) => (
          <div key={title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f4', margin: '0 0 10px' }}>{title}</h2>
            <p style={{ fontSize: 14, color: '#7a7a78', lineHeight: 1.75, margin: 0 }}>{body}</p>
          </div>
        ))}

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #1a1a1a' }}>
          <Link href="/login" style={{ fontSize: 13, color: '#a3e635', textDecoration: 'none' }}>Back to sign in →</Link>
        </div>
      </div>
    </div>
  )
}
