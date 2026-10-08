
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AED: 'AED ',
  SAR: 'SAR ',
  CAD: 'C$',
  AUD: 'A$',
  SGD: 'S$',
}

export function currencySymbol(currency = 'INR'): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `
}

export function formatPrice(value: number | null | undefined, currency = 'INR'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const symbol = currencySymbol(currency)
  const locale = currency.toUpperCase() === 'INR' ? 'en-IN' : 'en-US'
  const fractionDigits = Number.isInteger(value) ? 0 : 2
  return `${symbol}${value.toLocaleString(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (value < 1000) return `${value}`
  if (value < 10000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
  if (value < 1000000) return `${Math.round(value / 1000)}k`
  return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export function percentOff(price: number | null, original: number | null): number | null {
  if (price === null || original === null || original <= price) return null
  return Math.round(((original - price) / original) * 100)
}

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}
