export function validateAmount(value: unknown, name = 'amount'): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
    throw new Error(`${name} must be a non-negative finite number below 1 billion`)
  }
  return n
}

export function validationError(message: string) {
  return Response.json({ error: message }, { status: 400 })
}
