'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const isDbConfig = error.message?.includes('DATABASE_URL')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0d0d0d',
        fontFamily: '"Geist", -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 440,
          background: '#111',
          border: '1px solid #222',
          borderRadius: 16,
          padding: '36px 40px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f4', margin: '0 0 10px' }}>
          {isDbConfig ? 'Database not configured' : 'Something went wrong'}
        </h1>
        <p style={{ fontSize: 14, color: '#7a7a78', margin: '0 0 24px', lineHeight: 1.6 }}>
          {isDbConfig
            ? 'Set DATABASE_URL in your Vercel project environment variables, then redeploy.'
            : error.message || 'An unexpected server error occurred.'}
        </p>
        {!isDbConfig && (
          <button
            onClick={reset}
            style={{
              background: '#a3e635',
              color: '#0d0d0d',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
