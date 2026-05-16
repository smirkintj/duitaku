export function formatRM(value: number, decimals = 2): string {
  return Math.abs(value).toLocaleString('en-MY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
