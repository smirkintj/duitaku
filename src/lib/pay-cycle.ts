// Pay cycle utilities — when payDay is set, the "month" is the period
// from payDay of baseMonth to (payDay-1) of the following month.
// e.g. payDay=28, baseMonth="2024-11" → Nov 28 – Dec 27

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export interface PayCycle {
  startDate: string   // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
  daysIn: number
  label: string       // e.g. "28 NOV – 27 DEC 2024"
  baseMonth: string   // YYYY-MM (the URL param / key)
}

/** Compute pay cycle dates given the base month and pay day. */
export function getPayCycle(baseMonth: string, payDay: number): PayCycle {
  const [y, m] = baseMonth.split('-').map(Number)

  // Cycle starts on payDay of baseMonth (clamped to actual days in month)
  const daysInStart = new Date(y, m, 0).getDate()
  const startDay = Math.min(payDay, daysInStart)
  const startDate = `${y}-${pad(m)}-${pad(startDay)}`

  // Cycle ends on payDay-1 of the next month (or last day if payDay=1)
  let ey = y, em = m + 1
  if (em > 12) { em = 1; ey++ }
  const daysInEnd = new Date(ey, em, 0).getDate()
  const endDay = payDay === 1 ? daysInEnd : Math.min(payDay - 1, daysInEnd)
  const endDate = `${ey}-${pad(em)}-${pad(endDay)}`

  const daysIn = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
  ) + 1

  const startLabel = new Date(startDate + 'T12:00:00').toLocaleString('en-MY', { day: 'numeric', month: 'short' }).toUpperCase()
  const endLabel = new Date(endDate + 'T12:00:00').toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
  const label = `${startLabel} – ${endLabel}`

  return { startDate, endDate, daysIn, label, baseMonth }
}

/** Given today's date and payDay, return the baseMonth for the current cycle. */
export function getCurrentBaseMonth(today: Date, payDay: number): string {
  const day = today.getDate()
  const y = today.getFullYear()
  const m = today.getMonth() + 1

  if (day >= payDay) {
    return `${y}-${pad(m)}`
  } else {
    let pm = m - 1, py = y
    if (pm < 1) { pm = 12; py-- }
    return `${py}-${pad(pm)}`
  }
}

/** How many days into the current cycle we are (1-based, capped at daysIn). */
export function getDayInCycle(today: Date, startDate: string, daysIn: number): number {
  const start = new Date(startDate + 'T00:00:00')
  const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000)
  return Math.min(Math.max(elapsed + 1, 1), daysIn)
}

/** Index of a transaction date within the cycle array (0-based, -1 if outside). */
export function txCycleIndex(txDate: string, startDate: string, daysIn: number): number {
  const idx = Math.floor(
    (new Date(txDate + 'T12:00:00').getTime() - new Date(startDate + 'T12:00:00').getTime()) / 86400000
  )
  return idx >= 0 && idx < daysIn ? idx : -1
}

/** Navigate baseMonth backward one cycle. */
export function prevCycleMonth(baseMonth: string): string {
  const [y, m] = baseMonth.split('-').map(Number)
  let pm = m - 1, py = y
  if (pm < 1) { pm = 12; py-- }
  return `${py}-${pad(pm)}`
}

/** Navigate baseMonth forward one cycle. */
export function nextCycleMonth(baseMonth: string): string {
  const [y, m] = baseMonth.split('-').map(Number)
  let nm = m + 1, ny = y
  if (nm > 12) { nm = 1; ny++ }
  return `${ny}-${pad(nm)}`
}
