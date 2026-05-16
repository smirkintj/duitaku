'use client'

import React from 'react'

export function CelestialStyles() {
  return (
    <style>{`
      @keyframes twinkle {
        0%, 100% { opacity: 0.15; transform: scale(1); }
        50% { opacity: 0.9; transform: scale(1.4); }
      }
      @keyframes orbit {
        from { transform: rotate(0deg) translateX(58px) rotate(0deg); }
        to   { transform: rotate(360deg) translateX(58px) rotate(-360deg); }
      }
      @keyframes pulseHalo {
        0%   { transform: scale(0.6); opacity: 0.6; }
        100% { transform: scale(2.4); opacity: 0; }
      }
      @keyframes breathe {
        0%, 100% { box-shadow: 0 0 4px 2px rgba(163,230,53,0.5); }
        50%       { box-shadow: 0 0 12px 6px rgba(163,230,53,0.8); }
      }
      @keyframes shoot1 {
        0%   { transform: translateX(-120%) translateY(-20px) rotate(18deg); opacity: 0; }
        5%   { opacity: 1; }
        35%  { transform: translateX(120%) translateY(20px) rotate(18deg); opacity: 0; }
        100% { transform: translateX(120%) translateY(20px) rotate(18deg); opacity: 0; }
      }
      @keyframes shoot2 {
        0%   { transform: translateX(-120%) translateY(-10px) rotate(18deg); opacity: 0; }
        5%   { opacity: 1; }
        35%  { transform: translateX(120%) translateY(10px) rotate(18deg); opacity: 0; }
        100% { transform: translateX(120%) translateY(10px) rotate(18deg); opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .celestial-star,
        .celestial-orbit,
        .celestial-halo,
        .celestial-breath,
        .celestial-shoot { animation: none !important; }
      }
    `}</style>
  )
}

// LCG star data computed deterministically
function generateStars() {
  let s = 7919
  const stars: { x: number; y: number; size: number; dur: number; delay: number; lime: boolean }[] = []
  for (let i = 0; i < 38; i++) {
    s = (s * 9301 + 49297) % 233280
    const x = (s % 10000) / 100
    s = (s * 9301 + 49297) % 233280
    const y = (s % 10000) / 100
    s = (s * 9301 + 49297) % 233280
    const size = 0.8 + (s % 100) / 100 * 1.4
    s = (s * 9301 + 49297) % 233280
    const dur = 2.5 + (s % 100) / 100 * 4
    s = (s * 9301 + 49297) % 233280
    const delay = (s % 100) / 100 * 6
    s = (s * 9301 + 49297) % 233280
    const lime = (s % 100) < 9
    stars.push({ x, y, size, dur, delay, lime })
  }
  return stars
}

const STARS = generateStars()

export function Starfield() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <CelestialStyles />
      {STARS.map((star, i) => (
        <span
          key={i}
          className="celestial-star"
          style={{
            position: 'absolute',
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: '50%',
            background: star.lime ? '#a3e635' : '#f5f5f4',
            animation: `twinkle ${star.dur}s ${star.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  )
}

export function OrbitDot() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="celestial-orbit"
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: '#a3e635',
          animation: 'orbit 32s linear infinite',
        }}
      />
    </div>
  )
}

export function PulseHalo({ color = '#a3e635' }: { color?: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        className="celestial-halo"
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          border: `1px solid ${color}`,
          animation: 'pulseHalo 2.8s ease-out infinite',
          opacity: 0,
        }}
      />
    </div>
  )
}

export function BreathingDot({ size = 8 }: { size?: number }) {
  return (
    <div
      className="celestial-breath"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#a3e635',
        flexShrink: 0,
        animation: 'breathe 2.4s ease-in-out infinite',
      }}
    />
  )
}

export function ShootingStarLayer() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div
        className="celestial-shoot"
        style={{
          position: 'absolute',
          top: '30%',
          left: 0,
          width: '40%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(163,230,53,0.7), transparent)',
          animation: 'shoot1 9s 1s ease-in infinite',
          transform: 'rotate(18deg)',
        }}
      />
      <div
        className="celestial-shoot"
        style={{
          position: 'absolute',
          top: '60%',
          left: 0,
          width: '30%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(163,230,53,0.5), transparent)',
          animation: 'shoot2 13s 4s ease-in infinite',
          transform: 'rotate(18deg)',
        }}
      />
    </div>
  )
}
